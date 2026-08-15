import { collection, collectionGroup, doc, setDoc, getDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { getToken as getAppCheckToken } from 'firebase/app-check';
import { ERROR_CONTEXT_INFO, getErrorContextInfo } from './errorContextInfo';

const QUEUE_KEY = 'smartcraft_error_queue';
const MAX_QUEUE_LENGTH = 30;

// Von App.jsx nach App-Check-Init gesetzt, damit sendBugReportEmail() den
// Endpoint /api/report-bug ebenfalls mit einem gültigen Token absichern kann,
// ohne dass App.jsx die Instanz manuell durchreichen muss.
let appCheckInstanceRef = null;
export const setErrorReportingAppCheck = (instance) => {
  appCheckInstanceRef = instance;
};

/**
 * Schickt einen Fehlerreport best-effort per Mail an den Support (siehe
 * api/report-bug.js). Bewusst "fire and forget": Firestore (queueErrorReport/
 * flushErrorReports) bleibt die verlässliche Quelle, die Mail ist nur ein
 * zusätzlicher Sofort-Hinweis. Schlägt der Versand fehl (offline, Endpoint
 * nicht konfiguriert, Rate-Limit), geht dadurch kein Report verloren.
 */
export const sendBugReportEmail = async (report) => {
  try {
    let headers = { 'Content-Type': 'application/json' };
    if (appCheckInstanceRef) {
      try {
        const { token } = await getAppCheckToken(appCheckInstanceRef);
        headers['X-Firebase-AppCheck'] = token;
      } catch {
        // Ohne Token läuft die Anfrage weiter - der Endpoint fällt bei fehlendem
        // Service-Account ohnehin auf "ungeschützt" zurück (siehe api/report-bug.js).
      }
    }
    await fetch('/api/report-bug', { method: 'POST', headers, body: JSON.stringify(report) });
  } catch {
    // Netzwerkfehler/offline - bewusst ignoriert, siehe Doku-Kommentar oben.
  }
};

const readQueue = () => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeQueue = (queue) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage voll/nicht verfügbar (z.B. privater Modus) - Report geht in diesem Fall verloren
  }
};

/**
 * Speichert einen Fehler lokal (überlebt Offline-Phasen). Wird beim nächsten
 * erfolgreichen flushErrorReports()-Aufruf an Firestore gesendet.
 */
export const queueErrorReport = (context, error) => {
  const report = {
    context,
    message: error?.message ? String(error.message) : String(error),
    stack: error?.stack ? String(error.stack).slice(0, 2000) : null,
    appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    timestamp: Date.now(),
  };
  const queue = readQueue();
  queue.push(report);
  while (queue.length > MAX_QUEUE_LENGTH) queue.shift();
  writeQueue(queue);
  // Sofort-Benachrichtigung per Mail, egal ob der Bug am PC oder am Smartphone
  // auftritt - unabhängig vom Firestore-Flush oben, der offline warten würde.
  sendBugReportEmail(report);
};

/**
 * Versucht alle lokal wartenden Fehlerreports unter dem privaten Nutzerpfad
 * in Firestore abzulegen. Reports, die (erneut) fehlschlagen, bleiben in der
 * Warteschlange und werden beim nächsten Versuch erneut probiert.
 * `reporterInfo` ({ displayName, email, isAnonymous }) wird mitgespeichert,
 * damit der Admin-Bereich Reports einer echten Google-Identität statt nur
 * einer anonymen UID zuordnen kann (siehe AdminPanel.jsx).
 */
export const flushErrorReports = async (db, userId, appId, reporterInfo = null) => {
  if (!db || !userId || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  const queue = readQueue();
  if (queue.length === 0) return;
  const remaining = [];
  for (const report of queue) {
    try {
      const reportsCol = collection(db, 'artifacts', appId, 'users', userId, 'errorReports');
      await setDoc(doc(reportsCol), { ...report, reportedBy: reporterInfo, sentAt: serverTimestamp() });
    } catch (e) {
      remaining.push(report);
    }
  }
  writeQueue(remaining);
};

/**
 * Liest alle bereits gesendeten Fehlerreports über alle Nutzer hinweg (Admin-Bereich).
 * Erfordert eine Firestore-Regel, die Lesezugriff auf die `errorReports`-Collection-Group
 * für authentifizierte Nutzer erlaubt (siehe firestore.rules). Sortierung erfolgt clientseitig,
 * damit kein zusätzlicher Firestore-Index für die Collection-Group-Query nötig ist.
 */
export const fetchAllErrorReports = async (db) => {
  const snapshot = await getDocs(collectionGroup(db, 'errorReports'));
  const reports = [];
  snapshot.forEach((docSnap) => {
    reports.push({ id: docSnap.id, path: docSnap.ref.path, ...docSnap.data() });
  });
  reports.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return reports;
};

const RESOLUTIONS_DOC = (db, appId) => doc(db, 'artifacts', appId, 'adminMeta', 'errorResolutions');

/**
 * Liest, welche Fehlerkontexte (Schlüssel aus ERROR_CONTEXT_INFO) im Admin-
 * Bereich als "gelöst" markiert wurden. Ein Kontext ist bewusst die Einheit
 * (nicht der einzelne Report) — siehe error_log.md, das dieselbe Granularität
 * verwendet.
 */
export const fetchResolvedContexts = async (db, appId) => {
  const snap = await getDoc(RESOLUTIONS_DOC(db, appId));
  return snap.exists() ? (snap.data().resolvedContexts || {}) : {};
};

const NOTIFIED_CONTEXTS_DOC = (db, appId) => doc(db, 'artifacts', appId, 'adminMeta', 'notifiedContexts');

/**
 * Markiert einen Fehlerkontext im Admin-Bereich als gelöst/wieder offen.
 * `resolved = false` entfernt den Eintrag statt ihn nur zu leeren, damit
 * `resolvedContexts` nicht mit toten Einträgen zuwächst.
 */
export const setContextResolved = async (db, appId, context, resolved, meta = {}) => {
  const ref = RESOLUTIONS_DOC(db, appId);
  const snap = await getDoc(ref);
  const current = snap.exists() ? (snap.data().resolvedContexts || {}) : {};
  if (resolved) {
    current[context] = { resolvedAt: Date.now(), ...meta };
  } else {
    delete current[context];
  }
  await setDoc(ref, { resolvedContexts: current }, { merge: true });
  if (resolved) {
    // Setzt auch das Mail-Dedup zurück (siehe api/report-bug.js
    // notifiedContextsRef): taucht der Kontext danach erneut auf, gilt das
    // als Regression und alarmiert wieder per Mail statt weiter stumm zu
    // bleiben.
    try {
      const notifiedRef = NOTIFIED_CONTEXTS_DOC(db, appId);
      const notifiedSnap = await getDoc(notifiedRef);
      const contexts = notifiedSnap.exists() ? { ...notifiedSnap.data().contexts } : {};
      if (contexts[context]) {
        delete contexts[context];
        await setDoc(notifiedRef, { contexts }, { merge: true });
      }
    } catch (e) {
      console.error('Zurücksetzen des Mail-Dedups fehlgeschlagen:', e);
    }
  }
  return current;
};

// Re-export für bestehende Importe (z.B. src/AdminPanel.jsx) — Inhalt liegt in
// errorContextInfo.js, siehe Kommentar dort.
export { ERROR_CONTEXT_INFO, getErrorContextInfo };
