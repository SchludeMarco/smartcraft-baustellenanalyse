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

_Aktuell keine — Sammlung wurde am 2026-08-13 geleert, siehe Hinweis oben.
Neue Reports über den Admin-Bereich hier eintragen, sobald sich ein
wiederkehrendes Muster zeigt._

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
