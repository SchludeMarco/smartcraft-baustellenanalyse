# Projekt-Anweisungen für Claude

## Versionierung

`package.json` (`version`) ist die einzige Quelle für die App-Version. Sie wird
zur Build-Zeit über `vite.config.js` (`define: { __APP_VERSION__ }`) eingelesen
und in `src/App.jsx` im Header angezeigt (`(V{__APP_VERSION__})`). Nirgendwo
sonst im Code hardcoden — bei Bedarf `README.md`-Titel manuell nachziehen,
da diese Datei nicht automatisch aus `package.json` generiert wird.

## Changelog

`CHANGELOG.md` dokumentiert die Versionshistorie (Problem → Ursache → Lösung
je Eintrag, gruppiert nach Version). Bei jedem Versions-Bump (siehe unten)
einen passenden Eintrag ergänzen — nicht nur committen, ohne die Datei
nachzuziehen.

## Automatisches Commit & Push

Nach Abschluss einer sinnvollen Arbeitseinheit (z.B. ein Feature, ein Bugfix,
eine abgeschlossene Anfrage) **ohne erneutes Nachfragen**:

1. Version in `package.json` per Semver bumpen:
   - **patch** für Bugfixes, kleine Anpassungen, Doku
   - **minor** für neue Features
   - **major** nur auf explizite Anweisung (Breaking Change)
2. `CHANGELOG.md` um einen Eintrag für die neue Version ergänzen.
3. Änderungen committen mit einer knappen, aussagekräftigen Message
   (Stil der bisherigen Commits: `feat: ...`, `fix: ...`, `docs: ...`).
4. Nach `origin/master` pushen.

Gilt nicht bei erkennbar unfertigem/kaputtem Zwischenstand (z.B. Build schlägt
fehl, Task noch explizit offen) — dann erst fertigstellen, dann committen/pushen.
Destruktive Git-Operationen (force-push, reset --hard, Branches löschen) bleiben
weiterhin nur nach expliziter Bestätigung erlaubt.
