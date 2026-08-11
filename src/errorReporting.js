import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const QUEUE_KEY = 'smartcraft_error_queue';
const MAX_QUEUE_LENGTH = 30;

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
  const queue = readQueue();
  queue.push({
    context,
    message: error?.message ? String(error.message) : String(error),
    stack: error?.stack ? String(error.stack).slice(0, 2000) : null,
    appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    timestamp: Date.now(),
  });
  while (queue.length > MAX_QUEUE_LENGTH) queue.shift();
  writeQueue(queue);
};

/**
 * Versucht alle lokal wartenden Fehlerreports unter dem privaten Nutzerpfad
 * in Firestore abzulegen. Reports, die (erneut) fehlschlagen, bleiben in der
 * Warteschlange und werden beim nächsten Versuch erneut probiert.
 */
export const flushErrorReports = async (db, userId, appId) => {
  if (!db || !userId || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  const queue = readQueue();
  if (queue.length === 0) return;
  const remaining = [];
  for (const report of queue) {
    try {
      const reportsCol = collection(db, 'artifacts', appId, 'users', userId, 'errorReports');
      await setDoc(doc(reportsCol), { ...report, sentAt: serverTimestamp() });
    } catch (e) {
      remaining.push(report);
    }
  }
  writeQueue(remaining);
};
