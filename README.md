# Sm@rtCraft – Der Kollege in der Hosentasche (V1.9.3)

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

## Für wen ist Sm@rtCraft?

Die App kennt keinen Unterschied zwischen Berufsalltag und Privathaushalt — dieselbe
Diagnose-Engine hilft in beiden Situationen weiter:

- **Auf der Baustelle / im Berufsalltag** — als schnelle Zweitmeinung, wenn der
  passende Kollege gerade nicht erreichbar ist: ein untypischer Wasserfleck an der
  Decke, ein Riss, dessen Ursache unklar ist, eine Installation, die vom Standard
  abweicht. Gewerk auswählen, Foto oder Beschreibung rein, fertig ist eine Einschätzung
  auf Fachniveau — inklusive Materialliste für den Baumarkt-Einkauf und
  Kundenbericht für die Übergabe an den Auftraggeber.
- **Zu Hause / privat** — genauso nutzbar, ganz ohne Handwerksausbildung: der Riss im
  Verputz, der tropfende Wasserhahn, die Pflanze, die trotz Gießen eingeht, der
  Lichtschalter, der nicht mehr reagiert. Einfach das Gewerk wählen, das am ehesten
  passt (z.B. Gärtner, Klempner, Elektriker, Maler), und die Diagnose liefert eine
  nachvollziehbare Einschätzung, bevor überhaupt ein Handwerker gerufen wird — inklusive
  Sicherheits-Check, der ehrlich sagt, wann eine Aufgabe besser einem Fachmann
  überlassen wird.

## Was die App kann

**1. Gewerk auswählen** — Klempner, Elektriker, Maler, Gärtner, Zimmerer, Mechaniker,
Maurer, Dachdecker, Allround-Handwerker oder Sonstiges. Die Auswahl fließt direkt in
die KI-Diagnose ein und wird pro Nutzer gemerkt (Firestore-Profil). Für Privatnutzer
ist "Allround-Handwerker" oder "Sonstiges" eine gute Wahl, wenn sich das Problem
keinem klassischen Gewerk eindeutig zuordnen lässt.

**2. Problem dokumentieren** — Foto der Problemstelle hochladen, eine Textbeschreibung
eintippen, oder beides. Mindestens eines der beiden reicht, damit die Analyse startet.
Ein Foto vom Smartphone direkt vor Ort ist oft aussagekräftiger als jede Beschreibung.

**3. KI-Diagnose** — Gemini analysiert Bild und/oder Beschreibung im Kontext des
gewählten Gewerks und liefert eine präzise, schrittweise Lösung, formuliert für einen
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
- Video-Anleitungs-Suche ist im Code vorbereitet, aber aktuell deaktiviert (siehe
  Ausblick)

**5. PDF-Export** — der komplette Bericht (Diagnose, Materialliste, Sicherheits-Check,
Kundenbericht, Foto) lässt sich als druckfertiges PDF exportieren — direkt weitergebbar
an Kunden, an den Handwerker des Vertrauens oder fürs eigene Archiv.

**6. Verlauf** — jede Analyse wird (anonym, pro Sitzung) in Firestore gespeichert; die
letzten 20 Analysen lassen sich später erneut aufrufen, ohne Foto oder Beschreibung neu
eingeben zu müssen.

**7. Haftungsausschluss fest im UI** — ein sichtbarer EU-AI-Act-Hinweis macht klar:
die KI-Diagnose ist ein unterstützender Vorschlag, kein Ersatz für die Prüfung durch
einen zertifizierten Fachmann bei sicherheitsrelevanten Arbeiten. Das gilt für
Profis genauso wie für Privatnutzer — gerade bei Elektro- oder Statik-Themen ist die
App eine Einschätzung, keine Freigabe.

## Ablauf in der Praxis

1. Gewerk auswählen (oder aus dem gemerkten Profil übernehmen)
2. Foto machen und/oder Problem kurz beschreiben
3. Diagnose abwarten (wenige Sekunden)
4. Bei Bedarf Materialliste, Sicherheits-Check und/oder Kundenbericht per Knopfdruck
   ergänzen
5. Alles zusammen als PDF exportieren oder für später im Verlauf ablegen

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
- **Gewerke-Sondereditionen & dedizierter Privat-Modus** sind als nächste große
  Ausbaustufe geplant: eigene Editionen pro Gewerk (z.B. Sm@rtCraft Elektro,
  Sm@rtCraft Garten) sowie eine eigene "Sm@rtCraft Zuhause"-Variante mit spürbar
  konservativerer Sicherheitsschwelle für sicherheitsrelevante Arbeiten durch Laien.
  Heute funktioniert Privatnutzung bereits über die bestehende Gewerke-Auswahl, aber
  ohne eigene, auf Laien zugeschnittene Führung.
