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

### 1. gemini-vision-api: "Fehler bei der KI-Anfrage oder leere Antwort."

- **Status:** Offen
- **Kontext:** `gemini-vision-api` (Hauptanalyse, `callGeminiVisionAPI` in
  `src/App.jsx`)
- **Zeitpunkt/Version:** 13.8.2026, 15:58 Uhr, V1.22.0, Android/Chrome Mobile
- **Nachricht:** "Fehler bei der KI-Anfrage oder leere Antwort."
- **Vermutliche Ursache:** Dieses Fehlerbild trat bereits 4× zwischen
  V1.8.2–V1.10.0 auf (siehe CHANGELOG `[1.14.1]`) und wurde beim
  Firestore-Cleanup am 2026-08-13 **nicht** als behoben bestätigt, sondern
  nur aus der Sammlung entfernt. `src/App.jsx:828-831` wirft diese generische
  Meldung sowohl bei leerer Antwort als auch bei jedem `!response.ok` von
  `/api/gemini` — d.h. sie deckt gleichermaßen App-Check-Fehler (401),
  Origin-Check (403, `api/gemini.js:92`), Rate-Limit (429), fehlenden
  `GEMINI_API_KEY` (500) und Upstream-Fehler von Gemini selbst (502/4xx) ab.
  Ohne Vercel-Logs zum konkreten Report-Zeitpunkt lässt sich die genaue
  Ursache von hier aus nicht eingrenzen.
- **Lösungsansatz:** Vercel-Logs für `/api/gemini` um 13.8.2026 15:58 Uhr
  prüfen (welcher HTTP-Status kam zurück?), `GEMINI_API_KEY`-Gültigkeit/
  -Kontingent kontrollieren.
- **Update (V1.22.2):** Die generische Client-Fehlermeldung wurde durch die
  tatsächliche Server-Antwort (Status/Fehlertext von `/api/gemini`) ersetzt
  (siehe CHANGELOG `[1.22.2]`). Die eigentliche Root Cause dieses konkreten
  Reports vom 13.8.2026 bleibt aber offen, da der Report selbst vor diesem
  Fix erstellt wurde und keine Status-/Detailinfo enthält — bei erneutem
  Auftreten liefert der nächste Report jetzt genug Detail, um direkt
  einzugrenzen (401/403/429/500/502).

---

## Gelöste Fehler

_Noch keine Einträge — sobald ein Fehler behoben ist, hierher verschieben und
mit Lösung + Versionsverweis ergänzen, siehe Vorlage unten._

<!--
### N. Kurzbeschreibung

- **Status:** Gelöst (VX.Y.Z)
- **Kontext:** …
- **Nachricht:** …
- **Ursache:** …
- **Lösung:** … (Verweis auf CHANGELOG-Eintrag/Commit)
-->
