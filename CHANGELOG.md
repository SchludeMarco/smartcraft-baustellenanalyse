# Changelog

Alle nennenswerten Änderungen an Sm@rtCraft – Der Kollege in der Hosentasche, chronologisch
nach Version. Die Versionsnummer stammt einzig aus `package.json` (siehe
`CLAUDE.md`) und wird als `V{version}` im App-Header angezeigt.

Bis einschließlich V1.7.1 wurde die Version noch nicht bei jedem Commit
konsequent gepflegt — die ersten drei Einträge unten gehören alle zu
demselben Versionsstand.

## [1.25.6] – 2026-08-15

### Behoben
- **Rest-Kontingent-Hinweis im Analyseergebnis auf dem Smartphone unsichtbar.**
  Backend liefert den Live-Wert inzwischen korrekt (bestätigt), auf dem Handy
  war unter "Lösung und Diagnose" trotzdem nichts zu sehen. Verdächtigt:
  das negative `-mt-4`-Margin auf der Hinweis-Zeile, das sie zu dicht an die
  Überschrift heranzog und auf schmalen Viewports vermutlich optisch damit
  verschmelzen ließ. Entfernt — die Zeile nutzt jetzt den normalen
  `space-y-6`-Abstand der übrigen Ergebnis-Sektion.

## [1.25.5] – 2026-08-15

### Behoben
- **`maxDuration`-Erhöhung allein löste das 503 bei `/api/gemini` nicht.**
  Nach V1.25.4 trat derselbe plattformseitige 503 (leeres Log, keine eigene
  Fehlermeldung) weiterhin bei jedem Versuch auf, unabhängig vom Timeout.
  Tatsächliche Ursache gefunden: `checkRateLimit()` (die Firestore-
  Transaktion fürs Rate-Limiting) lief **ungeschützt außerhalb jedes
  try/catch** im Handler — anders als der Upstream-Gemini-Aufruf, der schon
  seit Erstversion sauber abgefangen wurde. Ein dort auftretender Fehler
  (Firestore-Transaktion) crashte die gesamte Function unbehandelt, was
  Vercel als generisches 503 ohne jede eigene Log-Zeile ausliefert — daher
  die zuvor völlig leeren `logs`-Arrays in `vercel logs --json`. Lösung: Der
  komplette Handler-Body liegt jetzt in einem try/catch; jeder unerwartete
  Fehler landet als sauberes `500`-JSON mit `console.error`-Log statt eines
  stillen Absturzes — macht die eigentliche Fehlerursache beim nächsten
  Auftreten direkt sichtbar.

## [1.25.4] – 2026-08-15

### Behoben
- **`/api/gemini` schlug nach Aktivierung von App Check regelmäßig mit
  plattformseitigem 503 fehl.** Ursache: Vercels Default-Timeout für
  Serverless Functions liegt bei 10s. Solange App Check/Rate-Limiting
  fail-open (mangels korrekt konfiguriertem `FIREBASE_SERVICE_ACCOUNT_KEY`/
  `VITE_RECAPTCHA_SITE_KEY`) inaktiv liefen, reichte das knapp. Mit aktiver
  App-Check-Verifikation (Netzwerk-Roundtrip zu Firebase) und der
  Firestore-Transaktion fürs Rate-Limiting VOR dem eigentlichen, oft mehrere
  Sekunden dauernden Gemini-Vision-Aufruf wurde das Limit regelmäßig
  gerissen — sichtbar als 503 ohne jede eigene Fehlermeldung im Vercel-Log
  (`vercel logs --json` zeigte den Status, aber ein leeres `logs`-Array).
  Lösung: `export const config = { maxDuration: 30 }` in `api/gemini.js`.
- **`/api/demo-status` lieferte durchgehend 403 statt eines Rest-Stands.**
  Ursache: Der Origin-Check (identisches Muster wie `api/gemini.js`) verlangte
  einen `Origin`-Header — den schicken Browser bei einfachen `GET`-Requests
  ohne Custom-Header aber nicht zuverlässig mit (anders als bei den
  `POST`-Requests an `/api/gemini`, die immer einen Origin-Header mitbringen).
  Lösung: Fällt jetzt zusätzlich auf den `Referer`-Header zurück, bevor eine
  Anfrage als fremd abgelehnt wird.

## [1.25.3] – 2026-08-15

### Behoben
- **App-Check-Token-Fehler waren für den Admin komplett unsichtbar.**
  Problem: Schlägt `getAppCheckToken()` in `fetchWithRetry` fehl (z.B. weil
  die Domain nicht bei reCAPTCHA hinterlegt ist oder die Web-App noch nicht
  in Firebase App Check registriert war), landete das bisher nur per
  `console.error` in der Browser-Konsole — jede nachfolgende
  `/api/gemini`-Anfrage scheiterte danach mit 401, ohne dass im Admin-Bereich
  (`AdminPanel.jsx`) irgendein Hinweis darauf zu sehen war. Lösung: Der
  Fehler wird jetzt zusätzlich per `queueErrorReport('app-check-token', e)`
  erfasst (neuer Kontext in `errorContextInfo.js` mit Ursachen-/Lösungshinweis)
  und landet dadurch wie jeder andere Fehler im Admin Panel und (sofern
  `RESEND_API_KEY` konfiguriert ist) per Mail. **Nebenbefund:** `RESEND_API_KEY`
  ist im aktuellen Vercel-Projekt nicht gesetzt — die automatische
  Mail-Benachrichtigung bei Fehlerreports läuft dadurch aktuell ins Leere
  (Firestore/Admin-Panel-Weg ist davon unabhängig und funktioniert).

## [1.25.2] – 2026-08-15

### Behoben
- **Rest-Kontingent-Hinweis im Analyseergebnis blieb komplett leer.** Ursache:
  Die Zeile aus V1.25.1 wurde nur gerendert, wenn `demoRemaining` bekannt war
  — ohne Fallback für den Fall `null`. In Produktion ist `demoRemaining`
  aber immer `null`, weil `FIREBASE_SERVICE_ACCOUNT_KEY` in den
  Vercel-Projekteinstellungen nicht gesetzt ist (per `vercel env ls`
  bestätigt) und `api/gemini.js`/`api/demo-status.js` das Tracking dadurch
  komplett übersprungen (Fail-open-Verhalten). Lösung: Die Zeile zeigt jetzt
  bei fehlendem Live-Wert ersatzweise die statische Obergrenze statt gar
  nichts. **Wichtiger, eigentlicher Befund:** Ohne `FIREBASE_SERVICE_ACCOUNT_KEY`
  (und `VITE_RECAPTCHA_SITE_KEY`, ebenfalls nicht gesetzt) ist das
  Demo-Kontingent aus `DEMO_LIFETIME_MAX` in Produktion aktuell gar nicht
  durchgesetzt — nur der Origin-Check schützt `/api/gemini` derzeit. Für
  echten Kostenschutz beim öffentlichen Teilen des Links müssen beide
  Variablen noch in den Vercel-Projekteinstellungen ergänzt werden (siehe
  README, Abschnitt "Deployment (Vercel)").

## [1.25.1] – 2026-08-15

### Hinzugefügt
- **Hinweis aufs Demo-Kontingent auch direkt im Analyseergebnis.** Problem:
  Der Live-Zähler aus V1.25.0 aktualisierte sich zwar nach jeder Anfrage,
  stand aber nur im wegklickbaren Banner ganz oben — einmal dismisst oder
  aus dem Blickfeld gescrollt, blieb der neue Rest-Stand nach einer Analyse
  unbemerkt. Lösung: Direkt unter der "Lösung und Diagnose"-Überschrift im
  Analyseergebnis steht jetzt zusätzlich "Noch X von 30 kostenlosen
  KI-Anfragen für dieses Gerät übrig" — erscheint bei jeder abgeschlossenen
  Hauptanalyse neu, unabhängig vom Banner-Status.

## [1.25.0] – 2026-08-15

### Hinzugefügt
- **Live-Zähler fürs Demo-Kontingent statt statischer Zahl.** Problem: Der
  Banner aus V1.24.4 zeigte nur die feste Obergrenze (30) — wie viele
  KI-Anfragen ein Besucher tatsächlich noch übrig hat, blieb unklar, bis eine
  Analyse mit 403 fehlschlug. Lösung: Ein neuer, rein lesender Endpoint
  (`api/demo-status.js`) liest beim App-Start den aktuellen Stand aus
  `_rateLimits/{ip}.lifetimeCount`, ohne ihn zu erhöhen. `api/gemini.js`
  schickt zusätzlich nach jeder Anfrage (Erfolg wie Fehler) den aktuellen
  Rest-Stand als `X-Demo-Remaining`-Header mit. Der Banner zeigt jetzt "Noch
  X von 30 kostenlosen KI-Anfragen übrig" und aktualisiert sich nach jeder
  Analyse/jedem Zusatz-Tool. `DEMO_LIFETIME_MAX` wurde dafür nach
  `shared/demoLimit.js` ausgelagert (Single Source of Truth für
  `api/gemini.js`, `api/demo-status.js` und den Client-Banner), damit die
  angezeigte Obergrenze nie von der serverseitig durchgesetzten abweicht.

## [1.24.4] – 2026-08-15

### Hinzugefügt
- **Hinweis auf das Demo-Kontingent direkt beim App-Start.** Problem: Beim
  Teilen des Vercel-Links (z.B. LinkedIn) erfuhren Erstbesucher vom
  lebenslangen Limit aus `DEMO_LIFETIME_MAX` (`api/gemini.js`, 30
  KI-Anfragen/Gerät) erst, wenn eine Analyse mit 403 fehlschlug — kein
  Hinweis vorab. Lösung: Ein wegklickbarer, blauer Info-Banner ("Kostenlose
  Vorschau") oberhalb des EU-AI-Act-Haftungsausschlusses informiert jetzt
  schon beim ersten Öffnen über das Limit, statt Nutzer erst beim
  Fehlschlagen zu überraschen.

## [1.24.3] – 2026-08-15

### Geändert
- **UI-Begriff "Gewerk" durch "Beruf" ersetzt.** Grund: "Gewerk" wirkt als
  Bau-/Ausschreibungsjargon sperrig, gerade für Privatnutzer ohne
  Handwerksausbildung. "Beruf" ist eingängiger und passt genauso zur
  bestehenden Auswahl (Klempner, Elektriker, ...). Betrifft alle
  UI-Texte in `App.jsx` (Berufsauswahl, PDF-Export, YouTube-Suche,
  Verlaufsliste) sowie die entsprechenden Stellen in `README.md`.

## [1.24.2] – 2026-08-15

### Geändert
- **`fetchWithRetry` wiederholt 429-Antworten nicht mehr automatisch.**
  Grund: Der serverseitige Rate-Limiter (`api/gemini.js`) zählt in einem
  festen 60-Sekunden-Fenster; die bisherigen bis zu 3 automatischen Retries
  (≈7s Backoff) lagen garantiert noch im selben Fenster und scheiterten
  daher immer erneut — sie verschärften den Verbrauch des Fensters sogar
  zusätzlich, wenn mehrere Tools kurz hintereinander liefen (Hauptanalyse +
  Zusatz-Tools). Beobachtet als "auffällig funktioniert ein erneuter Klick
  auf 'Vorlesen' einfach so" — der zweite, manuelle Klick kam schlicht erst,
  nachdem das Rate-Limit-Fenster zurückgesetzt war. Nur echte 5xx-Serverfehler
  und Netzwerkfehler werden weiterhin automatisch wiederholt; bei 429 (und
  anderen 4xx) bekommt der Aufrufer die Antwort direkt und liest die
  Klartext-Fehlermeldung aus dem Response-Body — analog dazu jetzt auch in
  `callGeminiTtsSummaryAPI` die gleiche JSON-Fehler-Klartext-Extraktion wie
  bei den übrigen 5 API-Aufrufern.

## [1.24.1] – 2026-08-15

### Geändert
- **Aussagekräftigere Fehlermeldung bei 429/5xx-Antworten in `fetchWithRetry`.**
  Nach Ausschöpfen der Retries warf `fetchWithRetry` (`App.jsx`) bislang
  `API error: ${response.statusText}` — auf HTTP/2-Antworten (so liefert
  Vercel `/api/gemini` aus) ist `statusText` laut Spec immer leer, wodurch im
  Error-Report nur der nichtssagende Text "API error:" ankam (siehe Report
  im Kontext `gemini-tts-summary-api`, 14.8.2026 22:29 Uhr, V1.24.0). Die
  Meldung enthält jetzt zusätzlich den numerischen Status
  (`API error: 429`/`API error: 500 Internal Server Error`).

## [1.24.0] – 2026-08-14

### Hinzugefügt
- **Akustischer Hinweis nach Analyse-Abschluss.** Bei einer erfolgreichen
  Bauproblem-Analyse (`callGeminiVisionAPI` in `App.jsx`) ertönt jetzt ein
  kurzer "Bling"-Ton, sobald die Lösung eintrifft — nützlich, wenn man
  während der Wartezeit den Tab gewechselt hat und sonst nicht mitbekommt,
  dass das Ergebnis fertig ist. Der Ton wird per Web Audio API synthetisch
  erzeugt (`playCompletionSound`, zwei kurze Sinustöne), damit kein
  zusätzliches Audio-Asset ausgeliefert werden muss.

## [1.23.1] – 2026-08-14

### Geändert
- **Namens-Konsolidierung auf "Sm@rtCraft".** Der lokale Projektordner trug
  versehentlich den Tippfehler "Sm@artcraft" (ein "a" zu viel). Im
  PDF-Export (`handleExportPdf` in `App.jsx`) standen zudem noch zwei
  Stellen mit "SM@RTCRAFT" in Großbuchstaben (Titel-Tag, Fußzeile) —
  inkonsistent zur sonst überall bereits korrekten Schreibweise
  "Sm@rtCraft". Der npm-Paketname in `package.json` wurde von
  `smartcraft-baustellenanalyse` (Relikt der alten, seit V1.9.2 abgelösten
  Tagline) auf `smartcraft` verkürzt — `@` ist in npm-Paketnamen nicht
  erlaubt, daher als technisches Kürzel ohne Sonderzeichen. Firebase-/GCP-
  Projekt-ID (`smartcraft-baustellenanalyse`) sowie der Firestore-`appId`-
  Pfad in `App.jsx` bleiben bewusst unverändert, da beide nicht umbenennbar
  sind bzw. eine Änderung bestehende Nutzerdaten (Analyse-Historie,
  Fehlerreports, Profile) von ihrem Firestore-Pfad trennen würde — siehe
  Begründung bereits in V1.9.2.

## [1.23.0] – 2026-08-13

### Hinzugefügt
- **Serverseitiges Demo-Kontingent für `/api/gemini`.** Bisher lief das
  bestehende IP-basierte Rate-Limiting (12/Minute, 200/Tag) nach jedem
  Fenster automatisch zurück — für den öffentlich geteilten Vercel-Link
  (z.B. LinkedIn) hätte damit jede IP dauerhaft kostenpflichtige Anfragen
  stellen können. Der bestehende Firestore-Zähler pro IP (`_rateLimits/{ip}`)
  führt jetzt zusätzlich einen nie zurückgesetzten `lifetimeCount`; ab
  `DEMO_LIFETIME_MAX` (30 Anfragen, siehe `api/gemini.js`) antwortet der
  Endpoint mit `403` statt `429` und einer Klartext-Meldung
  ("Demo-Kontingent erreicht ..."). Bewusst `403` statt `429`: `fetchWithRetry`
  in `src/App.jsx` wiederholt 429/5xx automatisch mit Backoff, ein
  aufgebrauchtes Demo-Kontingent ist aber endgültig und soll nicht erst
  drei Retries lang hängen. Zusätzlich zeigen alle Gemini-Aufrufstellen in
  `src/App.jsx` jetzt die vom Server gelieferte `error`-Klartextmeldung an,
  statt den rohen JSON-Antworttext in die Fehlermeldung einzubetten.

## [1.22.4] – 2026-08-13

### Behoben
- **Root Cause für `gemini-vision-api`-Fehler gefunden und behoben:
  `FUNCTION_PAYLOAD_TOO_LARGE`.** Dank des verbesserten Error-Passthroughs
  aus `[1.22.2]` enthielt der nächste Report (16:17 Uhr) erstmals den echten
  Fehler statt der generischen Meldung: Vercel Serverless Functions haben
  ein hartes, nicht konfigurierbares Payload-Limit von 4,5MB. Bilder wurden
  bisher unkomprimiert per `fileToBase64()` als Base64 an `/api/gemini`
  geschickt — ein 5-12MB-Handyfoto (üblich bei modernen Android-Kameras)
  wird durch die Base64-Kodierung (+33%) zuverlässig größer als das Limit.
  `fileToBase64()` in `src/App.jsx` skaliert Bilder jetzt vor dem Senden per
  Canvas auf max. 1600px Kantenlänge herunter und kodiert sie als JPEG
  (Qualität 0,82) neu; die Roh-Datei-Obergrenze im Upload-Dialog wurde von
  5MB auf 20MB angehoben, da nicht mehr die Rohdatei, sondern das
  komprimierte Ergebnis versendet wird. Per Playwright-Test verifiziert:
  ein synthetisches 6,4MB-Rauschbild wurde auf ~930KB reduziert (86%
  kleiner), Vorschau blieb intakt, keine Konsolenfehler.
- **Beim Testen entdeckt: `new Image()` griff auf die falsche `Image`.**
  `src/App.jsx` importiert bereits ein Lucide-Icon namens `Image` (Zeile 3),
  das den globalen `Image`-Konstruktor im Modul-Scope überschattet —
  `new Image()` in der neuen Resize-Logik warf dadurch zur Laufzeit "Image
  is not a constructor" (baute aber fehlerfrei, da syntaktisch gültig). Fix:
  explizit `new window.Image()`.

## [1.22.3] – 2026-08-13

### Dokumentation
- **`error_log.md`: zweites `gemini-vision-api`-Auftreten vermerkt.** Report
  von 16:07 Uhr, noch auf V1.22.1 — lief 46s nach Push des Fixes aus
  `[1.22.2]` noch auf dem alten Vercel-Deploy vor dem Rollout, daher kein
  Hinweis auf Wirkungslosigkeit des Fixes. Root Cause weiterhin offen, bis
  ein Report mit V1.22.2+ mehr Detail liefert. Nur Dokumentation, kein Code
  geändert.

## [1.22.2] – 2026-08-13

### Behoben
- **Fehlermeldungen bei Gemini-Anfragen verschluckten die echte Ursache.**
  `callGeminiVisionAPI`, `callGeminiMaterialsAPI`, `callGeminiSafetyAPI`,
  `callGeminiClientReportAPI` und `callGeminiVideoSearch` in `src/App.jsx`
  ermittelten bei einem `!response.ok`/leeren Response bereits die konkrete
  Fehlermeldung (`errorMsg`, geloggt per `console.error`), warfen dann aber
  eine hartkodierte generische Meldung ("... oder leere Antwort.") statt
  `errorMsg` — dadurch enthielten Error-Reports (Admin-Bereich, Mail,
  `error_log.md`) nie den tatsächlichen HTTP-Status oder die
  Server-Fehlermeldung von `/api/gemini`. Jetzt wird `errorMsg` geworfen,
  analog zum bereits korrekten Verhalten von `fetchTtsAudio`/
  `callGeminiTtsSummaryAPI`. Auslöser: erneut aufgetretener
  `gemini-vision-api`-Report vom 13.8.2026 (siehe `error_log.md`), dessen
  Ursache sich mangels Detail in der Fehlermeldung nicht eingrenzen ließ.

## [1.22.1] – 2026-08-13

### Dokumentation
- **`error_log.md`: `gemini-vision-api`-Fehlerbild neu als offen
  dokumentiert.** Per Admin-Bereich gemeldeter Fehler "Fehler bei der
  KI-Anfrage oder leere Antwort." (13.8.2026, V1.22.0) ist dasselbe
  Fehlerbild, das beim Firestore-Cleanup in V1.22.0 aus der Sammlung
  entfernt, aber nie als behoben bestätigt wurde. `src/App.jsx` wirft diese
  Meldung generisch für jeden `!response.ok`-Fall von `/api/gemini`
  (App-Check-, Origin-, Rate-Limit- oder Upstream-Fehler) sowie leere
  Antworten — ohne Vercel-Logs zum Report-Zeitpunkt lässt sich die konkrete
  Ursache nicht eingrenzen. Nur Dokumentation, kein Code geändert.

## [1.22.0] – 2026-08-13

### Geändert
- **Admin-Bereich: alte Fehlerreports ausblendbar.** Analog zum bestehenden
  "Gelöste ausblenden"-Filter blendet ein neuer Toggle "Alte ausblenden"
  (standardmäßig aktiv) Reports aus, deren Zeitstempel mehr als 14 Tage
  zurückliegt (`src/AdminPanel.jsx`), damit die Liste sich auf aktuelle
  Fehlerbilder konzentriert.
- **Fehlersammlung in Firestore geleert.** Die `errorReports`-Collection-Group
  enthielt 17 größtenteils veraltete Reports (älteste von V1.8.2) über 3
  Nutzer-Pfade und wurde per `firebase firestore:delete -r` vollständig
  entfernt. `error_log.md` entsprechend zurückgesetzt und mit Hinweis auf die
  Löschung versehen (die zuvor dort dokumentierten Fehlerbilder gelten
  dadurch nicht als behoben, nur die Rohdaten wurden entfernt).

## [1.21.1] – 2026-08-13

### Behoben
- **Private Google-Konto-Adresse stand im Klartext im (öffentlichen) Repo
  und im Client-Bundle.** `ALLOWED_TTS_EMAIL` aus V1.21.0 war als Literal
  direkt in `api/tts.js` hinterlegt — für jeden auf GitHub einsehbar, da das
  Repo public ist. Zusätzlich enthielt `src/AdminPanel.jsx` seit Längerem
  denselben Klartext als Fallback-Default für `VITE_ADMIN_EMAIL`, der damit
  im ausgelieferten JS-Bundle landete (per Browser-Devtools auslesbar).
  `api/tts.js` liest die Adresse jetzt aus der neuen Env-Var
  `ALLOWED_TTS_EMAIL` (server-only, siehe README), der Fallback in
  `AdminPanel.jsx` ist entfernt (nur noch `VITE_ADMIN_EMAIL`, mit Warnung im
  Log, falls die Variable fehlt). Ältere CHANGELOG-Einträge, die die Adresse
  im Klartext nannten, wurden nachträglich anonymisiert. Die tatsächliche
  Konfiguration in Vercel (Production/Preview) und der lokalen `.env` bleibt
  unverändert — nur der Klartext im versionierten Code fällt weg.

## [1.21.0] – 2026-08-13

### Geändert
- **TTS-Vorlesen serverseitig auf ein einziges Google-Konto beschränkt.**
  Nachdem die Sprachausgabe (Google Cloud TTS mit Abrechnungskonto)
  vorübergehend komplett deaktiviert war, um unkontrollierte Kosten
  auszuschließen, ist sie jetzt gezielt nur für das per `ALLOWED_TTS_EMAIL`
  konfigurierte Admin-Konto wieder freigeschaltet — alle anderen Nutzer (auch mit anderem Google-Konto
  oder anonym) bekommen `403 Forbidden`. `api/tts.js` verifiziert dafür das
  vom Frontend mitgeschickte Firebase-ID-Token direkt gegen Googles
  öffentliche Zertifikate (RS256-Signaturprüfung, Standard-Claims wie
  `iss`/`aud`/`exp`) und liest `email`/`email_verified` daraus — bewusst
  ohne `FIREBASE_SERVICE_ACCOUNT_KEY`, das in Vercel bislang nicht
  hinterlegt ist. Frontend (`src/App.jsx`, `fetchTtsAudio`) holt dafür per
  `getIdToken()` ein frisches ID-Token vom eingeloggten Firebase-User und
  schickt es als `Authorization: Bearer …`-Header mit; eine Ablehnung zeigt
  jetzt "Sprachausgabe ist nur für ein autorisiertes Konto verfügbar." statt
  der generischen Fehlermeldung und löst keinen Error-Report aus.

## [1.20.1] – 2026-08-13

### Behoben
- **App-Logo im Header hing sichtbar tiefer als der Titel-Schriftzug.** Das
  Hammer-Icon im Logo (`SmarterCraftLogo`) war per `absolute w-full h-full`
  positioniert, aber ohne explizites `top-0`/`left-0`. Ohne festgelegten
  Ankerpunkt berechnet der Browser dafür eine Fallback-Position
  ("static position"), die das Icon um exakt die halbe eigene Höhe nach unten
  verschob — es überlappte sichtbar den Untertitel unter dem Header. Fix:
  `inset-0` statt der reinen Größenklassen, damit das Icon exakt auf der
  `relative`-Box des Buttons sitzt und auf gleicher Höhe wie der Titel steht.

## [1.20.0] – 2026-08-13

### Geändert
- **TTS-Sprachausgabe von der Web Speech API des Browsers auf Google Cloud
  Text-to-Speech umgestellt.** Der Ansatz aus V1.18.x/V1.19.x blieb trotz
  mehrerer Nachbesserungen unzuverlässig — der Browser meldete teils Stimmen,
  die gar keinen Ton ausgaben, wodurch der Geschlechts-Umschalter zuletzt nur
  über eine Tonhöhen-Annäherung auf derselben Stimme lief statt über echte
  unterschiedliche Stimmen. Neuer serverseitiger Proxy `api/tts.js` (gleiches
  App-Check-/Rate-Limiting-/Origin-Check-Muster wie `api/gemini.js`, eigene
  Firestore-Collection `_ttsRateLimits`) ruft die Google Cloud
  Text-to-Speech API mit echten WaveNet-Stimmen auf (`de-DE-Wavenet-A`
  weiblich, `-B` männlich), zerlegt dafür lange Diagnosetexte serverseitig an
  Satzenden in Häppchen unter 5000 Byte (API-Limit pro Anfrage). Frontend
  spielt die zurückgelieferten MP3-Daten über ein `<audio>`-Element ab und
  cacht sie pro Modus+Geschlecht (Object-URLs), damit erneutes Abspielen
  keine erneute, kostenpflichtige Anfrage auslöst. Läuft im kostenlosen
  Google-Cloud-Kontingent, benötigt aber ein GCP-Projekt mit aktivierter
  Abrechnung und API sowie einen neuen `GOOGLE_TTS_API_KEY` (siehe README).
  Der komplette Web-Speech-API-Code (Stimmenauswahl, Tonhöhen-Fallback,
  Client-seitiges Chunking) wurde entfernt.

## [1.19.4] – 2026-08-13

### Geändert
- **README-Pflege in `CLAUDE.md` verbindlich gemacht.** Der Versionshinweis im
  README-Titel und der TTS-Absatz waren wiederholt hinter dem tatsächlichen
  Stand zurückgeblieben (zuletzt: V1.19.1 im Titel, TTS-Absatz beschrieb noch
  die per Namens-Heuristik wechselnde Stimme statt der aktuellen
  Tonhöhen-Lösung aus V1.19.3). `CLAUDE.md` bekommt dafür einen eigenen
  README-Abschnitt (Titel-Version, Feature-/Tech-Stack-Beschreibung,
  Env-Var-Tabelle, "Entstehung & technische Hürden") und einen zusätzlichen
  Pflichtschritt im "Automatisches Commit & Push"-Ablauf, der die
  README-Prüfung vor jedem Commit verlangt statt sie optional zu belassen.
  README.md selbst auf V1.19.4 und den aktuellen TTS-Stand nachgezogen.

## [1.19.3] – 2026-08-13

### Behoben
- **"Männlich" blieb weiterhin wirkungslos, dazu wurde die gute Google-Stimme
  verloren.** Ursache des V1.19.2-Fixes: Wenn für "Männlich" per Namens-
  Heuristik eine passende deutsche Stimme im gesamten Stimmen-Pool gefunden
  wurde (nicht nur unter den Google-Stimmen), wechselte `pickGermanVoice` auf
  diese — z.B. eine von Windows gemeldete "Online (Natural)"-Stimme, die in
  Chrome zwar aufgelistet wird, aber keinen Ton ausgibt. Das ersetzte
  zugleich die bisher zuverlässig funktionierende "Google Deutsch"-Stimme.
  `pickGermanVoice` wählt jetzt wieder **immer** dieselbe, bekannt
  funktionierende Stimme (Google, falls vorhanden) unabhängig vom
  gewählten Geschlecht — die Namens-Heuristik (`TTS_*_NAME_HINTS`,
  `ttsVoiceMatchesGender`) entfällt komplett. Das Geschlecht wirkt sich
  stattdessen ausschließlich über `utterance.pitch` aus (männlich 0.75,
  weiblich 1.3, `TTS_PITCH_BY_GENDER`), was auf jeder Engine zuverlässig
  hörbar ist und nie zu Stille führen kann.

## [1.19.2] – 2026-08-13

### Behoben
- **TTS-Sprachausgabe brach weiterhin vorzeitig ab, Stimmeinstellung
  "Männlich" hatte keine hörbare Wirkung.** Der in V1.18.2 eingeführte
  Workaround (periodisches `pause()`/`resume()` gegen den bekannten
  Chrome-15s-Abbruch bei langen Utterances) reichte nicht aus bzw. konnte
  auf manchen Sprachengines die Wiedergabe selbst abwürgt haben, statt sie
  fortzusetzen. Ersetzt durch Zerlegen des Textes in Satz-Häppchen
  (`chunkTextForTts`, ~200 Zeichen), die als Folge kurzer, nacheinander in
  die Warteschlange gegebene `SpeechSynthesisUtterance`-Objekte abgespielt
  werden — alle bleiben per Ref referenziert, damit sie nicht vorzeitig vom
  Garbage Collector eingesammelt werden. Für die Stimmauswahl galt: Meldet
  der Browser (z.B. Chrome ohne installierte deutsche Systemstimmen, nur
  "Google Deutsch") keine einzelne Stimme mit passendem Geschlecht, fiel
  `pickGermanVoice` bislang stillschweigend auf dieselbe Stimme zurück,
  egal welches Geschlecht gewählt war — der Umschalter wirkte dadurch tot.
  Jetzt liefert `pickGermanVoice` zusätzlich `genderMatched`; fehlt ein
  passender Treffer, wird die Tonhöhe der Utterance angepasst (männlich
  tiefer, weiblich höher), damit der Umschalter immer hörbar etwas bewirkt,
  und ein Hinweistext unter der Stimmenanzeige erklärt den Fallback. Die
  Namens-Heuristik wurde zudem um gängige Edge/Windows-"Online (Natural)"-
  Stimmennamen erweitert (Conrad, Katja, Bernd, Christa, Elke, u.a.).

## [1.19.1] – 2026-08-13

### Geändert
- **README auf aktuellen Stand gebracht.** Der Titel-Versionshinweis war seit
  V1.9.3 nicht mehr nachgezogen worden, obwohl seitdem u.a. Google-Sign-In,
  Video-Suche, Mail-Versand bei Fehlerreports und TTS dazukamen. Außerdem
  behoben: die Deployment-Env-Var-Tabelle nannte `FIREBASE_SERVICE_ACCOUNT_KEY`,
  `VITE_RECAPTCHA_SITE_KEY`, `VITE_ADMIN_PIN` und `VITE_ADMIN_EMAIL` nicht,
  obwohl sie in `.env.example` längst existieren — ein Deploy allein anhand der
  README-Tabelle hätte App Check/Rate-Limiting und den Admin-Bereich vergessen;
  der Tech-Stack-Absatz nannte Tailwind noch als CDN-Variante, obwohl seit
  V1.8.2 `@tailwindcss/vite` zur Build-Zeit kompiliert; die PDF-Export-Aufzählung
  nannte die seit V1.10.0 enthaltenen Video-Anleitungen nicht; der TTS-Absatz
  kannte weder den neuen Kurz/Vollständig-Umschalter noch die männliche
  Standardstimme. Neuer Abschnitt "Entstehung & technische Hürden" fasst die
  größten Stolpersteine der Entwicklung zusammen (offener Gemini-Proxy,
  zwei Modell-Abschaltungen, Firestore-Produktionsmodus, die zwei TTS-Anläufe,
  Google-Sign-In-Tücken) und verweist für die volle Historie auf
  `CHANGELOG.md`.

## [1.19.0] – 2026-08-13

### Hinzugefügt
- **Umschalter "Kurz"/"Vollständig" für die TTS-Sprachausgabe.** Bisher wurde
  beim Vorlesen immer der komplette Diagnosetext vorgelesen. Jetzt lässt sich
  wählen, ob nur die wichtigsten Punkte oder der vollständige Text vorgelesen
  werden — Standard ist die kurze Version. Die Kurzfassung wird bei Bedarf
  einmalig per Gemini erzeugt (neue `SYSTEM_INSTRUCTION_TTS_SUMMARY`, max. 5
  Sätze, reiner Fließtext ohne Markdown) und für den aktuellen Diagnosetext
  zwischengespeichert (`ttsShortText`), sodass wiederholtes Abspielen keine
  erneute Anfrage auslöst. Bei neuer Diagnose wird die zwischengespeicherte
  Kurzfassung verworfen. Während der Erstellung zeigt der Button einen
  Lade-Spinner ("Kurzfassung wird erstellt…") und ist deaktiviert.

## [1.18.3] – 2026-08-13

### Geändert
- **Standardstimme der TTS-Sprachausgabe auf männlich umgestellt.** Beim
  ersten Aufruf (ohne gespeicherte Präferenz in `localStorage`) wählt
  `ttsGender` jetzt `'male'` statt `'female'` als Vorgabe; eine bereits
  getroffene Nutzer-Wahl bleibt wie gehabt erhalten.

## [1.18.2] – 2026-08-13

### Behoben
- **TTS-Sprachausgabe brach ohne Vorwarnung nach kurzer Zeit ab.** Ursache
  war ein bekannter Chrome-Bug: Das `SpeechSynthesisUtterance`-Objekt wurde
  von der Web Speech API selbst nicht referenziert, sondern nur von der
  lokalen Variable in `handleToggleTts` — sobald diese Funktion durchgelaufen
  war, konnte der Garbage Collector das Objekt mitten in der Wiedergabe
  einsammeln und die Ansage brach ab. Behoben, indem die Utterance zusätzlich
  in einer Ref (`ttsUtteranceRef`) für die Dauer der Wiedergabe gehalten wird.
  Der bereits vorhandene Workaround für den separaten 15s-Abbruch-Bug
  (periodisches pause/resume) bleibt unverändert bestehen.

## [1.18.1] – 2026-08-13

### Zurückgenommen
- **Infografik-Ansicht (Schritt-Karten) für die KI-Diagnose wieder entfernt.**
  Kurz zuvor in V1.19.0 eingeführt, hat die App danach nicht mehr wie
  gewünscht funktioniert — die Ergänzung hat die App insgesamt überladen.
  Die Idee ist nicht verworfen, sondern zurückgestellt: bei Gelegenheit neu
  angehen, wenn dafür Zeit ist, statt sie auf die bestehende Textanzeige
  draufzusatteln.

## [1.18.0] – 2026-08-12

### Hinzugefügt
- **Sprachausgabe (TTS) für die KI-Diagnose reaktiviert.** Der frühere Anlauf
  (serverseitiger Gemini-TTS-Aufruf) war wegen fehlender API-Berechtigung
  (Status 401) dauerhaft deaktiviert und der zugehörige tote Code bereits
  entfernt (siehe `README.md`, „Bekannte Einschränkungen"). Statt eines
  eigenen API-Calls läuft die neue Umsetzung rein clientseitig über die
  Web Speech API des Browsers (`window.speechSynthesis`) — kein API-Key,
  keine Autorisierungsprobleme mehr. Ein „Diagnose vorlesen"-Button in der
  Ergebnisanzeige liest den Lösungstext vor; die Stimmenauswahl
  (`pickGermanVoice` in `App.jsx`) bevorzugt automatisch eine "Google"-Stimme,
  falls der Browser eine anbietet, und lässt sich per Weiblich/Männlich-Umschalter
  steuern (Heuristik anhand bekannter Stimmennamen, da die Web Speech API selbst
  kein Geschlecht liefert). Enthält einen Workaround für einen bekannten
  Chrome-Bug, der sehr lange Ansagen nach ca. 15s abbricht.

## [1.17.3] – 2026-08-12

### Behoben
- **Exportierter PDF-Bericht zeigte noch den alten Namen "SM@RTCRAFT -
  Baustellenanalyse".** Beim Rebranding auf die Tagline "Der Kollege in der
  Hosentasche" (V1.9.2) wurde die Überschrift im PDF-Export-Template
  (`handleExportPdf` in `App.jsx`) übersehen, da sie in einem separaten
  HTML-String für den Ausdruck steht statt in der sichtbaren React-UI. Alle
  anderen Web-Vorkommen des Namens sind interne, bewusst unveränderte
  IDs (Firebase-/Vercel-Projektname, npm-Paketname, Firestore-`appId`) —
  siehe Begründung im Eintrag zu V1.9.2.

## [1.17.2] – 2026-08-12

### Behoben
- **Reine Textbeschreibung ohne Bild ließ sich gar nicht erst eingeben.**
  Das Eingabefeld für die Problembeschreibung (`textarea` in `App.jsx`,
  Bereich „2. Problem dokumentieren & analysieren") wurde nur eingeblendet,
  wenn bereits ein Bild ausgewählt war oder das Feld selbst schon Text
  enthielt — ein Henne-Ei-Problem, das reine Texteingabe faktisch unmöglich
  machte, obwohl der Analyse-Button (und dessen Placeholder „Optional") das
  längst zuließ. Das Feld wird jetzt immer angezeigt, nur die Bildvorschau
  bleibt an ein vorhandenes Bild geknüpft.

## [1.17.1] – 2026-08-12

### Behoben
- **Hammer/Blitz-Icon im Header war auf dem Smartphone nach unten verschoben.**
  Ursache war die Umstellung des Logos von einem `<div>` auf ein echtes
  `<button>`-Element in V1.17.0 (klickbares Reset-Icon) — mobile Browser
  wenden auf `<button>` natives Chrome (Padding/Line-Height) an, das den
  darin absolut positionierten Hammer nach unten drückte. `SmarterCraftLogo`
  in `App.jsx` bekommt jetzt `appearance-none`, `p-0`/`m-0` und
  `leading-none`, um das native Button-Styling zu neutralisieren.

## [1.17.0] – 2026-08-12

### Hinzugefügt
- **App-Logo im Header setzt jetzt die Eingabefelder zurück.** Klick auf das
  Hammer/Blitz-Icon links im Header (`SmarterCraftLogo` in `App.jsx`) ruft
  dieselbe `handleReset`-Funktion wie der bestehende „Zurücksetzen"-Button
  auf — Bild, Problembeschreibung, Analyseergebnis etc. werden geleert, die
  bestehende Anmeldung (Auth-State) bleibt davon unberührt.

## [1.16.2] – 2026-08-12

### Behoben
- **Historie zeigte auf einem geteilten Gerät Analysen einer anderen Person.**
  Firestore-Analysen waren zwar korrekt pro `userId` gespeichert, aber
  Firebase Auth hält eine anonyme Sitzung standardmäßig dauerhaft
  (`browserLocalPersistence`, IndexedDB) und die App übernahm sie beim Start
  stillschweigend wieder (`App.jsx`, Firebase-Init-Effekt) — schloss jemand
  nur den Tab statt aktiv „Sitzung beenden" zu klicken, sah die nächste
  Person am selben Gerät automatisch die Historie der vorigen. Findet die App
  beim Laden bereits eine zuvor bestehende anonyme Sitzung vor (nicht in
  diesem Ladevorgang neu angelegt), fragt sie jetzt vor dem Übernehmen aktiv
  nach: „Weiter als Gast" behält die Sitzung samt Historie, „Neue Sitzung
  starten" meldet ab und legt eine frische anonyme Sitzung an.

## [1.16.1] – 2026-08-12

### Behoben
- **Google-Foto füllte den Kreis im Header-Profil-Button trotz `object-cover`
  nicht aus.** Ursache war nicht das Seitenverhältnis, sondern der Button
  selbst: `p-2`-Padding um das 24px-Bild ließ innerhalb des größeren
  gepolsterten `rounded-full`-Buttons einen sichtbaren Rand — object-cover
  kann das nicht beheben, weil das Bild schlicht kleiner als sein
  Elternelement war. Button ist jetzt fest `w-10 h-10`, das Foto füllt via
  `w-full h-full object-cover` randlos den kompletten Kreis; das Fallback-Icon
  bleibt über Flex-Zentrierung mittig. Betrifft nur den Header-Button — der
  Avatar im Profil-Modal war davon nicht betroffen (kein umschließendes
  Padding-Element dort).

## [1.16.0] – 2026-08-12

### Hinzugefügt
- **EU-AI-Act-Haftungsausschluss wegklickbar.** Der rote Hinweisblock oben im
  Hauptbereich (`App.jsx`) ließ sich bisher nicht ausblenden. Neuer runder
  roter Button mit X-Icon oben rechts in der Box blendet ihn aus (State
  `showDisclaimer`, gilt nur für die aktuelle Sitzung — nach einem Reload
  erscheint der Hinweis wieder).

## [1.15.4] – 2026-08-12

### Behoben
- **Google-Profilbild füllte den runden Avatar-Rahmen nicht vollständig aus.**
  Ohne `object-fit` passt ein `<img>` sein Seitenverhältnis standardmäßig
  unvorhersehbar an die vorgegebene Box an — je nach zurückgegebener
  Bildgröße blieb dadurch ein sichtbarer Rand im Kreis. Beide Avatar-`<img>`s
  (Header-Button, Profil-Modal, `App.jsx`) haben jetzt `object-cover`, damit
  das Foto zugeschnitten statt gestaucht/eingerückt den Kreis lückenlos füllt.

## [1.15.3] – 2026-08-12

### Behoben
- **Google-Profilbild wurde nach dem Login nicht angezeigt.** Zwei Ursachen:
  (1) Nach `linkWithPopup()` (anonym → Google) blieb `photoURL` auf dem
  User-Root-Objekt teils leer — Firebase legt die eigentlichen Provider-Daten
  in `user.providerData[]` ab, ohne die Root-Felder zuverlässig nachzuziehen.
  `toAuthUserSnapshot()` (`App.jsx`) fällt jetzt explizit auf den Google-Eintrag
  in `providerData` zurück. (2) `onAuthStateChanged` liefert nach dem Linking
  teils dasselbe (in-place mutierte) User-Objekt zurück — ein rohes
  `setAuthUser(user)` löste dadurch per React-Referenzvergleich keinen Re-Render
  aus. Snapshot wird jetzt als frisches Objekt gesetzt, zusätzlich direkt aus
  dem `linkWithPopup`/`signInWithPopup`-Ergebnis statt nur über den Listener.
  Schlägt das Laden des Fotos trotzdem fehl (Hotlink-Schutz, CSP, Netzwerk),
  fällt die UI jetzt sauber auf das generische Profil-Icon zurück (`onError`)
  statt ein kaputtes Bild anzuzeigen.

## [1.15.2] – 2026-08-12

### Behoben
- **Fehlgeschlagener Google-Login war für Nutzer unsichtbar.** Schlug
  `linkWithPopup`/`signInWithPopup` fehl (z.B. weil die aufrufende Domain
  nicht unter Firebase Authentication → Settings → Authorized domains
  freigeschaltet ist — Google-Login aktivieren allein reicht dafür nicht),
  gab es nur ein `console.error`, keine sichtbare Rückmeldung: ein kurzer
  schwarzer Screen (Popup öffnet, schließt sofort wieder) und danach schien
  nichts mehr zu passieren. `handleGoogleSignIn` (`App.jsx`) zeigt jetzt bei
  jedem Fehlschlag eine passende Meldung im Profil-Modal an (u.a. eigene
  Texte für `auth/unauthorized-domain`, `auth/popup-blocked`,
  `auth/network-request-failed`).

## [1.15.1] – 2026-08-12

### Behoben
- **Firestore-Rules-Deploy hatte kein Ziel.** `firestore.rules` lag zwar
  seit jeher im Repo, aber ohne `firebase.json`/`.firebaserc` wusste
  `firebase deploy --only firestore:rules` nicht, welches Projekt/welche
  Regel-Datei gemeint ist ("Not in a Firebase app directory"). Beide
  Dateien ergänzt (Projekt `smartcraft-baustellenanalyse`), damit die
  V1.15.0-Regel für `adminMeta` (Gelöst-Status) sowie künftige
  Rules-Änderungen sich per CLI deployen lassen.
- **`google-signin`-Fehlerkontext fehlte in `errorContextInfo.js`.** Die
  in V1.15.0 neuen `queueErrorReport('google-signin', …)`-Aufrufe
  (`App.jsx`) liefen im Admin-Bereich auf den generischen Fallback
  "Unbekannter Fehlerkontext" statt einer Ursache-/Lösungshilfe. Eintrag
  ergänzt.

## [1.15.0] – 2026-08-12

### Hinzugefügt
- **Optionales Google-Sign-In.** Bisher meldete sich jeder Nutzer ausschließlich
  anonym an (Firebase Anonymous Auth) — der Verlauf war an das jeweilige Gerät
  gebunden und es gab keine echte Identität, an der sich z.B. auffällige oder
  bösartige Nutzung festmachen ließe. Neuer Button "Mit Google anmelden" im
  Profil-Menü (`App.jsx`) verknüpft die bestehende anonyme Sitzung per Firebase
  Account-Linking (`linkWithPopup`) mit einem Google-Konto — gleiche UID, Verlauf
  bleibt erhalten, das Konto ist danach geräteübergreifend nutzbar. Ist das
  Google-Konto bereits an anderer Stelle verknüpft, fällt der Login auf
  `signInWithPopup` zurück (Hinweis: die alte anonyme Historie geht dabei
  verloren). Fehlerreports (`errorReporting.js`) speichern jetzt zusätzlich
  `reportedBy` (Name/E-Mail, falls per Google angemeldet), damit der
  PIN-geschützte Admin-Bereich (`AdminPanel.jsx`) Reports einer echten Person
  statt nur einer anonymen UID zuordnen kann — Voraussetzung, um Missbrauch
  gezielter nachzuverfolgen. Erfordert einmalig den Provider **Google** in der
  Firebase Console unter Authentication → Sign-in method (siehe README).
- **Echter "Gelöst"-Status im Admin-Bereich.** V1.14.1 hatte diese Lücke noch
  offen benannt ("es gibt in Firestore keinen 'gelöst'-Status"): `AdminPanel.jsx`
  zeigte jeden Fehlerreport dauerhaft an, auch längst behobene. Jetzt lässt sich
  pro Fehlerkontext direkt im Admin-Bereich "Als gelöst markieren" umschalten
  (`setContextResolved`/`fetchResolvedContexts` in `errorReporting.js`),
  gespeichert unter `artifacts/{appId}/adminMeta/errorResolutions` (neue
  Firestore-Regel dafür in `firestore.rules`). Standardmäßig blendet eine
  Checkbox gelöste Fehlerbilder aus der Liste aus; jeder Report zeigt zusätzlich
  ein "Gelöst seit"-Datum samt App-Version an.

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
  `VITE_ADMIN_EMAIL`) mit allen Details,
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
