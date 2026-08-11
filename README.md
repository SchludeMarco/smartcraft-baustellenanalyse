# Sm@rtCraft – Der Kollege in der Hosentasche (V1.9.2)

**Ein Werkzeug, das ich mir selbst gewünscht hätte.**

Bevor ich in die KI-Anwendungsentwicklung gewechselt bin, habe ich als Zimmermann
gearbeitet. Auf der Baustelle steht man ständig vor Problemen, bei denen die Lösung
nicht offensichtlich ist: ein Wasserschaden am Dachbalken, ein Riss im Mauerwerk, eine
Elektroinstallation, die nicht so recht ins vorhandene Konzept passt. Man ruft einen
Kollegen an, blättert im Fachbuch, oder fährt zum Baumarkt und hofft, dass der Verkäufer
weiterhelfen kann. Sm@rtCraft ist der Versuch, genau diese Lücke zu schließen: ein
KI-gestützter Kollege in der Hosentasche, der ein Foto oder eine Beschreibung des
Problems sieht und in Sekunden eine fachlich fundierte Einschätzung liefert — für
Handwerker jedes Gewerks, direkt auf der Baustelle.

Konzipiert ist Sm@rtCraft in erster Linie fürs Smartphone: Foto direkt mit der
Gerätekamera aufnehmen und noch vor Ort auswerten lassen, ohne Umweg über einen PC.
Da die App als reine Web-App im Browser läuft, funktioniert sie genauso gut am
Desktop — etwa im Büro zur Nachbereitung oder für den Kundenbericht.

Entstanden während der Schulung zum KI-Anwendungsspezialisten.

## Was die App kann

**1. Gewerk auswählen** — Klempner, Elektriker, Maler, Gärtner, Zimmerer, Mechaniker,
Maurer, Dachdecker, Allround-Handwerker oder Sonstiges. Die Auswahl fließt direkt in
die KI-Diagnose ein und wird pro Nutzer gemerkt (Firestore-Profil).

**2. Problem dokumentieren** — Foto der Problemstelle hochladen, eine Textbeschreibung
eintippen, oder beides. Mindestens eines der beiden reicht, damit die Analyse startet.

**3. KI-Diagnose** — Gemini analysiert Bild und/oder Beschreibung im Kontext des
gewählten Gewerks und liefert eine präzise, schrittweise Lösung, formuliert für einen
erfahrenen Handwerker (kein Laien-Geschwurbel, direkt und praxisnah).

**4. Vier KI-Zusatzwerkzeuge**, jeweils auf Basis der Diagnose per Knopfdruck abrufbar:
- **Materialliste** — strukturierte Liste aus Material und Werkzeug inkl. Mengenangabe
- **Sicherheits-Check** — Risikoeinschätzung und notwendige persönliche
  Schutzausrüstung (PSA)
- **Kundenbericht** — dieselbe Lösung, jargonfrei für Auftraggeber oder Endkunden
  formuliert, inklusive administrativer nächster Schritte (Genehmigungen, Abnahmen)
- Video-Anleitungs-Suche ist im Code vorbereitet, aber aktuell deaktiviert (siehe
  Ausblick)

**5. PDF-Export** — der komplette Bericht (Diagnose, Materialliste, Sicherheits-Check,
Kundenbericht, Foto) lässt sich als druckfertiges PDF exportieren — direkt weitergebbar
an Kunden oder fürs eigene Archiv.

**6. Verlauf** — jede Analyse wird (anonym, pro Sitzung) in Firestore gespeichert; die
letzten 20 Analysen lassen sich später erneut aufrufen, ohne Foto oder Beschreibung neu
eingeben zu müssen.

**7. Haftungsausschluss fest im UI** — ein sichtbarer EU-AI-Act-Hinweis macht klar:
die KI-Diagnose ist ein unterstützender Vorschlag, kein Ersatz für die Prüfung durch
einen zertifizierten Fachmann bei sicherheitsrelevanten Arbeiten.

## Tech-Stack

React 18 + Vite, Tailwind CSS (CDN), Firebase (Anonymous Auth + Firestore),
Google Gemini API (`gemini-flash-latest`) über eine Vercel Serverless Function als
Proxy — der API-Key bleibt dadurch server-seitig und wird nie im Browser sichtbar.

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
Sie beschränken Lese-/Schreibzugriff auf den jeweils eigenen anonymen Nutzer.

## Deployment (Vercel)

Environment Variables in den Vercel-Projekteinstellungen:

| Variable | Sichtbarkeit | Quelle |
|---|---|---|
| `GEMINI_API_KEY` | server-only (kein `VITE_`-Prefix) | aistudio.google.com/apikey |
| `VITE_FIREBASE_API_KEY` | client (öffentlich vorgesehen) | Firebase-Projekteinstellungen → Meine Apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | client | „ |
| `VITE_FIREBASE_PROJECT_ID` | client | „ |
| `VITE_FIREBASE_STORAGE_BUCKET` | client | „ |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | client | „ |
| `VITE_FIREBASE_APP_ID` | client | „ |
| `VITE_FIREBASE_MEASUREMENT_ID` | client | „ |

## Bekannte Einschränkungen & Ausblick

- **TTS (Sprachausgabe)** ist im Code vorbereitet (inkl. eigener WAV-Encoder), aber
  deaktiviert — im Original fehlte die API-Berechtigung dafür. Naheliegende
  Erweiterung: Diagnose auf der Baustelle vorlesen lassen, wenn beide Hände beschäftigt
  sind.
- **Video-Anleitungs-Suche** (YouTube-Tutorials passend zur Lösung, per
  Google-Search-Grounding) ist im Code auskommentiert, aber vollständig vorbereitet.
- **Anonyme Sitzungen statt Konto:** aktuell meldet sich jeder Nutzer anonym an
  (Firebase Anonymous Auth) — der Verlauf ist an das jeweilige Gerät gebunden. Für eine
  spätere Android-App wäre echtes Google-Sign-In der nächste Schritt, um ein
  dauerhaftes, geräteübergreifendes Konto zu ermöglichen.
