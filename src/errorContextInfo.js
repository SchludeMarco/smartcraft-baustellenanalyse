/**
 * Bekannte Fehlerkontexte (siehe queueErrorReport-Aufrufe in App.jsx/ErrorBoundary.jsx) mit
 * kurzer Ursachen-/Lösungshilfe für den Admin-Bereich. Bewusst statisch statt per KI generiert,
 * da die Ursachen für diese Kontexte bekannt und stabil sind.
 *
 * Bewusst ohne Firebase-Import in einer eigenen Datei: wird sowohl vom Client
 * (errorReporting.js) als auch von der Node-Serverless-Function
 * (api/report-bug.js) importiert — Letztere soll nicht den kompletten
 * Firebase-Client-SDK-Baum mitbündeln müssen.
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
  'google-signin': {
    label: 'Google-Anmeldung fehlgeschlagen',
    cause: 'Google-Login abgebrochen/blockiert (Popup), Account-Linking-Konflikt (Google-Konto bereits mit anderem Nutzer verknüpft), oder Google-Provider ist in der Firebase Console nicht aktiviert.',
    fix: 'Firebase Console → Authentication → Sign-in method → prüfen, ob "Google" aktiviert ist; bei wiederholtem "credential-already-in-use" ist das erwartetes Verhalten (siehe handleGoogleSignIn in App.jsx).',
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
