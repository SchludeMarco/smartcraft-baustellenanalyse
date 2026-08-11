import { collection, collectionGroup, doc, setDoc, getDocs, serverTimestamp } from 'firebase/firestore';

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

/**
 * Bekannte Fehlerkontexte (siehe queueErrorReport-Aufrufe in App.jsx/ErrorBoundary.jsx) mit
 * kurzer Ursachen-/Lösungshilfe für den Admin-Bereich. Bewusst statisch statt per KI generiert,
 * da die Ursachen für diese Kontexte bekannt und stabil sind.
 */
export const ERROR_CONTEXT_INFO = {
  'firebase-init': {
    label: 'Firebase-Initialisierung fehlgeschlagen',
    cause: 'Firebase-Konfiguration (VITE_FIREBASE_*) fehlt/ungültig, oder das Firebase-Projekt ist nicht erreichbar.',
    fix: 'Env-Variablen in .env bzw. Vercel-Projekteinstellungen prüfen; Firebase-Projektstatus in der Console kontrollieren.',
  },
  'firebase-auth': {
    label: 'Anonyme Anmeldung fehlgeschlagen',
    cause: 'Anonyme Anmeldung ist in der Firebase Console nicht aktiviert, oder es gab ein Netzwerkproblem beim Login.',
    fix: 'Firebase Console → Authentication → Sign-in method → prüfen, ob "Anonym" aktiviert ist.',
  },
  'gemini-vision-api': {
    label: 'Bildanalyse (Haupt-KI-Aufruf) fehlgeschlagen',
    cause: '/api/gemini nicht erreichbar, Gemini-API-Fehler/Timeout, oder Antwort nicht im erwarteten Format.',
    fix: 'Vercel-Logs für /api/gemini prüfen, Gültigkeit/Kontingent von GEMINI_API_KEY kontrollieren.',
  },
  'gemini-materials-api': {
    label: 'Materialliste-Generierung fehlgeschlagen',
    cause: 'Gemini konnte keine valide JSON-Materialliste liefern, oder die API-Anfrage schlug fehl.',
    fix: 'Antworttext in der Browser-Konsole prüfen; ggf. Prompt/Schema in SYSTEM_INSTRUCTION_MATERIAL justieren.',
  },
  'gemini-safety-api': {
    label: 'Sicherheits-Check-Generierung fehlgeschlagen',
    cause: 'Gemini-API-Fehler/Timeout beim Erzeugen des Sicherheits-Checks.',
    fix: 'Vercel-Logs für /api/gemini prüfen; bei wiederholtem Auftreten Prompt-Länge/Kontingent kontrollieren.',
  },
  'gemini-client-report-api': {
    label: 'Kundenbericht-Generierung fehlgeschlagen',
    cause: 'Gemini-API-Fehler/Timeout beim Erzeugen des Kundenberichts.',
    fix: 'Vercel-Logs für /api/gemini prüfen; bei wiederholtem Auftreten Prompt-Länge/Kontingent kontrollieren.',
  },
  'gemini-video-search-api': {
    label: 'Video-Suche fehlgeschlagen',
    cause: 'Google-Search-Grounding lieferte keine verwertbare/parsbare Antwort, oder die API-Anfrage schlug fehl.',
    fix: 'Antworttext in der Browser-Konsole prüfen; Regex-Extraktion in callGeminiVideoSearch ggf. anpassen.',
  },
  'react-error-boundary': {
    label: 'Unerwarteter React-Crash',
    cause: 'Ein Rendering-Fehler in der UI (z.B. unerwartete/fehlende Daten) hat die App zum Absturz gebracht.',
    fix: 'Stacktrace unten prüfen, betroffene Komponente identifizieren und Datenvalidierung ergänzen.',
  },
};

export const getErrorContextInfo = (context) =>
  ERROR_CONTEXT_INFO[context] || {
    label: context || 'Unbekannter Fehlerkontext',
    cause: 'Kein Eintrag für diesen Kontext hinterlegt.',
    fix: '—',
  };
