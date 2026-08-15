# Sm@rtCraft – Der Kollege in der Hosentasche (V1.25.1)

**Ein Werkzeug, das ich mir selbst gewünscht hätte.**

Bevor ich in die KI-Anwendungsentwicklung gewechselt bin, habe ich als Zimmermann
gearbeitet. Auf der Baustelle steht man ständig vor Problemen, bei denen die Lösung
nicht offensichtlich ist: ein Wasserschaden am Dachbalken, ein Riss im Mauerwerk, eine
Elektroinstallation, die nicht so recht ins vorhandene Konzept passt. Man ruft einen
Kollegen an, blättert im Fachbuch, oder fährt zum Baumarkt und hofft, dass der Verkäufer
weiterhelfen kann. Jede Baustelle ist im Grunde ihre eigene, teilweise völlig neue Welt
mit eigenen Regeln — und genau da stand früher oft nur ein Fragezeichen, wo eigentlich
eine klare Einschätzung gebraucht wurde.

Diesen Wunsch nach einem Kollegen, der immer dabei ist, hatte ich schon seit den
Anfängen des Smartphones. Erst die breite Verfügbarkeit leistungsfähiger KI-Modelle hat
ihn technisch realistisch gemacht. Sm@rtCraft ist der Versuch, genau diese Lücke zu
schließen: ein KI-gestützter Kollege in der Hosentasche, der ein Foto oder eine
Beschreibung des Problems sieht und in Sekunden eine fachlich fundierte Einschätzung
liefert.

Konzipiert ist Sm@rtCraft in erster Linie fürs Smartphone: Foto direkt mit der
Gerätekamera aufnehmen und noch vor Ort auswerten lassen, ohne Umweg über einen PC.
Da die App als reine Web-App im Browser läuft, funktioniert sie genauso gut am
Desktop — etwa im Büro zur Nachbereitung oder für den Kundenbericht.

Entstanden während der Schulung zum KI-Anwendungsspezialisten.

## Entstehung & technische Hürden

Der erste Prototyp war ein Google-AI-Studio-Canvas-Export — funktional, aber nicht
eigenständig lauffähig und mit dem API-Key sichtbar im Client-Code. Der erste echte
Schritt war die Migration zu einem eigenständigen Vite/React-Projekt mit einem
Vercel-Serverless-Proxy vor der Gemini API, damit der Key server-seitig bleibt.
Von dort an kamen die Hürden meist erst im Betrieb ans Licht, nicht am Reißbrett:

- **Der Gemini-Proxy war anfangs offen** — jede beliebige Seite hätte ihn
  ansprechen und echte API-Kosten verursachen können. Origin-Check, Firebase App
  Check (reCAPTCHA v3) und IP-basiertes Rate-Limiting kamen erst nachträglich
  dazu, nachdem klar wurde, dass das eigentliche Risiko nicht ein Absturz,
  sondern eine Kostenexplosion durch automatisierten Missbrauch ist.
- **Für den öffentlichen Demo-Link (z.B. LinkedIn) reichte das Rate-Limiting
  allein nicht** — 200 Anfragen/Tag sind pro IP dauerhaft nutzbar, nicht nur
  einmalig zum Ausprobieren. Ergänzend zählt derselbe Firestore-Zähler jetzt
  auch lebenslang pro IP mit (`lifetimeCount`) und blockt ab `DEMO_LIFETIME_MAX`
  (30, siehe `shared/demoLimit.js`) mit einer eigenen, nicht wiederholbaren
  403-Antwort statt des üblichen 429 — der Client versucht 429 automatisch
  erneut, ein aufgebrauchtes Demo-Kontingent soll aber sofort und mit
  Klartext-Meldung enden. Damit Erstbesucher das nicht erst beim Fehlschlagen
  erfahren, weist ein wegklickbarer Info-Banner schon beim ersten Öffnen der
  App auf das Limit hin — inklusive Live-Zähler ("Noch X von 30 übrig"), der
  beim Start über den rein lesenden Endpoint `api/demo-status.js` geladen und
  nach jeder KI-Anfrage über den `X-Demo-Remaining`-Header aus `api/gemini.js`
  aktualisiert wird. Denselben Live-Stand zeigt zusätzlich das Analyseergebnis
  selbst (direkt unter "Lösung und Diagnose"), damit er nach jeder
  Hauptanalyse neu ins Blickfeld rückt — unabhängig davon, ob der Banner oben
  weggeklickt wurde.
- **Zwei Gemini-Modelle wurden während der Entwicklung abgeschaltet**
  (`gemini-2.5-flash-preview-09-2025`, danach `gemini-2.5-flash`) — die App lief
  jeweils plötzlich ins Leere. Seitdem zeigt `gemini-flash-latest` (ein stabiler
  Alias statt einer festen Versionsnummer) auf das jeweils aktuelle Modell.
- **Firestore im Produktionsmodus** heißt: standardmäßig alles gesperrt. Ohne die
  Regeln aus [`firestore.rules`](./firestore.rules) einmal manuell in der Firebase
  Console zu veröffentlichen, schlug jeder Zugriff mit "Missing or insufficient
  permissions" fehl — ein Schritt, der sich nicht aus dem Code allein erschließt.
- **Die Sprachausgabe (TTS) brauchte drei komplette Anläufe.** Der erste Versuch
  (serverseitiger Gemini-TTS-Aufruf) scheiterte an einer fehlenden API-Berechtigung
  (Status 401) und wurde vollständig verworfen. Der zweite Ansatz lief rein
  clientseitig über die Web Speech API des Browsers — dabei mussten mehrere
  unabhängige Browser-Eigenheiten umschifft werden: ein Abbruch nach ca. 15
  Sekunden bei langen Einzel-Utterances, eine vorzeitige Garbage Collection des
  `SpeechSynthesisUtterance`-Objekts, die die Ansage ohne jede Fehlermeldung
  mitten im Satz stoppte, und die Erkenntnis, dass vom Browser gemeldete Stimmen
  (`getVoices()`) teils gar keinen Ton ausgeben — ein Versuch, für die
  Geschlechtsauswahl per Namens-Heuristik auf eine andere gemeldete Stimme
  umzuschalten, führte prompt zu stummer Wiedergabe, ein anschließender
  Tonhöhen-Kompromiss (statt echtem Stimmenwechsel) blieb unbefriedigend. Der
  dritte, heute aktive Ansatz verlässt sich gar nicht mehr auf browser- bzw.
  betriebssystemabhängige Stimmen, sondern läuft serverseitig über die Google
  Cloud Text-to-Speech API (`api/tts.js`, WaveNet-Stimmen) — echte, konsistente
  Qualität unabhängig davon, was auf dem Gerät des Nutzers installiert ist.
- **Google-Sign-In (Account-Linking auf eine bestehende anonyme Sitzung)** brachte
  eigene, erst in Produktion sichtbare Tücken mit: Firebase liefert `photoURL`
  nach dem Linking teils nur in `providerData` statt im User-Root-Objekt, und
  `onAuthStateChanged` gibt nach dem Linking manchmal dasselbe, in-place mutierte
  User-Objekt zurück — ein einfaches `setAuthUser(user)` löste dadurch per
  React-Referenzvergleich keinen Re-Render aus.
- **Fotos direkt von Smartphone-Kameras sprengten das Vercel-Payload-Limit.**
  Bilder wurden unkomprimiert als Base64 an `/api/gemini` geschickt; ein
  typisches 5-12MB-Handyfoto wird dadurch (+33% durch die Base64-Kodierung)
  zuverlässig größer als das harte, nicht konfigurierbare 4,5MB-Limit von
  Vercel Serverless Functions — sichtbar als `FUNCTION_PAYLOAD_TOO_LARGE`.
  Bilder werden jetzt vor dem Versand clientseitig per Canvas auf max. 1600px
  Kantenlänge herunterskaliert und als JPEG neu kodiert.

Die vollständige, chronologische Historie aller Versionen inklusive Problem →
Ursache → Lösung steht in [`CHANGELOG.md`](./CHANGELOG.md).

## Für wen ist Sm@rtCraft?

Die App kennt keinen Unterschied zwischen Berufsalltag und Privathaushalt — dieselbe
Diagnose-Engine hilft in beiden Situationen weiter:

- **Auf der Baustelle / im Berufsalltag** — als schnelle Zweitmeinung, wenn der
  passende Kollege gerade nicht erreichbar ist: ein untypischer Wasserfleck an der
  Decke, ein Riss, dessen Ursache unklar ist, eine Installation, die vom Standard
  abweicht. Beruf auswählen, Foto oder Beschreibung rein, fertig ist eine Einschätzung
  auf Fachniveau — inklusive Materialliste für den Baumarkt-Einkauf und
  Kundenbericht für die Übergabe an den Auftraggeber.
- **Zu Hause / privat** — genauso nutzbar, ganz ohne Handwerksausbildung: der Riss im
  Verputz, der tropfende Wasserhahn, die Pflanze, die trotz Gießen eingeht, der
  Lichtschalter, der nicht mehr reagiert. Einfach den Beruf wählen, der am ehesten
  passt (z.B. Gärtner, Klempner, Elektriker, Maler), und die Diagnose liefert eine
  nachvollziehbare Einschätzung, bevor überhaupt ein Handwerker gerufen wird — inklusive
  Sicherheits-Check, der ehrlich sagt, wann eine Aufgabe besser einem Fachmann
  überlassen wird.

## Was die App kann

**1. Beruf auswählen** — Klempner, Elektriker, Maler, Gärtner, Zimmerer, Mechaniker,
Maurer, Dachdecker, Allround-Handwerker oder Sonstiges. Die Auswahl fließt direkt in
die KI-Diagnose ein und wird pro Nutzer gemerkt (Firestore-Profil). Für Privatnutzer
ist "Allround-Handwerker" oder "Sonstiges" eine gute Wahl, wenn sich das Problem
keinem klassischen Beruf eindeutig zuordnen lässt.

**2. Problem dokumentieren** — Foto der Problemstelle hochladen, eine Textbeschreibung
eintippen, oder beides. Mindestens eines der beiden reicht, damit die Analyse startet.
Ein Foto vom Smartphone direkt vor Ort ist oft aussagekräftiger als jede Beschreibung.

**3. KI-Diagnose** — Gemini analysiert Bild und/oder Beschreibung im Kontext des
gewählten Berufs und liefert eine präzise, schrittweise Lösung, formuliert für einen
erfahrenen Handwerker (kein Laien-Geschwurbel, direkt und praxisnah) — verständlich
genug, dass auch Laien ihr zuhause folgen können.

**4. Vier KI-Zusatzwerkzeuge**, jeweils auf Basis der Diagnose per Knopfdruck abrufbar:
- **Materialliste** — strukturierte Liste aus Material und Werkzeug inkl.
  Mengenangabe, direkt als Einkaufszettel für den nächsten Baumarkt-Besuch nutzbar
- **Sicherheits-Check** — Risikoeinschätzung und notwendige persönliche
  Schutzausrüstung (PSA); für Privatnutzer die wichtigste Orientierung, ob eine
  Arbeit noch selbst zu machen ist oder besser einem Fachmann überlassen wird
- **Kundenbericht** — dieselbe Lösung, jargonfrei für Auftraggeber oder Endkunden
  formuliert, inklusive administrativer nächster Schritte (Genehmigungen, Abnahmen)
- **Video-Anleitungs-Suche** — passende YouTube-Tutorials zur Lösung, per
  Google-Search-Grounding gefunden

**5. PDF-Export** — der komplette Bericht (Diagnose, Materialliste, Sicherheits-Check,
Video-Anleitungen, Kundenbericht, Foto) lässt sich als druckfertiges PDF exportieren —
direkt weitergebbar an Kunden, an den Handwerker des Vertrauens oder fürs eigene
Archiv.

**6. Verlauf** — jede Analyse wird (anonym, pro Sitzung) in Firestore gespeichert; die
letzten 20 Analysen lassen sich später erneut aufrufen, ohne Foto oder Beschreibung neu
eingeben zu müssen.

**7. Haftungsausschluss fest im UI** — ein sichtbarer EU-AI-Act-Hinweis macht klar:
die KI-Diagnose ist ein unterstützender Vorschlag, kein Ersatz für die Prüfung durch
einen zertifizierten Fachmann bei sicherheitsrelevanten Arbeiten. Das gilt für
Profis genauso wie für Privatnutzer — gerade bei Elektro- oder Statik-Themen ist die
App eine Einschätzung, keine Freigabe.

## Ablauf in der Praxis

1. Beruf auswählen (oder aus dem gemerkten Profil übernehmen)
2. Foto machen und/oder Problem kurz beschreiben
3. Diagnose abwarten (wenige Sekunden)
4. Bei Bedarf Materialliste, Sicherheits-Check und/oder Kundenbericht per Knopfdruck
   ergänzen
5. Alles zusammen als PDF exportieren oder für später im Verlauf ablegen

## Tech-Stack

React 18 + Vite, Tailwind CSS (per `@tailwindcss/vite` zur Build-Zeit kompiliert,
nicht per CDN), Firebase (Anonymous Auth + optionales Google-Sign-In + Firestore),
Google Gemini API (`gemini-flash-latest`) über eine Vercel Serverless Function als
Proxy — der API-Key bleibt dadurch server-seitig und wird nie im Browser sichtbar.
Der Proxy ist zusätzlich per Origin-Check, Firebase App Check (reCAPTCHA v3),
IP-basiertem Rate-Limiting und einem dauerhaften Demo-Kontingent (30 KI-Anfragen
pro IP, siehe `DEMO_LIFETIME_MAX` in `api/gemini.js`) gegen automatisierten
Missbrauch abgesichert (Details unten unter "Entstehung & technische Hürden"). Technische
Fehler (React-Crashes, Firebase-/Gemini-API-Fehler) werden lokal gepuffert, sobald
online automatisch nach Firestore gemeldet und zusätzlich per Mail zugestellt; ein
PIN-geschützter Admin-Bereich (`src/AdminPanel.jsx`) fasst sie projektweit zusammen.

## Lokales Setup

```bash
npm install
cp .env.example .env
# .env ausfüllen: GEMINI_API_KEY + VITE_FIREBASE_* (siehe Firebase-Projekteinstellungen)
npm run dev
```

Die Serverless-Function unter `api/gemini.js` läuft lokal nur über
`vercel dev` (nicht über `npm run dev` allein) — für reines Frontend-Testen
reicht `npm run dev`, für die volle KI-Funktion lokal: `vercel dev`.

## Firestore Security Rules

Firestore wurde im Produktionsmodus angelegt (alles standardmäßig gesperrt).
Die Regeln aus [`firestore.rules`](./firestore.rules) müssen einmalig in der
Firebase Console unter **Firestore Database → Regeln** eingetragen werden.
Sie beschränken Lese-/Schreibzugriff auf den jeweils eigenen Nutzer (egal ob
anonym oder per Google angemeldet — die UID bleibt beim Google-Sign-In-Upgrade
über Account-Linking gleich).

## Google-Sign-In aktivieren

Nutzer starten weiterhin sofort mit einer anonymen Sitzung (siehe unten) und
können sie im Profil-Menü optional per "Mit Google anmelden" zu einem echten,
geräteübergreifenden Konto machen (Firebase Account-Linking, gleiche UID,
Verlauf bleibt erhalten). Damit das funktioniert, einmalig in der Firebase
Console unter **Authentication → Sign-in method** den Provider **Google**
aktivieren. Kein zusätzlicher Env-Var nötig — läuft über die bestehenden
`VITE_FIREBASE_*`-Werte.

## Deployment (Vercel)

Environment Variables in den Vercel-Projekteinstellungen:

| Variable | Sichtbarkeit | Quelle |
|---|---|---|
| `GEMINI_API_KEY` | server-only (kein `VITE_`-Prefix) | aistudio.google.com/apikey |
| `GOOGLE_TTS_API_KEY` | server-only | Google Cloud Console → APIs & Dienste → Anmeldedaten (Cloud Text-to-Speech API muss aktiviert sein, Abrechnungskonto erforderlich) |
| `ALLOWED_TTS_EMAIL` | server-only | einzige Google-Konto-E-Mail, für die Vorlesen freigeschaltet ist — ohne diese Variable lehnt `api/tts.js` alle Anfragen ab |
| `VITE_FIREBASE_API_KEY` | client (öffentlich vorgesehen) | Firebase-Projekteinstellungen → Meine Apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | client | „ |
| `VITE_FIREBASE_PROJECT_ID` | client | „ |
| `VITE_FIREBASE_STORAGE_BUCKET` | client | „ |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | client | „ |
| `VITE_FIREBASE_APP_ID` | client | „ |
| `VITE_FIREBASE_MEASUREMENT_ID` | client | „ |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | server-only (optional, aktiviert App Check + Rate-Limiting, sonst fail-open) | Firebase Console → Projekteinstellungen → Dienstkonten |
| `VITE_RECAPTCHA_SITE_KEY` | client (optional, aktiviert App Check clientseitig) | Firebase Console → App Check → Web-App registrieren |
| `VITE_ADMIN_PIN` | client (reiner UI-Sichtschutz für `AdminPanel.jsx`, kein echter Zugriffsschutz) | frei wählbar |
| `VITE_ADMIN_EMAIL` | client | eigene Admin-Adresse |
| `RESEND_API_KEY` | server-only | resend.com/api-keys |
| `SUPPORT_EMAIL` | server-only (fällt auf `VITE_ADMIN_EMAIL` zurück) | eigene Support-Adresse |
| `RESEND_FROM_EMAIL` | server-only (optional) | eigene verifizierte Domain, siehe resend.com/domains |

## Bekannte Einschränkungen & Ausblick

- **TTS (Sprachausgabe)** liest die KI-Diagnose auf Wunsch vor — praktisch auf der
  Baustelle, wenn beide Hände beschäftigt sind. Läuft serverseitig über einen
  eigenen Proxy (`api/tts.js`, gleiches Muster wie `api/gemini.js`) zur Google
  Cloud Text-to-Speech API (WaveNet-Stimmen `de-DE-Wavenet-A`/`-B`) — nach einem
  gescheiterten Anlauf über die browsereigene Web Speech API, die auf vielen
  Systemen Stimmen listete, die gar keinen Ton ausgaben, und lange Texte nach
  ca. 15s ohne Fehlermeldung abbrach. Die Audiodaten (MP3, base64) werden über
  ein `<audio>`-Element abgespielt und pro Modus+Geschlecht clientseitig
  zwischengespeichert, damit erneutes Abspielen keine erneute (kostenpflichtige)
  Anfrage auslöst. Weiblich/männlich wählt jetzt echte, unterschiedliche
  Stimmen statt einer Tonhöhen-Annäherung; Standard ist männlich. Ein zweiter
  Umschalter wählt zwischen "Kurz" (nur die wichtigsten Punkte, per Gemini
  zusammengefasst und für die aktuelle Diagnose zwischengespeichert — Standard)
  und "Vollständig" (der komplette Diagnosetext, serverseitig an Satzenden in
  Häppchen unter 5000 Byte aufgeteilt, da die Cloud-API das pro Anfrage limitiert).
  Läuft im kostenlosen Kontingent von Google Cloud (Stand: 1 Mio. Zeichen/Monat
  für WaveNet-Stimmen), benötigt aber ein GCP-Projekt mit aktivierter
  Abrechnung und API — siehe `GOOGLE_TTS_API_KEY` in der Env-Var-Tabelle unten.
  **Als Kostenschutz serverseitig auf ein einziges Google-Konto beschränkt**
  (`ALLOWED_TTS_EMAIL`, siehe Env-Var-Tabelle — bewusst als Variable statt
  Klartext im Repo, da es öffentlich ist): `api/tts.js` verifiziert das
  mitgeschickte Firebase-ID-Token direkt gegen Googles öffentliche
  Zertifikate (kein `FIREBASE_SERVICE_ACCOUNT_KEY` nötig) und prüft
  `email`/`email_verified` daraus. Alle anderen Nutzer — auch mit anderem
  Google-Konto oder anonym — bekommen `403 Forbidden`.
- **Google-Sign-In ist optional, nicht Pflicht:** jeder Nutzer startet weiterhin
  sofort anonym (keine Hürde vor der ersten Nutzung) und kann die Sitzung im
  Profil-Menü freiwillig per Google-Konto "aufwerten". Wer das nicht tut, bleibt
  geräteweise anonym wie bisher — für die geplante Android-App reicht das bereits.
- **Berufs-Sondereditionen & dedizierter Privat-Modus** sind als nächste große
  Ausbaustufe geplant: eigene Editionen pro Beruf (z.B. Sm@rtCraft Elektro,
  Sm@rtCraft Garten) sowie eine eigene "Sm@rtCraft Zuhause"-Variante mit spürbar
  konservativerer Sicherheitsschwelle für sicherheitsrelevante Arbeiten durch Laien.
  Heute funktioniert Privatnutzung bereits über die bestehende Berufsauswahl, aber
  ohne eigene, auf Laien zugeschnittene Führung.
