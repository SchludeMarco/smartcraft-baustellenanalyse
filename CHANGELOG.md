# Changelog

Alle nennenswerten Änderungen an Sm@rtCraft – Der Kollege in der Hosentasche, chronologisch
nach Version. Die Versionsnummer stammt einzig aus `package.json` (siehe
`CLAUDE.md`) und wird als `V{version}` im App-Header angezeigt.

Bis einschließlich V1.7.1 wurde die Version noch nicht bei jedem Commit
konsequent gepflegt — die ersten drei Einträge unten gehören alle zu
demselben Versionsstand.

## [1.14.1] – 2026-08-12

### Hinzugefügt
- **`error_log.md` als kuratiertes Fehler-Log.** Das Admin-Terminal
  (`AdminPanel.jsx`) zeigt jeden je über `queueErrorReport` gemeldeten
  Fehler unverändert für immer an — es gibt in Firestore keinen
  "gelöst"-Status, dadurch sammelten sich dort auch längst behobene
  Reports neben aktuellen an. Neue Datei `error_log.md` fasst die
  Fehlerbilder kuratiert zusammen (Kontext, Häufigkeit, betroffene
  Versionen, Ursache, Status `Offen`/`Beobachten`/`Gelöst`) und wird ab
  jetzt bei jedem Bugfix mitgepflegt (siehe `CLAUDE.md`). Neues Skript
  `scripts/fetch-error-reports.mjs` liest die Reports read-only per
  anonymer Anmeldung aus der `errorReports`-Collection-Group aus (gleicher
  Weg wie `errorReporting.js`/`AdminPanel.jsx`), Aufruf: `node --env-file=.env
  scripts/fetch-error-reports.mjs`. Erstbefüllung ergab 2 offene
  Fehlerbilder (`gemini-vision-api`: "Fehler bei der KI-Anfrage oder leere
  Antwort.", 4× zwischen V1.8.2–V1.10.0; `gemini-video-search-api`:
  "API error: ", 1× in V1.13.0) — Firestore-Reports selbst bleiben
  unangetastet als Rohdaten-Historie bestehen.

## [1.14.0] – 2026-08-12

### Hinzugefügt
- **Automatischer Mail-Versand bei Fehlerreports.** Bisher landete jeder
  `queueErrorReport`-Aufruf nur in Firestore (`errorReporting.js`) und musste im
  PIN-geschützten Admin-Bereich (`AdminPanel.jsx`) manuell per `mailto:`-Link
  weitergeleitet werden — ein Bug fiel also erst auf, wenn jemand aktiv
  nachschaute. Neue Serverless Function `api/report-bug.js` schickt jetzt
  sofort, sobald ein Fehler auftritt (`queueErrorReport` ruft im gleichen
  Zug `sendBugReportEmail` auf, egal ob am PC oder am Smartphone), eine Mail
  über die Resend-API an die Support-Adresse. Bewusst "fire and forget":
  Firestore bleibt die verlässliche Quelle (auch offline dank der
  bestehenden `localStorage`-Warteschlange), die Mail ist nur ein
  zusätzlicher Sofort-Hinweis und geht bei Netzwerkfehlern spurlos verloren,
  ohne den Report selbst zu gefährden. Gleiches Fail-open-Muster wie bei
  `api/gemini.js`: Same-Origin-Check immer aktiv, App Check + Rate-Limiting
  (5/Minute, 50/Tag pro IP) nur wenn `FIREBASE_SERVICE_ACCOUNT_KEY` gesetzt
  ist. Neue Env-Variablen `RESEND_API_KEY`, `SUPPORT_EMAIL` (fällt auf
  `VITE_ADMIN_EMAIL` zurück) und optional `RESEND_FROM_EMAIL` (siehe
  `.env.example`/README).

## [1.13.0] – 2026-08-11

### Hinzugefügt
- **Farbthema folgt dem gewählten Gewerk.** Header, Haupt-Buttons und
  Akzent-Icons/-Texte übernehmen jetzt eine gedeckte, ruhige Akzentfarbe je
  Gewerk (`TRADE_THEMES` in `src/App.jsx`) statt eines fest codierten Rot als
  Marken-/Warnfarbe zugleich — echte Warn-/Fehlerhinweise (z.B. der EU-AI-Act-
  Disclaimer) bleiben bewusst rot, damit sie als Warnung erkennbar bleiben.
  Technisch über CSS-Custom-Properties (`--accent`, `--accent-dark`,
  `--accent-soft`) gelöst, die am äußeren Container gesetzt und per
  `transition-colors duration-500/700` weich (nicht schlagartig) eingeblendet
  werden, sobald ein anderes Gewerk gewählt wird. Die fest zugeordneten
  Mehrfarben-Buttons der KI-Zusatztools (Material/Sicherheit/Video/
  Kundenbericht) sind bewusst unverändert geblieben, da sie einzelne Features
  statt der App-Marke kennzeichnen.

## [1.12.0] – 2026-08-11

### Hinzugefügt
- **Rate-Limiting + Firebase App Check für `/api/gemini`.** Der bestehende
  Origin-Check in `api/gemini.js` verhindert nur Missbrauch durch fremde
  Webseiten aus dem Browser — ein Skript, das den `Origin`-Header selbst
  setzt, kommt trivial durch. Da jeder Call einen bezahlten Gemini-API-Call
  auslöst, war das eigentliche Risiko nicht ein Server-Crash, sondern
  Kostenexplosion durch automatisierten Missbrauch. Jetzt zusätzlich:
  - **App Check** (`firebase/app-check` im Client, `firebase-admin` +
    `getAppCheck().verifyToken()` server-seitig) verifiziert, dass Requests
    tatsächlich von der eigenen Web-App kommen (reCAPTCHA v3), nicht von
    einem Skript.
  - **Rate-Limiting** über einen Firestore-Zähler pro IP
    (`_rateLimits/{ip}`, nur per Admin-SDK erreichbar): 12 Requests/Minute
    (deckt Hauptanalyse + die 4 Zusatz-Tools locker ab) und 200/Tag als
    Bremse gegen Slow-Drip-Missbrauch.
  - **Fail-open:** Ohne die neue Server-Variable
    `FIREBASE_SERVICE_ACCOUNT_KEY` verhält sich der Endpoint unverändert
    (kein Absturz direkt nach diesem Deploy). Scharf geschaltet wird erst,
    sobald `FIREBASE_SERVICE_ACCOUNT_KEY` (Service-Account-JSON) und
    `VITE_RECAPTCHA_SITE_KEY` (reCAPTCHA-v3-Key aus der App-Check-
    Registrierung) in Firebase Console + Vercel manuell hinterlegt sind —
    siehe `.env.example` für Details zu beiden Variablen.

## [1.11.0] – 2026-08-11

### Hinzugefügt
- **Admin-Bereich für Fehlerreports.** Neuer PIN-geschützter Admin-Bereich
  (`src/AdminPanel.jsx`, erreichbar über einen unauffälligen Link im
  Profil-Modal), der alle über `errorReporting.js` gesammelten Fehlerreports
  über alle Nutzer hinweg auflistet (Collection-Group-Query auf
  `errorReports`) — bisher ließen sie sich nur manuell in der Firebase
  Console einsehen, wovon niemand aktiv informiert wurde. Jeder Eintrag zeigt
  Kontext, vollständige (ausgeschriebene) Fehlermeldung, Stacktrace,
  App-Version, User-Agent sowie eine statische Ursache-/Lösungshilfe je
  bekanntem Fehlerkontext (`ERROR_CONTEXT_INFO` in `errorReporting.js`). Ein
  Button je Eintrag öffnet einen vorausgefüllten `mailto:`-Link (Ziel via
  `VITE_ADMIN_EMAIL`, Default `marco.schlude@gmail.com`) mit allen Details,
  damit der Fehler direkt an den Admin gemeldet werden kann.
  **Sicherheitshinweis:** Der PIN (`VITE_ADMIN_PIN`) ist reiner UI-Sichtschutz
  und landet im Client-Bundle. Damit die Collection-Group-Query technisch
  funktioniert, erlaubt `firestore.rules` jedem authentifizierten (auch
  anonymen) Nutzer Lesezugriff auf `errorReports` — wer die Firestore-SDK
  direkt anspricht, kommt auch ohne PIN an die Reports. Für eine spätere
  Ausrollung mit echten Fremdnutzern sollte das durch echten Admin-Login
  (fester Account + Regel auf `request.auth.uid`) ersetzt werden. Schreiben
  bleibt weiterhin ausschließlich dem jeweiligen Besitzer vorbehalten.

## [1.10.0] – 2026-08-11

### Hinzugefügt
- **Video-Anleitungs-Suche reaktiviert.** Der Button war seit Commit `cc04243`
  fest deaktiviert (`disabled={true}`), nachdem die zuvor komplett
  auskommentierte Implementierung als "toter Code" entfernt worden war und nur
  noch ein leerer Funktions-Stub übrig blieb. `callGeminiVideoSearch` ruft jetzt
  wieder den Gemini-Proxy mit Google-Search-Grounding
  (`tools: [{ google_search: {} }]`) auf, um 3-5 passende YouTube-Tutorials zur
  aktuellen Lösung zu finden. Ursache/Anpassung gegenüber der alten Fassung:
  `responseSchema`/`responseMimeType` (strukturierter JSON-Modus) lassen sich in
  der Gemini API nicht mit dem `tools`-Grounding kombinieren — das JSON-Array
  wird daher per Prompt-Anweisung erzwungen und robust per Regex aus der
  Textantwort extrahiert (Fallback-Logik war im alten Code bereits vorhanden).
  README-Abschnitte, die den Feature-Status noch als "vorbereitet, aber
  deaktiviert" beschrieben, wurden entsprechend aktualisiert.

## [1.9.3] – 2026-08-11

### Geändert
- **README stark erweitert.** Der bisherige Text beschrieb primär den
  Berufseinsatz auf der Baustelle. Ergänzt: ein eigener Abschnitt "Für wen ist
  Sm@rtCraft?", der die bereits heute vorhandene Nutzbarkeit für Privatpersonen
  zuhause (z.B. Riss im Putz, tropfender Wasserhahn, kranke Zimmerpflanze) neben
  dem Profi-Einsatz gleichwertig darstellt, sowie ein knapper
  Ablauf-in-der-Praxis-Abschnitt. Grund: die App unterscheidet technisch schon
  heute nicht zwischen Profi- und Privatnutzung — das README hat das bisher
  nicht sichtbar gemacht. Der Ausblick-Abschnitt nennt jetzt auch die geplanten
  Gewerke-Sondereditionen und die separate "Sm@rtCraft Zuhause"-Variante als
  nächste Ausbaustufe.

## [1.9.2] – 2026-08-11

### Geändert
- **Rebranding: neue Tagline "Der Kollege in der Hosentasche".** Ersetzt den
  bisherigen Untertitel "Baustellenanalyse", der zu stark auf klassische
  Baustellen-Einsätze eingegrenzt war. Grund: geplante Gewerke-Sondereditionen
  und eine Privatanwender-Variante sollen unter derselben Kernmarke laufen —
  "Baustellenanalyse" hätte das nicht mehr abgedeckt. Betroffen: `index.html`
  (Title), `src/App.jsx` (Header-Untertitel), `README.md`- und
  `CHANGELOG.md`-Titel. Der interne Firestore-`appId` (`smartcraft-
  baustellenanalyse` in `src/App.jsx`) und der npm-Paketname in `package.json`
  bleiben bewusst unverändert, da eine Änderung dort bestehende Nutzerdaten-
  Pfade in Firestore bricht bzw. keinen sichtbaren Nutzen hätte.

## [1.9.1] – 2026-08-11

### Hinzugefügt
- Diese Datei. Rekonstruiert die bisherige Versionshistorie aus der
  Git-Historie, um Problem → Ursache → Lösung pro Version nachvollziehbar
  zu machen. Wird ab jetzt bei jeder nennenswerten Änderung fortgeführt.

## [1.9.0] – 2026-08-11

### Hinzugefügt
- **Lokales Error-Reporting mit automatischem Versand.** Fehler (React-Crashes,
  Firebase-Init/Auth-Fehler, alle vier Gemini-API-Aufrufe) werden zuerst in
  einer `localStorage`-Warteschlange gepuffert (`src/errorReporting.js`).
  Sobald eine authentifizierte Firestore-Verbindung besteht — beim App-Start,
  bei Wiederherstellung der Internetverbindung (`online`-Event) oder direkt
  im Anschluss an den Fehler, falls ohnehin schon online — werden sie
  automatisch unter dem privaten Nutzerpfad
  (`artifacts/{appId}/users/{userId}/errorReports`) abgelegt. Bewusst nicht
  angebunden an einfache Validierungsmeldungen (z.B. "Bild zu groß"), nur an
  echte technische Fehler.
  Idee und Anstoß dazu kamen vom Projektinhaber, gedacht für den
  Baustellen-Alltag mit unzuverlässiger Verbindung.

### Infrastruktur-Fix (kein Code-Commit, aber Teil dieser Version)
- **Problem:** Firestore Database war im Firebase-Projekt nie angelegt bzw.
  die lokale `firestore.rules`-Datei nie in der Firebase Console
  veröffentlicht. Symptom: `FirebaseError: Missing or insufficient
  permissions` beim Laden des Nutzerprofils, der Historie und (neu) beim
  Senden von Error-Reports.
  **Lösung:** Firestore Database im Firebase Console manuell angelegt
  (Produktionsmodus, Region `europe-west3`) und den Inhalt von
  `firestore.rules` im Rules-Editor veröffentlicht.

### Bekannt, aber (noch) nicht behoben
- Vereinzelte Race Condition: der allererste Profil-Ladeversuch direkt nach
  dem anonymen Login schlägt manchmal noch mit `permission-denied` fehl
  (Auth-Token vermutlich noch nicht vollständig propagiert). Nicht
  blockierend, fällt still auf den Standard-Gewerk-Wert zurück.
- Problembeschreibungs-Textfeld ist im UI unsichtbar, bis entweder ein Bild
  ausgewählt oder das Feld selbst schon Text enthält (Henne-Ei-Problem) —
  wodurch eine reine Text-Analyse ohne Foto aktuell über die UI nicht
  auslösbar ist, obwohl die Willkommensmeldung das als gültige Option nennt.
- Für die Error-Reports gibt es noch kein Auswertungs-Dashboard; sie landen
  als Rohdokumente in der Firestore-Konsole.

## [1.8.2] – 2026-08-11

### Behoben
- **Retry-Logik invertiert:** `fetchWithRetry` brach bei HTTP-Status
  502/503/504 sofort ab, anstatt es erneut zu versuchen — genau der
  Statuscode, den die eigene Serverless-Function (`api/gemini.js`) bei
  einem Upstream-Fehler zurückgibt. Die Wiederholungs-Bedingung war
  falsch herum formuliert.
- **Datei-Input-Reset betraf nur ein Feld:** `handleReset` setzte wegen
  eines `||`-Kurzschlusses immer nur `camera-input` zurück. Wurde ein Bild
  über "Galerie" gewählt, ließ sich dieselbe Datei danach nicht erneut
  auswählen (kein `change`-Event bei unverändertem Wert). Jetzt werden
  alle drei Datei-Inputs (Kamera/Galerie/Cloud) einzeln geleert.

### Geändert
- **Tailwind CSS läuft nicht mehr über die Play-CDN**
  (`<script src="https://cdn.tailwindcss.com">`), sondern wird per
  `@tailwindcss/vite` zur Build-Zeit kompiliert. Die CDN-Variante ist laut
  Tailwind selbst nur für Prototyping gedacht: JIT-Compiling im Browser,
  kein Purging, und ohne Zugriff auf die CDN (z.B. schlechte Verbindung auf
  der Baustelle) rendert die App komplett ungestyled.
- Hintergrundbild-Container haben jetzt eine Fallback-Hintergrundfarbe,
  falls die externe Bild-URL mal nicht lädt.
- Toter Code entfernt: die nie aktive TTS-Funktionalität (WAV-Encoder,
  State, Cleanup-Logik) sowie der komplett auskommentierte
  Video-Suche-Block.

### Hinzugefügt
- React `ErrorBoundary`-Komponente fängt unerwartete Rendering-Fehler ab
  (z.B. bei fehlerhafter Firebase-Config) und zeigt eine Fehlermeldung mit
  Neu-laden-Button statt eines weißen Bildschirms.

## [1.8.1] – 2026-08-11

### Behoben
- **Offener Gemini-Proxy:** `api/gemini.js` nahm Requests von jeder
  beliebigen Seite an, ohne Origin-, Auth- oder Rate-Limit-Prüfung. Da der
  Server-seitige `GEMINI_API_KEY` dahintersteckt, hätte das fremden Seiten
  erlaubt, das API-Kontingent/die Kosten des Projekts zu belasten. Der
  Endpoint lehnt jetzt Requests ab, deren `Origin`-Header nicht zum `Host`
  passt.
- **Wirkungsloser Firebase-Config-Check:** `Object.keys(firebaseConfig).length
  === 0` war nie `true`, weil das Config-Objekt immer alle 7 Keys besitzt
  (auch wenn die Werte `undefined` sind). Fehlten die `VITE_FIREBASE_*`
  Env-Variablen, crashte `initializeApp()` ungefangen. Jetzt werden die
  Pflichtfelder (`apiKey`, `projectId`) geprüft und die Initialisierung
  zusätzlich per `try/catch` abgesichert.

## [1.8.0] – 2026-08-11

### Hinzugefügt
- Dismiss-Button (X) in der Analysefehler-Box, der nur den Fehlerzustand
  zurücksetzt statt des kompletten Formulars inklusive bereits gewähltem
  Foto.
- Einheitliche Versionierung: die App-Version wird jetzt einzig aus
  `package.json` gelesen (`vite.config.js` → `define: { __APP_VERSION__ }`)
  statt an mehreren Stellen im Code hartcodiert zu sein.
- `CLAUDE.md` mit Projekt-Regeln für automatisches Commit/Push und
  Versionierung angelegt.

## [1.7.1] – 2026-08-10

### Hinzugefügt
- **Initialer Import:** Migration von einem Google-AI-Studio-Canvas-Export
  zu einem eigenständigen Vite/React-Projekt. Gemini-Aufrufe laufen seitdem
  über einen Vercel-Serverless-Proxy, damit der API-Key nie im Browser
  sichtbar ist; die Firebase-Config kommt aus echten Env-Variablen statt
  aus von Canvas injizierten globalen Variablen.
- README komplett neu geschrieben: vollständiger Funktionsumfang
  (Gewerk-Auswahl, Diagnose, Materialliste, Sicherheits-Check,
  Kundenbericht, PDF-Export, Historie) sowie die persönliche Motivation
  hinter dem Projekt dokumentiert.
- Kamera-Aufnahme: der "Foto wählen"-Button öffnet jetzt über
  `capture="environment"` direkt die Rückkamera auf Mobilgeräten, statt nur
  eine generische Dateiauswahl zu zeigen — passend zum eigentlichen
  Use-Case (Foto vor Ort schießen, nicht aus vorhandener Galerie wählen).
  Der separate Galerie-Button bleibt für bereits vorhandene Fotos erhalten.
