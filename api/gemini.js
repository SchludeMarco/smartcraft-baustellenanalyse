import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';
import { getFirestore } from 'firebase-admin/firestore';

// "latest"-Alias statt fest datiertem Modellnamen, damit die App nicht erneut
// durch eine Modell-Abschaltung bricht (siehe Git-Historie: gemini-2.5-flash-preview-09-2025
// und gemini-2.5-flash wurden beide bereits zurückgezogen).
const MODEL_NAME = 'gemini-flash-latest';

// Rate-Limit-Fenster: 12/Minute deckt einen legitimen Burst (Hauptanalyse +
// die 4 Zusatz-Tools) locker ab, 200/Tag bremst zusätzlich Slow-Drip-Missbrauch.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_WINDOW = 12;
const RATE_LIMIT_DAY_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_MAX_PER_DAY = 200;

// Lazy-Init: Admin-App nur aufbauen, wenn ein Service-Account hinterlegt ist.
// Ohne FIREBASE_SERVICE_ACCOUNT_KEY bleiben App Check/Rate-Limiting aus
// (fail-open), damit der Endpoint nach dem Deploy nicht bricht, bevor die
// Firebase/Vercel-Konfiguration nachgezogen wurde (siehe README).
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

// Fixed-Window-Zähler pro IP in Firestore (_rateLimits/{ip}), atomar per
// Transaktion aktualisiert. Diese Collection ist nicht in firestore.rules
// erwähnt und damit für das Client-SDK automatisch unerreichbar (Default-Deny).
async function checkRateLimit(app, ip) {
  const db = getFirestore(app);
  const ref = db.collection('_rateLimits').doc(ip);
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Nur Requests akzeptieren, die tatsächlich vom eigenen Frontend kommen
  // (verhindert, dass fremde Seiten diesen Endpoint als kostenlosen
  // Gemini-Proxy missbrauchen und das API-Kontingent/Kosten verursachen).
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

  // App Check + Rate-Limiting: nur aktiv, wenn ein Service-Account
  // konfiguriert ist (siehe getAdminApp). Sonst unverändertes Verhalten.
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server misconfigured: GEMINI_API_KEY missing' });
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const text = await upstream.text();
    res.status(upstream.status).setHeader('Content-Type', 'application/json').send(text);
  } catch (error) {
    res.status(502).json({ error: 'Upstream Gemini request failed' });
  }
}
