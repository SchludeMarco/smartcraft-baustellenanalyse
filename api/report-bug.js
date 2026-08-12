import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';
import { getFirestore } from 'firebase-admin/firestore';

import { getErrorContextInfo } from '../src/errorContextInfo.js';

// Bug-Reports sind selten (kein regulärer User-Flow), daher deutlich enger
// begrenzt als /api/gemini — reicht für mehrere Crashes in Folge, bremst aber
// Missbrauch als Mail-Spam-Relais.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_WINDOW = 5;
const RATE_LIMIT_DAY_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_MAX_PER_DAY = 50;

// Gleiches Lazy-Init/Fail-open-Muster wie api/gemini.js: ohne Service-Account
// bleiben App Check/Rate-Limiting aus, statt den Endpoint komplett zu blockieren.
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
  // Eigener Doc-Präfix, damit dieser Zähler nicht mit dem von api/gemini.js
  // um dieselbe IP kollidiert.
  const ref = db.collection('_rateLimits').doc(`bugreport_${ip}`);
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

const formatTimestamp = (ms) => (ms ? new Date(ms).toLocaleString('de-DE') : 'Unbekannt');

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function buildEmail(report) {
  const info = getErrorContextInfo(report.context);
  const subject = `Sm@rtCraft Fehlerreport: ${info.label}`;
  const html = [
    `<p><strong>Kontext:</strong> ${escapeHtml(report.context)}</p>`,
    `<p><strong>Zeitpunkt:</strong> ${escapeHtml(formatTimestamp(report.timestamp))}</p>`,
    `<p><strong>App-Version:</strong> ${escapeHtml(report.appVersion || 'unbekannt')}</p>`,
    `<p><strong>Gerät (User-Agent):</strong> ${escapeHtml(report.userAgent || 'unbekannt')}</p>`,
    `<p><strong>Fehlermeldung:</strong><br>${escapeHtml(report.message || '(keine Meldung)')}</p>`,
    `<p><strong>Vermutliche Ursache:</strong><br>${escapeHtml(info.cause)}</p>`,
    `<p><strong>Lösungsansatz:</strong><br>${escapeHtml(info.fix)}</p>`,
    report.stack ? `<p><strong>Stacktrace (gekürzt):</strong></p><pre>${escapeHtml(report.stack.slice(0, 1000))}</pre>` : '',
  ].join('\n');
  return { subject, html };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Gleicher Same-Origin-Schutz wie api/gemini.js, damit dieser Endpoint nicht
  // als fremder Mail-Versand missbraucht wird.
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
    console.warn('FIREBASE_SERVICE_ACCOUNT_KEY nicht gesetzt — App Check/Rate-Limiting für /api/report-bug deaktiviert.');
  }

  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.SUPPORT_EMAIL || process.env.VITE_ADMIN_EMAIL;
  if (!apiKey || !recipient) {
    console.error('/api/report-bug: RESEND_API_KEY oder SUPPORT_EMAIL/VITE_ADMIN_EMAIL fehlt — Mail-Versand übersprungen.');
    res.status(500).json({ error: 'Server misconfigured: RESEND_API_KEY/SUPPORT_EMAIL missing' });
    return;
  }
  const from = process.env.RESEND_FROM_EMAIL || 'Sm@rtCraft Bug-Report <onboarding@resend.dev>';

  const { context, message, stack, appVersion, userAgent, timestamp } = req.body || {};
  if (!context) {
    res.status(400).json({ error: 'Missing context' });
    return;
  }
  const { subject, html } = buildEmail({ context, message, stack, appVersion, userAgent, timestamp });

  try {
    const upstream = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: recipient, subject, html }),
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      console.error('Resend-Versand fehlgeschlagen:', upstream.status, text);
      res.status(502).json({ error: 'Email send failed' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Resend-Request fehlgeschlagen:', error);
    res.status(502).json({ error: 'Upstream email request failed' });
  }
}
