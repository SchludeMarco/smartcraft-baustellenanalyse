# Sm@rtCraft – Baustellenanalyse (V1.71)

KI-gestützte Handwerker-App: Foto oder Problembeschreibung einer Baustellensituation
hochladen, Gewerk auswählen — Gemini analysiert das Problem und liefert eine
Schritt-für-Schritt-Lösung, dazu auf Wunsch Materialliste, Sicherheits-Check und
einen jargonfreien Kundenbericht. Ergebnisse lassen sich als PDF exportieren und
werden (anonym, pro Gerät/Sitzung) in Firestore als Verlauf gespeichert.

Entstanden während der Schulung zum KI-Anwendungsspezialisten.

## Tech-Stack

React 18 + Vite, Tailwind CSS (CDN), Firebase (Anonymous Auth + Firestore),
Google Gemini API (`gemini-2.5-flash-preview-09-2025`) über eine Vercel
Serverless Function als Proxy — der API-Key bleibt dadurch server-seitig und
wird nie im Browser sichtbar.

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

## Hinweise

- TTS (Sprachausgabe) ist im Original bewusst deaktiviert (fehlende API-Berechtigung) und bleibt es hier.
- Die Video-Anleitungs-Suche (Google-Search-Grounding) ist im Code auskommentiert/deaktiviert.
- EU-AI-Act-Haftungsausschluss ist fest im UI verankert: KI-Diagnose ersetzt keine fachliche Prüfung.
