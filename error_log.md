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

Stand: 2026-08-12, Datenabruf über `scripts/fetch-error-reports.mjs` (5 Reports
in Firestore, verteilt auf 2 Fehlerbilder).

---

## Offene Fehler

### 1. Bildanalyse liefert "Fehler bei der KI-Anfrage oder leere Antwort."

- **Status:** Offen
- **Kontext:** `gemini-vision-api` (Haupt-KI-Aufruf, Bildanalyse)
- **Nachricht:** `Fehler bei der KI-Anfrage oder leere Antwort.`
- **Häufigkeit:** 4 Reports
- **Betroffene Versionen:** V1.8.2 (lokal, `localhost:5173`), V1.9.1 (2×),
  V1.10.0
- **Zeitraum:** 2026-08-11 11:17 Uhr – 2026-08-11 12:23 Uhr
- **Ursache (laut `errorContextInfo.js`):** `/api/gemini` nicht erreichbar,
  Gemini-API-Fehler/Timeout, oder Antwort nicht im erwarteten Format.
- **Nächste Schritte:** Vercel-Logs für `/api/gemini` im betroffenen Zeitraum
  prüfen, Gültigkeit/Kontingent von `GEMINI_API_KEY` kontrollieren. Da alle
  4 Reports vor dem Rate-Limiting/App-Check-Umbau (V1.12.0) und dem
  automatischen Mail-Versand (V1.14.0) liegen, unklar ob seither noch
  aufgetreten — bislang kein neuer Report seit V1.10.0.

### 2. Video-Suche liefert "API error: " (leere Fehlermeldung)

- **Status:** Offen
- **Kontext:** `gemini-video-search-api` (Google-Search-Grounding für
  Video-Anleitungen)
- **Nachricht:** `API error: ` (Meldungstext selbst leer)
- **Häufigkeit:** 1 Report
- **Betroffene Version:** V1.13.0
- **Zeitpunkt:** 2026-08-11 22:50 Uhr
- **Ursache (laut `errorContextInfo.js`):** Google-Search-Grounding lieferte
  keine verwertbare/parsbare Antwort, oder die API-Anfrage schlug fehl.
- **Nächste Schritte:** Antworttext in der Browser-Konsole bzw. den
  Vercel-Logs prüfen; ggf. Regex-Extraktion in `callGeminiVideoSearch`
  (`src/App.jsx`) robuster gegen leere/unerwartete Antwortformate machen.

---

## Gelöste Fehler

_Noch keine Einträge — sobald einer der obigen (oder ein neuer) Fehler
behoben ist, hierher verschieben und mit Lösung + Versionsverweis ergänzen,
siehe Vorlage unten._

<!--
### N. Kurzbeschreibung

- **Status:** Gelöst (VX.Y.Z)
- **Kontext:** …
- **Nachricht:** …
- **Ursache:** …
- **Lösung:** … (Verweis auf CHANGELOG-Eintrag/Commit)
-->
