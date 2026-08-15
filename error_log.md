# Fehler-Log

Kuratierte, lesbare Übersicht aller über den PIN-geschützten Admin-Bereich
(`AdminPanel.jsx`) gemeldeten Fehler. Rohdaten liegen dauerhaft in Firestore
(`errorReports`-Collection-Group, siehe `errorReporting.js`) — diese Datei
fasst sie zusammen, damit man nicht bei jedem Blick ins Admin-Terminal alte,
längst behobene Reports erneut durchgehen muss.

**Erzeugt/aktualisiert:** manuell nach Abruf per `scripts/fetch-error-reports.mjs`
(liest read-only per anonymer Anmeldung aus Firestore, siehe Skript-Kopf).
Aufruf: `node --env-file=.env scripts/fetch-error-reports.mjs`

**Status-Werte:** `Offen` (Ursache/Fix noch ausständig) · `Beobachten` (Fix
vermutet ausreichend, noch nicht durch neue Reports bestätigt) · `Gelöst`
(Ursache behoben, mit Verweis auf Commit/CHANGELOG-Eintrag).

Stand: 2026-08-13 — Fehlersammlung in Firestore vollständig geleert (17 alte
Reports über 3 Nutzer-Pfade, größtenteils Monate/Versionsstände zurückliegend,
per `firebase firestore:delete -r`). Admin-Bereich sammelt ab jetzt nur noch
neue Reports; zusätzlich blendet ein neuer Filter ("Alte ausblenden") Reports
älter als 14 Tage standardmäßig aus (`src/AdminPanel.jsx`).

Die zuvor unten dokumentierten Fehlerbilder (`gemini-vision-api`,
`gemini-video-search-api`) waren zum Löschzeitpunkt **nicht** als behoben
bestätigt — die Rohdaten wurden nur aus Aufräumgründen entfernt, nicht weil
die Ursache behoben wurde. Falls diese Fehlerbilder erneut auftauchen, hier
neu als offener Eintrag dokumentieren.

---

## Offene Fehler

_Aktuell keine offenen Einträge._

---

## Gelöste Fehler

### 1. gemini-tts-summary-api: "API error: " (leer)

- **Status:** Gelöst (V1.24.1)
- **Kontext:** `gemini-tts-summary-api` (`callGeminiTtsSummaryAPI` in
  `src/App.jsx`, nutzt den geteilten `fetchWithRetry`-Helper)
- **Nachricht:** "API error: " ohne jeden weiteren Text (14.8.2026, 22:29 Uhr,
  V1.24.0).
- **Ursache:** `fetchWithRetry` baute die Fehlermeldung bei 429/5xx-Antworten
  nach Ausschöpfen der Retries ausschließlich aus `response.statusText`
  (`src/App.jsx`, Zeile 166). Bei HTTP/2-Antworten — so liefert Vercel
  `/api/gemini` aus — ist `statusText` laut Fetch-Spec immer ein leerer
  String, wodurch die Meldung auf "API error: " ohne Inhalt kollabierte.
  Gleiche Fehlerklasse wie bereits einmal in `callGeminiVisionAPI` (V1.22.2,
  siehe Eintrag 2 unten), diesmal aber im geteilten Retry-Helper statt im
  einzelnen Aufrufer.
- **Lösung:** Meldung ergänzt `response.status` (immer vorhanden) neben dem
  ggf. leeren `statusText`, siehe CHANGELOG `[1.24.1]`.

### 2. gemini-vision-api: "Fehler bei der KI-Anfrage oder leere Antwort." / FUNCTION_PAYLOAD_TOO_LARGE

- **Status:** Gelöst (V1.22.4)
- **Kontext:** `gemini-vision-api` (Hauptanalyse, `callGeminiVisionAPI` in
  `src/App.jsx`)
- **Nachricht:** Ursprünglich generisch "Fehler bei der KI-Anfrage oder leere
  Antwort." (3× zwischen 13.8.2026 15:58–16:07 Uhr, V1.22.0/1.22.1, sowie 4×
  zwischen V1.8.2–V1.10.0, siehe CHANGELOG `[1.14.1]`). Nach dem Error-
  Passthrough-Fix in V1.22.2 zeigte der nächste Report (13.8.2026, 16:17 Uhr,
  V1.22.3) den echten Fehler: `Request Entity Too Large` /
  `FUNCTION_PAYLOAD_TOO_LARGE`.
- **Ursache:** Vercel Serverless Functions haben ein hartes, nicht
  konfigurierbares Payload-Limit von 4,5MB. Bilder wurden unkomprimiert per
  `fileToBase64()` als Base64 an `/api/gemini` geschickt — ein
  5-12MB-Handyfoto (üblich bei modernen Android-Kameras, siehe User-Agent in
  den Reports) wird durch die Base64-Kodierung (+33%) zuverlässig größer als
  das Limit.
- **Lösung:** `fileToBase64()` skaliert Bilder jetzt vor dem Senden per
  Canvas auf max. 1600px Kantenlänge herunter und kodiert sie als JPEG
  (Qualität 0,82) neu; siehe CHANGELOG `[1.22.4]`. Zusätzlich wurde die
  generische Fehlermeldung selbst in V1.22.2 durch die tatsächliche
  Server-Antwort ersetzt (CHANGELOG `[1.22.2]`) — dieser Fix war die
  Voraussetzung dafür, die Root Cause überhaupt aus einem Report ablesen zu
  können.

<!--
### N. Kurzbeschreibung

- **Status:** Gelöst (VX.Y.Z)
- **Kontext:** …
- **Nachricht:** …
- **Ursache:** …
- **Lösung:** … (Verweis auf CHANGELOG-Eintrag/Commit)
-->
