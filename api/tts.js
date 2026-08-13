import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';
import { getFirestore } from 'firebase-admin/firestore';

// Google liefert für de-DE-Stimmen durchgängig A=weiblich, B=männlich (gilt
// für Standard-, WaveNet- und Neural2-Stimmen gleichermaßen). WaveNet klingt
// deutlich natürlicher als Standard und ist im kostenlosen Kontingent von
// Google Cloud enthalten (Stand: 1 Mio. Zeichen/Monat gratis für WaveNet).
const VOICE_BY_GENDER = {
  male: 'de-DE-Wavenet-B',
  female: 'de-DE-Wavenet-A',
};
const LANGUAGE_CODE = 'de-DE';

// Google Cloud Text-to-Speech erlaubt max. 5000 Byte Eingabetext pro Anfrage
// (input.text) — mit Marge darunter bleiben und an Satzenden aufteilen, statt
// mitten im Wort abzuschneiden.
const TTS_CHUNK_MAX_BYTES = 4500;

// Eigenes, von /api/gemini unabhängiges Rate-Limit (eigene Firestore-Collection),
// damit ein TTS-Burst (Kurz + Vollständig + Geschlechtswechsel) nicht das
// Gemini-Kontingent derselben IP mitverbraucht und umgekehrt.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_WINDOW = 10;
const RATE_LIMIT_DAY_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_MAX_PER_DAY = 100;

// Lazy-Init: Admin-App nur aufbauen, wenn ein Service-Account hinterlegt ist.
// Gleiches Fail-open-Muster wie api/gemini.js — ohne FIREBASE_SERVICE_ACCOUNT_KEY
// bleiben App Check/Rate-Limiting aus, statt den Endpoint zu blockieren.
let adminApp = null;
let adminInitTried = false;
function getAdminApp() {
  if (adminApp || adminInitTried) return adminApp;
  adminInitTried = true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    const serviceAccount = JSON.parse(raw);
    adminApp = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
  } catch (e) {
    console.error('Firebase-Admin-Initialisierung fehlgeschlagen:', e);
    adminApp = null;
  }
  return adminApp;
}

async function verifyAppCheck(req, app) {
  const token = req.headers['x-firebase-appcheck'];
  if (!token) return false;
  try {
    await getAppCheck(app).verifyToken(token);
    return true;
  } catch {
    return false;
  }
}

async function checkRateLimit(app, ip) {
  const db = getFirestore(app);
  const ref = db.collection('_ttsRateLimits').doc(ip);
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    let { minuteStart = 0, minuteCount = 0, dayStart = 0, dayCount = 0 } = data;
    if (now - minuteStart > RATE_LIMIT_WINDOW_MS) {
      minuteStart = now;
      minuteCount = 0;
    }
    if (now - dayStart > RATE_LIMIT_DAY_MS) {
      dayStart = now;
      dayCount = 0;
    }
    minuteCount += 1;
    dayCount += 1;
    const allowed = minuteCount <= RATE_LIMIT_MAX_PER_WINDOW && dayCount <= RATE_LIMIT_MAX_PER_DAY;
    tx.set(ref, { minuteStart, minuteCount, dayStart, dayCount }, { merge: true });
    return allowed;
  });
}

// Zerlegt Text an Satzenden in Häppchen unter TTS_CHUNK_MAX_BYTES, damit auch
// lange Diagnosetexte (> 5000 Byte) als mehrere Anfragen an Google Cloud gehen.
function chunkText(text) {
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [text];
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && Buffer.byteLength(current + sentence, 'utf8') > TTS_CHUNK_MAX_BYTES) {
      chunks.push(current.trim());
      current = '';
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Nur Requests vom eigenen Frontend akzeptieren — verhindert, dass fremde
  // Seiten diesen Endpoint als kostenlosen TTS-Proxy missbrauchen.
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  let originHost = null;
  try {
    originHost = req.headers.origin ? new URL(req.headers.origin).host : null;
  } catch {
    originHost = null;
  }
  if (!originHost || originHost !== host) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const app = getAdminApp();
  if (app) {
    const appCheckOk = await verifyAppCheck(req, app);
    if (!appCheckOk) {
      res.status(401).json({ error: 'Forbidden: invalid App Check token' });
      return;
    }
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const withinLimit = await checkRateLimit(app, ip);
    if (!withinLimit) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }
  } else {
    console.warn('FIREBASE_SERVICE_ACCOUNT_KEY nicht gesetzt — App Check/Rate-Limiting deaktiviert.');
  }

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server misconfigured: GOOGLE_TTS_API_KEY missing' });
    return;
  }

  const { text, gender } = req.body || {};
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Missing text' });
    return;
  }
  const voiceName = VOICE_BY_GENDER[gender] || VOICE_BY_GENDER.male;

  try {
    const audioChunks = [];
    for (const chunk of chunkText(text)) {
      const upstream = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: chunk },
          voice: { languageCode: LANGUAGE_CODE, name: voiceName },
          audioConfig: { audioEncoding: 'MP3' },
        }),
      });
      const data = await upstream.json();
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: data.error?.message || 'Upstream TTS request failed' });
        return;
      }
      audioChunks.push(data.audioContent);
    }
    res.status(200).json({ audioChunks });
  } catch (error) {
    res.status(502).json({ error: 'Upstream TTS request failed' });
  }
}
