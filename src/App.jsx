import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
Camera, Image, Upload, Wrench, Loader2, Zap, AlertTriangle, CheckCircle,
Smartphone, FileText, Pipette, Paintbrush, Flower, Hammer, BrickWall, Home,
Settings, MoreHorizontal, User, Package, Shield, Video, RefreshCw,
VolumeX, List, X
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
getAuth, signInAnonymously, onAuthStateChanged, signOut
} from 'firebase/auth';
import {
getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs,
orderBy, limit, serverTimestamp
} from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';
import { queueErrorReport, flushErrorReports } from './errorReporting';

const appId = 'smartcraft-baustellenanalyse';
// Gemini-Aufrufe laufen über eine eigene Serverless-Function (api/gemini.js),
// damit der API-Key nie im Browser sichtbar ist.
const apiUrl = '/api/gemini';
// NEUE SYSTEM INSTRUCTION: Betont die Problembeschreibung stärker
const SYSTEM_INSTRUCTION = "Du bist ein erfahrener Bauingenieur und Zimmermann, spezialisiert auf die Fehlerbehebung und Lösungsfindung bei Bauproblemen. Analysiere das bereitgestellte Bild basierend auf dem GLEICHZEITIG GELIEFERTEN GEWERK und der Problembeschreibung. Ist eine Problembeschreibung vorhanden, MUSS sich die Analyse VORRANGIG auf diese Beschreibung konzentrieren. Gib eine präzise Diagnose sowie eine klare, schrittweise Lösung für einen erfahrenen Handwerker. Antworte immer auf Deutsch. Halte die Sprache professionell, aber direkt und praxisnah.";
const SYSTEM_INSTRUCTION_MATERIAL = "Du bist ein Einkaufsmanager für Handwerksbetriebe. Analysiere den folgenden Lösungsvorschlag und erstelle eine JSON-Liste der benötigten Materialien und Werkzeuge. Gib nur das JSON-Array aus.";
const SYSTEM_INSTRUCTION_SAFETY = "Du bist ein Arbeitsschutz-Experte (Sicherheitstechniker). Analysiere den folgenden Lösungsvorschlag und identifiziere alle potenziellen Risiken. Erstelle eine kurze Liste von Sicherheitstipps und notwendiger persönlicher Schutzausrüstung (PSA). Antworte im Markdown-Format.";
const SYSTEM_INSTRUCTION_CLIENT_REPORT = "Du bist ein Projektmanager mit ausgezeichneten Kommunikationsfähigkeiten. Nimm die technische Lösung und formuliere eine professionelle, jargonfreie Zusammenfassung für den Endkunden oder Projektleiter. Füge am Ende eine Liste der administrativen nächsten Schritte (z.B. Genehmigungen, Abnahmen) hinzu, die erforderlich sind. Antworte im Markdown-Format.";
// JSON Schema für die Materialliste
const MATERIAL_SCHEMA = {
type: "ARRAY",
items: {
type: "OBJECT",
properties: {
"category": { "type": "STRING", "description": "Kategorie, z.B. Material oder Werkzeug" },
"item": { "type": "STRING", "description": "Genaue Bezeichnung des Artikels" },
"quantity": { "type": "STRING", "description": "Benötigte Menge (z.B. '5 kg', '1 Rolle', '1 Stk')" }
},
required: ["category", "item", "quantity"]
}
};
// Liste der Gewerke mit Icons und Farben für die visuelle Auswahl
const TRADE_ICONS = [
{ name: "Klempner", icon: Pipette, color: "bg-blue-600", hover: "hover:bg-blue-700" },
{ name: "Elektriker", icon: Zap, color: "bg-orange-600", hover: "hover:bg-orange-700" },
{ name: "Maler", icon: Paintbrush, color: "bg-green-600", hover: "hover:bg-green-700" },
{ name: "Gärtner", icon: Flower, color: "bg-emerald-600", hover: "hover:bg-emerald-700" },
{ name: "Zimmerer", icon: Hammer, color: "bg-gray-600", hover: "hover:bg-gray-700" },
{ name: "Mechaniker", icon: Wrench, color: "bg-red-600", hover: "hover:bg-red-700" },
{ name: "Maurer", icon: BrickWall, color: "bg-yellow-600", hover: "hover:bg-yellow-700" },
{ name: "Dachdecker", icon: Home, color: "bg-cyan-600", hover: "hover:bg-cyan-700" },
{ name: "Allround-Handwerker", icon: Settings, color: "bg-indigo-600", hover: "hover:bg-indigo-700" },
{ name: "Sonstig...", icon: MoreHorizontal, color: "bg-pink-600", hover: "hover:bg-pink-700" },
];
/**
* Funktion zur Konvertierung einer Datei in Base64 (wird für die API benötigt)
*/
const fileToBase64 = (file) => {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.readAsDataURL(file);
reader.onload = () => resolve(reader.result.split(',')[1]);
reader.onerror = (error) => reject(error);
});
};
/**
* Funktion mit Exponential Backoff für API-Anrufe, um Throttling zu behandeln
*/
const fetchWithRetry = async (url, options, maxRetries = 3) => {
for (let i = 0; i < maxRetries; i++) {
try {
const response = await fetch(url, options);
if (!response.ok) {
// Bei 429 (Too Many Requests) oder 5xx (Serverfehler) versuchen wir es erneut
if (response.status === 429 || response.status >= 500) {
throw new Error(`API error: ${response.statusText}`, { cause: response.status });
}
}
return response;
} catch (error) {
// Netzwerkfehler (kein HTTP-Status vorhanden) sowie 429/5xx sind behebbar und werden
// wiederholt; alles andere (z.B. 401, 404) brechen wir sofort ab
const isRetryable = error.cause === undefined || error.cause === 429 || error.cause >= 500;
if (i === maxRetries - 1 || !isRetryable) {
throw error;
}
// Exponentieller Backoff
const delay = Math.pow(2, i) * 1000;
await new Promise(resolve => setTimeout(resolve, delay));
}
}
throw new Error("Maximum retries reached.");
};
// Komponente für einen einzelnen Handwerker-Button
const TradeButton = ({ name, icon: Icon, color, isSelected, onClick, hoverClass }) => (
<button
onClick={() => onClick(name)}
// BLAUER AKZENTRING für Auswahl (V2 Highlight)
className={`flex flex-col items-center justify-center p-2 rounded-xl transition duration-200 shadow-lg transform active:scale-[0.98]
${isSelected ? 'ring-4 ring-offset-2 ring-blue-500 shadow-2xl' : `opacity-90 ${hoverClass} hover:opacity-100`}
${color} text-white
`}
>
<div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white/30 mb-1">
<Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
</div>
<span className="text-white text-[10px] sm:text-xs font-semibold text-center mt-1">{name}</span>
</button>
);
// NEUE Komponente: Historische Analysen anzeigen (liest aus Firestore)
const AnalysisHistoryModal = ({ db, userId, appId, onClose, onSelect }) => {
const [history, setHistory] = useState([]);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState(null);
const fetchHistory = useCallback(async () => {
if (!db || !userId) {
setError('Benutzer ist nicht authentifiziert oder Datenbank nicht bereit.');
setIsLoading(false);
return;
}
setIsLoading(true);
setError(null);
try {
// Korrekter Pfad für private Benutzerdaten
const analysesCol = collection(db, 'artifacts', appId, 'users', userId, 'analyses');
// Abfrage der letzten 20 Analysen, sortiert nach Zeitstempel
const q = query(
analysesCol,
orderBy('timestamp', 'desc'),
limit(20)
);
const querySnapshot = await getDocs(q);
const loadedHistory = [];
querySnapshot.forEach((doc) => {
loadedHistory.push({ id: doc.id, ...doc.data() });
});
setHistory(loadedHistory);
} catch (e) {
console.error("Fehler beim Laden der Historie:", e);
setError("Fehler beim Laden der Analyse-Historie: " + e.message);
} finally {
setIsLoading(false);
}
}, [db, userId, appId]);
useEffect(() => {
fetchHistory();
}, [fetchHistory]);
return (
<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={onClose}>
<div
className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md h-[80vh] flex flex-col transform transition-all duration-300 scale-100"
onClick={e => e.stopPropagation()}
>
<div className="flex justify-between items-center border-b pb-3 mb-4 flex-shrink-0">
<h3 className="text-xl font-bold text-gray-800 flex items-center">
<List className="w-5 h-5 mr-2 text-blue-600" />
Ihre Analyse-Historie
</h3>
<button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-light"><X className="w-6 h-6" /></button>
</div>
{isLoading ? (
<div className="flex items-center justify-center flex-grow">
<Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
<p className="ml-2 text-gray-600">Historie wird geladen...</p>
</div>
) : error ? (
<div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg">
<p className="text-sm">{error}</p>
</div>
) : history.length === 0 ? (
<div className="text-center p-8 text-gray-500 flex-grow">
<FileText className="w-8 h-8 mx-auto mb-3" />
<p>Noch keine Analysen gespeichert. Starten Sie jetzt Ihre erste Analyse!</p>
</div>
) : (
<ul className="space-y-3 overflow-y-auto flex-grow pr-1">
{history.map((item) => (
<li
key={item.id}
className="p-3 bg-gray-50 border border-gray-200 rounded-lg shadow-sm hover:bg-gray-100 transition duration-150 cursor-pointer flex items-center justify-between"
onClick={() => onSelect(item)} // Ladefunktion wird bei Klick ausgelöst
>
<div>
<p className="text-xs text-gray-500">
{item.timestamp ? new Date(item.timestamp.seconds * 1000).toLocaleString('de-DE') : 'Unbekanntes Datum'}
</p>
<p className="text-sm font-semibold text-gray-800 truncate max-w-[80%]">
{item.problemDescription.trim() || `Analyse für Gewerk: ${item.selectedTrade}`}
</p>
<span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
{item.selectedTrade}
</span>
</div>
<button className='flex items-center text-blue-600 hover:text-blue-800 text-sm font-semibold flex-shrink-0'>
Laden
</button>
</li>
))}
</ul>
)}
<div className="text-center mt-4 flex-shrink-0">
<p className="text-xs text-gray-400">Zeigt die letzten 20 Analysen.</p>
</div>
</div>
</div>
);
};
// ** ZURÜCKGESETZTE/VEREINFACHTE SVG-KOMPONENTE MIT LUCIDE-ICONS **
const SmarterCraftLogo = () => (
<div className="relative w-10 h-10">
{/* Basis: Hammer */}
<Hammer className="absolute w-full h-full text-white/90" />
{/* Overlay: Blitz (Smart-Aspekt), leicht versetzt und hervorgehoben */}
<Zap className="absolute w-5 h-5 bottom-0 right-0 transform translate-x-1 translate-y-1 text-yellow-300 fill-yellow-300 shadow-md" />
</div>
);
const App = () => {
// --- Firebase States ---
const [db, setDb] = useState(null);
const [auth, setAuth] = useState(null);
const [userId, setUserId] = useState(null);
const [isAuthReady, setIsAuthReady] = useState(false);
const [showAuth, setShowAuth] = useState(false);
const [showHistory, setShowHistory] = useState(false); // Steuert das Historien-Modal
// --- App States ---
const [selectedImageBase64, setSelectedImageBase64] = useState(null);
const [problemDescription, setProblemDescription] = useState('');
const [solutionText, setSolutionText] = useState(null);
const [sources, setSources] = useState([]);
const [isAnalyzing, setIsAnalyzing] = useState(false);
const [error, setError] = useState(null);
const [selectedTrade, setSelectedTradeState] = useState('Allround-Handwerker');
// --- LLM Feature States ---
const [materialList, setMaterialList] = useState(null);
const [safetyTips, setSafetyTips] = useState(null);
const [videoLinks, setVideoLinks] = useState(null);
const [clientReport, setClientReport] = useState(null);
const [isGeneratingMaterials, setIsGeneratingMaterials] = useState(false);
const [isGeneratingSafety, setIsGeneratingSafety] = useState(false);
const [isGeneratingVideos, setIsGeneratingVideos] = useState(false);
const [isGeneratingReport, setIsGeneratingReport] = useState(false);
// --- EFFECT: FIREBASE INITIALISIERUNG UND ANONYME ANMELDUNG ---
useEffect(() => {
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
console.error("Firebase Config unvollständig (VITE_FIREBASE_* Env-Variablen fehlen). Firestore-Funktionalität deaktiviert.");
setIsAuthReady(true);
return;
}
let authInstance;
let dbInstance;
try {
const app = initializeApp(firebaseConfig);
authInstance = getAuth(app);
dbInstance = getFirestore(app);
} catch (e) {
console.error("Fehler bei der Firebase-Initialisierung:", e);
queueErrorReport('firebase-init', e);
setIsAuthReady(true);
return;
}
setAuth(authInstance);
setDb(dbInstance);
const initializeAuth = async () => {
try {
let user = authInstance.currentUser;
if (!user) {
// Verwende signInAnonymously() als Fallback
await signInAnonymously(authInstance);
}
} catch (e) {
console.error("Fehler bei der initialen anonymen Anmeldung:", e);
queueErrorReport('firebase-auth', e);
setError("Kritischer Fehler: Die App konnte keine anonyme Sitzung starten. Historie nicht möglich.");
}
}
const unsubscribe = onAuthStateChanged(authInstance, (user) => {
if (user && user.uid) {
setUserId(user.uid);
setShowAuth(false);
} else {
setUserId(null);
setShowAuth(false);
}
setIsAuthReady(true);
});
initializeAuth();
return () => unsubscribe();
}, []);
// --- EFFECT: Wartende Fehlerreports senden, sobald eine authentifizierte
// Firestore-Verbindung besteht (initial + bei Wiederherstellung der Internetverbindung) ---
useEffect(() => {
if (!db || !userId) return;
flushErrorReports(db, userId, appId);
const handleOnline = () => flushErrorReports(db, userId, appId);
window.addEventListener('online', handleOnline);
return () => window.removeEventListener('online', handleOnline);
}, [db, userId]);
// --- FUNKTION: ALLES ZURÜCKSETZEN ---
const handleReset = useCallback(() => {
setSelectedImageBase64(null);
setProblemDescription('');
setSolutionText(null);
setSources([]);
setIsAnalyzing(false);
setError(null);
setMaterialList(null);
setSafetyTips(null);
setVideoLinks(null);
setClientReport(null);
setIsGeneratingMaterials(false);
setIsGeneratingSafety(false);
setIsGeneratingVideos(false);
setIsGeneratingReport(false);
// Dateiauswahl zurücksetzen (für saubere erneute Auswahl)
['camera-input', 'gallery-input', 'cloud-input'].forEach((id) => {
const fileInput = document.getElementById(id);
if (fileInput) fileInput.value = '';
});
}, []);
// --- FUNKTION: NUR FEHLERZUSTAND ZURÜCKSETZEN (Bild bleibt erhalten) ---
const clearError = useCallback(() => {
setError(null);
setIsAnalyzing(false);
}, []);
// --- FUNKTION: VERLAUFSEINTRAG LADEN ---
const handleSelectAnalysis = useCallback((item) => {
handleReset();
// Laden der Hauptfelder aus dem Verlaufseintrag
setProblemDescription(item.problemDescription || '');
setSelectedTradeState(item.selectedTrade || 'Allround-Handwerker');
setSolutionText(item.solutionText || null);
// Das Bild kann aus Performancegründen nicht aus Firestore geladen werden
setSelectedImageBase64(null);
setShowHistory(false);
}, [handleReset]);
// --- FUNKTION: DATEIAUSWAHL ---
const handleFileChange = useCallback(async (event) => {
const file = event.target.files[0];
if (file) {
handleReset();
setError(null);
try {
if (file.size > 5 * 1024 * 1024) {
setError("Das Bild ist zu groß (max. 5MB).");
return;
}
const base64 = await fileToBase64(file);
setSelectedImageBase64(base64);
} catch (e) {
setError("Fehler beim Laden des Bildes.");
}
}
}, [handleReset]);
// --- FUNKTION: ANALYSE IN FIREBASE SPEICHERN ---
const saveAnalysis = useCallback(async (analysisData) => {
if (!db || !userId) {
console.warn("Speichern übersprungen: Benutzer nicht authentifiziert oder Datenbank nicht bereit.");
return;
}
try {
// Korrekter Pfad für private Benutzerdaten
const analysesCol = collection(db, 'artifacts', appId, 'users', userId, 'analyses');
// Fügt ein neues Dokument hinzu, ohne das Base64-Bild (zu groß für Firestore)
await setDoc(doc(analysesCol), {
userId,
timestamp: serverTimestamp(),
selectedTrade: analysisData.selectedTrade,
problemDescription: analysisData.problemDescription,
solutionText: analysisData.solutionText,
});
} catch (e) {
console.error("Fehler beim Speichern der Analyse:", e);
}
}, [db, userId, appId]);
// --- EFFECT: GEWERK LADEN (mit Firestore) und SPEICHERN ---
const saveTradePreference = useCallback(async (trade) => {
setSelectedTradeState(trade);
if (!db || !userId) {
console.warn("Speichern übersprungen: Benutzer nicht authentifiziert oder Datenbank nicht bereit.");
return;
}
// Korrekter Pfad für private Benutzerdaten
const profileRef = doc(db, 'artifacts', appId, 'users', userId, 'profile', 'data');
try {
await setDoc(profileRef, { preferredTrade: trade }, { merge: true });
} catch (e) {
console.error("Fehler beim Speichern des Gewerkes:", e);
}
}, [db, userId, appId]);
useEffect(() => {
if (!isAuthReady || !db || !userId) return;
const loadProfile = async () => {
// Korrekter Pfad für private Benutzerdaten
const profileRef = doc(db, 'artifacts', appId, 'users', userId, 'profile', 'data');
try {
const docSnap = await getDoc(profileRef);
if (docSnap.exists()) {
const data = docSnap.data();
if (data.preferredTrade) {
setSelectedTradeState(data.preferredTrade);
}
}
} catch (e) {
console.error("Fehler beim Laden des Profils:", e);
}
};
loadProfile();
}, [isAuthReady, db, userId, appId]);
// --- FUNKTION: BILDANALYSE (Haupt-API-Aufruf) ---
const callGeminiVisionAPI = useCallback(async () => {
// Prüfung, ob mindestens ein Eingabeelement vorhanden ist
const hasImage = !!selectedImageBase64;
const hasDescription = problemDescription.trim().length > 0;
if (!hasImage && !hasDescription) {
setError("🔴 AKTION ERFORDERLICH: Bitte wählen Sie ein Bild ODER geben Sie eine Problembeschreibung ein, um die Analyse zu starten.");
return;
}
setIsAnalyzing(true);
setError(null);
setSolutionText(null);
// Zurücksetzen aller Neben-Features
setMaterialList(null);
setSafetyTips(null);
setVideoLinks(null);
setClientReport(null);
setSources([]);
const mimeType = 'image/jpeg';
const tradeContext = selectedTrade && selectedTrade !== "Sonstiges..."
? `[GEWERK: ${selectedTrade}]. `
: selectedTrade === "Sonstiges..."
? `[GEWERK: Sonstiges]. `
: '';
const descContext = problemDescription.trim()
? `[BESCHREIBUNG: ${problemDescription.trim()}]. Die Analyse MUSS sich vorrangig auf diese Beschreibung und das Bild konzentrieren, um die Fehlerursache zu finden.`
: 'Analysiere das gezeigte Bauproblem und schlage eine Lösung vor.';
const userQuery = `${tradeContext}${descContext}`;
// Erstellung des Contents: Bild (falls vorhanden) und Text
const contents = [
{
role: "user",
parts: [
{ text: userQuery },
...(hasImage ? [{
inlineData: {
mimeType: mimeType,
data: selectedImageBase64
}
}] : [])
]
}
];
const payload = {
contents: contents,
systemInstruction: {
parts: [{ text: SYSTEM_INSTRUCTION }]
},
};
try {
const response = await fetchWithRetry(apiUrl, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload)
});
// Robuste Verarbeitung der JSON-Antwort
const responseText = await response.text();
if (!response.ok || !responseText) {
const errorMsg = responseText || `API-Fehler mit Status: ${response.status}`;
console.error("API Response Fehler:", errorMsg);
throw new Error("Fehler bei der KI-Anfrage oder leere Antwort.");
}
let result;
try {
result = JSON.parse(responseText);
} catch (parseError) {
console.error("JSON-Parse-Fehler:", parseError, "Antworttext:", responseText);
throw new Error("Ungültige Antwortstruktur von der KI.");
}
const candidate = result.candidates?.[0];
if (candidate && candidate.content?.parts?.[0]?.text) {
const solution = candidate.content.parts[0].text;
setSolutionText(solution);
// Speichern der Analyse in Firestore
await saveAnalysis({
selectedTrade,
problemDescription,
solutionText: solution,
});
} else {
setError("Konnte keine gültige Antwort von der KI erhalten. Mögliches Problem: Das Bild ist zu unklar oder der Dienst ist nicht erreichbar.");
}
} catch (e) {
console.error("API-Fehler:", e);
queueErrorReport('gemini-vision-api', e);
flushErrorReports(db, userId, appId);
setError("Fehler bei der Verbindung zur Analyse: " + e.message);
} finally {
setIsAnalyzing(false);
}
}, [selectedImageBase64, problemDescription, selectedTrade, saveAnalysis, db, userId]);
// --- FUNKTION: Materialliste generieren (JSON Mode) ---
const callGeminiMaterialsAPI = useCallback(async () => {
if (!solutionText) return;
setIsGeneratingMaterials(true);
setMaterialList(null);
const userQuery = `Erstelle die Material- und Werkzeugliste für diese Lösung: ${solutionText}`;
const payload = {
contents: [{ parts: [{ text: userQuery }] }],
systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION_MATERIAL }] },
generationConfig: {
responseMimeType: "application/json",
responseSchema: MATERIAL_SCHEMA,
}
};
try {
const response = await fetchWithRetry(apiUrl, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload)
});
const responseText = await response.text();
if (!response.ok || !responseText) {
const errorMsg = responseText || `API-Fehler mit Status: ${response.status}`;
console.error("API Response Fehler:", errorMsg);
throw new Error("Fehler bei der Materialanfrage oder leere Antwort.");
}
let result;
try {
result = JSON.parse(responseText);
} catch (parseError) {
console.error("JSON-Parse-Fehler:", parseError, "Antworttext:", responseText);
throw new Error("Ungültige Antwortstruktur von der KI.");
}
const jsonString = result.candidates?.[0]?.content?.parts?.[0]?.text;
if (jsonString && jsonString.trim().length > 0) {
try {
// Robuster Parse-Versuch
const parsedJson = JSON.parse(jsonString);
setMaterialList(parsedJson);
} catch (parseError) {
console.error("JSON Parsing Fehler (Material):", parseError);
setError("Fehler beim Verarbeiten der KI-Antwort (ungültiges JSON-Format oder unvollständige Antwort).");
}
} else {
setError("Konnte keine Materialliste erstellen. Die KI hat keine strukturierte Antwort geliefert.");
}
} catch (e) {
console.error("API-Fehler (Material):", e);
queueErrorReport('gemini-materials-api', e);
flushErrorReports(db, userId, appId);
setError("Fehler beim Generieren der Materialliste: " + e.message);
} finally {
setIsGeneratingMaterials(false);
}
}, [solutionText, db, userId]);
// --- FUNKTION: Sicherheits-Check generieren (Text Mode) ---
const callGeminiSafetyAPI = useCallback(async () => {
if (!solutionText) return;
setIsGeneratingSafety(true);
setSafetyTips(null);
const userQuery = `Führe eine Sicherheitsbewertung für diese Lösung durch: ${solutionText}`;
const payload = {
contents: [{ parts: [{ text: userQuery }] }],
systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION_SAFETY }] },
};
try {
const response = await fetchWithRetry(apiUrl, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload)
});
const responseText = await response.text();
if (!response.ok || !responseText) {
const errorMsg = responseText || `API-Fehler mit Status: ${response.status}`;
console.error("API Response Fehler:", errorMsg);
throw new Error("Fehler bei der Sicherheitsanfrage oder leere Antwort.");
}
let result;
try {
result = JSON.parse(responseText);
} catch (parseError) {
console.error("JSON-Parse-Fehler:", parseError, "Antworttext:", responseText);
throw new Error("Ungültige Antwortstruktur von der KI.");
}
const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
if (text) {
setSafetyTips(text);
} else {
setError("Konnte den Sicherheits-Check nicht erstellen.");
}
} catch (e) {
console.error("API-Fehler (Sicherheit):", e);
queueErrorReport('gemini-safety-api', e);
flushErrorReports(db, userId, appId);
setError("Fehler beim Generieren des Sicherheits-Checks: " + e.message);
} finally {
setIsGeneratingSafety(false);
}
}, [solutionText, db, userId]);
// --- FUNKTION: Kundenbericht generieren (Text Mode) ---
const callGeminiClientReportAPI = useCallback(async () => {
if (!solutionText) return;
setIsGeneratingReport(true);
setClientReport(null);
const userQuery = `Erstelle einen Kundenbericht und die administrativen nächsten Schritte für diese technische Lösung: ${solutionText}`;
const payload = {
contents: [{ parts: [{ text: userQuery }] }],
systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION_CLIENT_REPORT }] },
};
try {
const response = await fetchWithRetry(apiUrl, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload)
});
const responseText = await response.text();
if (!response.ok || !responseText) {
const errorMsg = responseText || `API-Fehler mit Status: ${response.status}`;
console.error("API Response Fehler:", errorMsg);
throw new Error("Fehler bei der Berichtsanfrage oder leere Antwort.");
}
let result;
try {
result = JSON.parse(responseText);
} catch (parseError) {
console.error("JSON-Parse-Fehler:", parseError, "Antworttext:", responseText);
throw new Error("Ungültige Antwortstruktur von der KI.");
}
const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
if (text) {
setClientReport(text);
} else {
setError("Konnte den Kundenbericht nicht erstellen.");
}
} catch (e) {
console.error("API-Fehler (Kundenbericht):", e);
queueErrorReport('gemini-client-report-api', e);
flushErrorReports(db, userId, appId);
setError("Fehler beim Generieren des Kundenberichts: " + e.message);
} finally {
setIsGeneratingReport(false);
}
}, [solutionText, db, userId]);
// --- FUNKTION: Video-Suchanfragen generieren (Feature noch nicht implementiert, Button bleibt deaktiviert) ---
const callGeminiVideoSearch = useCallback(() => {}, []);
// --- FUNKTION: PDF-EXPORT ---
const handleExportPdf = useCallback(() => {
if (!solutionText) {
setError("Es gibt keine Analyseergebnisse zum Exportieren.");
return;
}
const date = new Date().toLocaleDateString('de-DE');
const problemHtml = problemDescription.trim()
? `<p class="mt-2 text-sm text-gray-600"><strong>Problembeschreibung:</strong> ${problemDescription.trim()}</p>`
: '';
const tradeHtml = selectedTrade
? `<p class="meta"><strong>Gewerk:</strong> ${selectedTrade}</p>`
: '';
// Konvertiere Markdown-Formatierung in einfache HTML-Tags
const solutionHtml = solutionText
.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
.replace(/\n/g, '<br/>');
let materialHtml = '';
if (materialList && materialList.length > 0) {
materialHtml = `
<h2>3. Benötigte Materialien und Werkzeuge</h2>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
<thead>
<tr style="background-color: #eee;">
<th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Kategorie</th>
<th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Artikel</th>
<th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Menge</th>
</tr>
</thead>
<tbody>
${materialList.map(item => `
<tr>
<td style="border: 1px solid #ccc; padding: 8px;">${item.category}</td>
<td style="border: 1px solid #ccc; padding: 8px;">${item.item}</td>
<td style="border: 1px solid #ccc; padding: 8px;">${item.quantity}</td>
</tr>
`).join('')}
</tbody>
</table>
`;
}
let safetyHtml = '';
if (safetyTips) {
const safetyContent = safetyTips
.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
.replace(/\n/g, '<br/>');
safetyHtml = `
<h2>4. Sicherheits-Check (PSA & Risiko)</h2>
<div class="result-box">
${safetyContent}
</div>
`;
}
let videoHtml = '';
if (videoLinks && videoLinks.length > 0) {
videoHtml = `
<h2>5. Video-Anleitungen (YouTube)</h2>
<ul style="list-style-type: none; padding-left: 0;">
${videoLinks.map(link => `
<li style="margin-bottom: 10px; border-left: 3px solid #007bff; padding-left: 10px;">
<strong style="display: block;">${link.title}</strong>
<a href="${link.uri}" style="color: #007bff; font-size: 0.9em; text-decoration: none;">Link zum Video</a>
</li>
`).join('')}
</ul>
`;
}
let reportHtml = '';
if (clientReport) {
const reportContent = clientReport
.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
.replace(/\n/g, '<br/>');
reportHtml = `
<h2>6. Kundenbericht & Administrative Schritte</h2>
<div class="result-box">
${reportContent}
</div>
`;
}
const printContent = `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SM@RTCRAFT Bericht - ${date}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif; margin: 40px; color: #333; line-height: 1.6; }
h1 { color: #cc0000; border-bottom: 4px solid #ff8800; padding-bottom: 10px; margin-bottom: 30px; }
h2 { color: #007bff; font-size: 1.2em; border-left: 5px solid #007bff; padding-left: 10px; margin-top: 25px; }
.section { margin-bottom: 25px; }
.result-box { background-color: #f9f9f9; padding: 15px; border-radius: 6px; border: 1px solid #eee; }
.image-preview { max-width: 80%; height: auto; margin: 15px 0; border: 1px solid #ccc; border-radius: 4px; display: block; }
.meta { font-size: 0.9em; color: #666; margin-top: 10px; }
table { border-collapse: collapse; margin-top: 10px; }
th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
th { background-color: #eee; }
@media print {
.image-preview { max-width: 100%; page-break-before: auto; page-break-after: auto; }
.section { page-break-inside: avoid; }
}
</style>
</head>
<body>
<h1>SM@RTCRAFT - Baustellenanalyse</h1>
<p class="meta"><strong>Berichtsdatum:</strong> ${date}</p>
${tradeHtml}
<div class="section">
<h2>1. Dokumentation & Problemstellung</h2>
${problemHtml}
${selectedImageBase64 ?
`<img class="image-preview" src="data:image/jpeg;base64,${selectedImageBase64}" alt="Problemstelle">` :
'<p class="meta italic">Kein Bild beigefügt.</p>'}
</div>
<div class="section">
<h2>2. KI-Diagnose und Lösungsvorschlag</h2>
<div class="result-box">
${solutionHtml}
</div>
</div>
${materialHtml}
${safetyHtml}
${videoHtml}
${reportHtml}
<p class="meta">Bericht generiert von der SM@RTCRAFT Handwerker App.</p>
</body>
</html>
`;
const printWindow = window.open('', '_blank');
if (printWindow) {
printWindow.document.write(printContent);
printWindow.document.close();
// Timeout, um dem Browser Zeit zum Rendern zu geben, bevor gedruckt wird
setTimeout(() => {
printWindow.print();
}, 500);
} else {
setError("Der Browser hat das Popup-Fenster blockiert. Bitte erlauben Sie Popups.");
}
}, [solutionText, problemDescription, selectedImageBase64, selectedTrade, materialList, safetyTips, videoLinks, clientReport]);
// Dünne Abstraktion für die Anzeige des Ergebniszustands (Laden, Fehler, Lösung)
const ResultDisplay = useMemo(() => {
// NEUE PRÜFUNG: Mindestens ein Element muss vorhanden sein
const isReadyForAnalysis = !!selectedImageBase64 || problemDescription.trim().length > 0;
if (isAnalyzing) {
return (
<div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl shadow-inner">
{/* AKZENTFARBE: Blau für Lade-Spinne */}
<Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
<p className="mt-4 text-gray-700 font-semibold">Analyse läuft...</p>
<p className="text-sm text-gray-500">Der Bau-Experte prüft die Situation.</p>
</div>
);
}
if (error) {
return (
<div className="relative p-4 pr-10 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md flex items-start space-x-3">
<button
type="button"
onClick={clearError}
aria-label="Fehler zurücksetzen"
title="Fehler zurücksetzen (Bild bleibt erhalten)"
className="absolute top-2 right-2 p-1 rounded-full text-red-500 hover:bg-red-200 hover:text-red-800 transition-colors"
>
<X className="w-4 h-4" />
</button>
<AlertTriangle className="w-5 h-5 mt-1 flex-shrink-0 text-red-600" />
<div>
<p className="font-bold">Analysefehler</p>
<p className="text-sm">{error}</p>
<p className="text-xs text-red-500 mt-1">Ihr Bild bleibt erhalten. Tippen Sie oben rechts, um es erneut zu versuchen.</p>
</div>
</div>
);
}
if (solutionText) {
return (
<div className="bg-white p-6 rounded-xl shadow-2xl border-t-4 border-blue-600 space-y-6">
<h2 className="text-2xl font-bold text-gray-800 flex items-center">
<CheckCircle className="w-6 h-6 text-green-500 mr-2" />
Lösung und Diagnose
</h2>
{/* 1. Hauptlösung */}
<div className="prose max-w-none text-gray-700 leading-relaxed max-h-96 overflow-y-auto p-3 border border-gray-200 rounded-lg bg-gray-50">
{/* Anzeige des Lösungstextes */}
<div dangerouslySetInnerHTML={{ __html: solutionText.replace(/\n/g, '<br/>') }} />
</div>
{/* TTS DEAKTIVIERT (Wegen API 401 Fehler) */}
<div className="p-3 bg-gray-100 border-l-4 border-gray-400 text-gray-600 rounded-lg shadow-md flex items-center justify-center">
<VolumeX className="w-5 h-5 mr-3" />
<p className="text-sm font-semibold">
Sprachausgabe (TTS) ist aktuell aufgrund von Autorisierungsproblemen (Status 401) deaktiviert.
</p>
</div>
{/* 2. Neue LLM-Funktionen (bleiben als 2x2 Grid) */}
<div className="border-t pt-4 border-gray-100">
<h3 className="text-lg font-semibold text-gray-700 mb-3">Zusätzliche KI-Tools:</h3>
<div className="grid grid-cols-2 gap-3">
{/* Materialliste Button (1/4) - Farbe: Indigo */}
<button
onClick={callGeminiMaterialsAPI}
disabled={isGeneratingMaterials || !solutionText}
className={`flex flex-col items-center justify-center p-2 rounded-xl font-bold text-white shadow-md transition duration-300 text-xs transform active:scale-[0.98] ${
isGeneratingMaterials ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700'
}`}
>
{isGeneratingMaterials ? (
<Loader2 className="w-4 h-4 animate-spin" />
) : (
<Package className="w-4 h-4" />
)}
<span className="mt-1">✨ Materialliste</span>
</button>
{/* Sicherheits-Check Button (2/4) - Farbe: Teal */}
<button
onClick={callGeminiSafetyAPI}
disabled={isGeneratingSafety || !solutionText}
className={`flex flex-col items-center justify-center p-2 rounded-xl font-bold text-white shadow-md transition duration-300 text-xs transform active:scale-[0.98] ${
isGeneratingSafety ? 'bg-teal-400 cursor-wait' : 'bg-teal-600 hover:bg-teal-700'
}`}
>
{isGeneratingSafety ? (
<Loader2 className="w-4 h-4 animate-spin" />
) : (
<Shield className="w-4 h-4" />
)}
<span className="mt-1">✨ Sicherheits-Check</span>
</button>
{/* Video-Anleitung Button (3/4) - Farbe: Amber - IMMER DEAKTIVIERT */}
<button
onClick={callGeminiVideoSearch}
disabled={true}
className={`flex flex-col items-center justify-center p-2 rounded-xl font-bold text-white shadow-md transition duration-300 text-xs transform active:scale-[0.98] ${
'bg-gray-400 cursor-not-allowed opacity-70'
}`}
>
<Video className="w-4 h-4" />
<span className="mt-1">Video-Anleitung (Inaktiv)</span>
</button>
{/* AKZENT-FEATURE: Kundenbericht Button (BLEIBT BLAU) */}
<button
onClick={callGeminiClientReportAPI}
disabled={isGeneratingReport || !solutionText}
className={`flex flex-col items-center justify-center p-2 rounded-xl font-bold text-white shadow-md transition duration-300 text-xs transform active:scale-[0.98] ${
isGeneratingReport ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'
}`}
>
{isGeneratingReport ? (
<Loader2 className="w-4 h-4 animate-spin" />
) : (
<FileText className="w-4 h-4" />
)}
<span className="mt-1">✨ Kundenbericht</span>
</button>
</div>
</div>
{/* 3. Materialliste Ergebnis */}
{materialList && (
<div className="p-4 bg-white border border-gray-200 rounded-xl shadow-inner">
<h4 className="text-md font-bold text-gray-800 mb-3 flex items-center">
<Package className="w-5 h-5 mr-2 text-indigo-600" />
Benötigte Materialien und Werkzeuge
</h4>
<div className="overflow-x-auto">
<table className="min-w-full divide-y divide-gray-200">
<thead className="bg-gray-50">
<tr>
<th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tl-lg">Kategorie</th>
<th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artikel</th>
<th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tr-lg">Menge</th>
</tr>
</thead>
<tbody className="bg-white divide-y divide-gray-200">
{materialList.map((item, index) => (
<tr key={index} className={item.category === 'Werkzeug' ? 'bg-yellow-50/50' : ''}>
<td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{item.category}</td>
<td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{item.item}</td>
<td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{item.quantity}</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
)}
{/* 4. Sicherheits-Check Ergebnis */}
{safetyTips && (
<div className="p-4 bg-white border border-gray-200 rounded-xl shadow-inner">
<h4 className="text-md font-bold text-gray-800 mb-3 flex items-center">
<Shield className="w-5 h-5 mr-2 text-teal-600" />
Sicherheits-Check (PSA & Risiko)
</h4>
<div className="text-sm text-gray-700 leading-relaxed">
<div dangerouslySetInnerHTML={{ __html: safetyTips.replace(/\n/g, '<br/>') }} />
</div>
</div>
)}
{/* 5. Video-Anleitungen Ergebnis */}
{videoLinks && (
<div className="p-4 bg-white border border-gray-200 rounded-xl shadow-inner">
<h4 className="text-md font-bold text-gray-800 mb-3 flex items-center">
<Video className="w-5 h-5 mr-2 text-amber-600" />
Video-Anleitungen (YouTube)
</h4>
<ul className="space-y-2">
{videoLinks.map((link, index) => (
// BLAUER AKZENT: Hervorhebung für Video-Links
<li key={index} className="border-l-4 border-blue-500 pl-3">
<a
href={link.uri}
target="_blank"
rel="noopener noreferrer"
className="text-sm text-blue-600 hover:text-blue-800 font-medium truncate block"
>
{link.title}
</a>
<span className="text-xs text-gray-500 block">Link zu YouTube</span>
</li>
))}
</ul>
</div>
)}
{/* 6. Kundenbericht Ergebnis */}
{clientReport && (
<div className="p-4 bg-white border border-gray-200 rounded-xl shadow-inner">
<h4 className="text-md font-bold text-gray-800 mb-3 flex items-center">
{/* BLAUER AKZENT: Icon Farbe */}
<FileText className="w-5 h-5 mr-2 text-blue-600" />
Kundenbericht & Nächste Schritte
</h4>
<div className="text-sm text-gray-700 leading-relaxed">
<div dangerouslySetInnerHTML={{ __html: clientReport.replace(/\n/g, '<br/>') }} />
</div>
</div>
)}
{/* 7. PDF EXPORT BUTTON */}
<div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
<button
onClick={handleExportPdf}
disabled={!solutionText || isGeneratingMaterials || isGeneratingSafety || isGeneratingVideos || isGeneratingReport}
// PRIMÄRFARBE: Rot/Orange für Export-Taste
className="flex items-center px-4 py-2 bg-red-600 text-white font-semibold rounded-xl shadow-md hover:bg-red-700 transition duration-300 transform active:scale-[0.98]"
>
<FileText className="w-4 h-4 mr-2" />
Als PDF exportieren
</button>
</div>
</div>
);
}
// Standard-Willkommensmeldung
return (
// BLAUER AKZENT: Gestrichelte Linie und Icon Farbe
<div className="p-8 text-center text-gray-500 bg-white rounded-xl shadow-inner border-4 border-dashed border-blue-200">
<Smartphone className="w-8 h-8 mx-auto text-blue-500 mb-3" />
<p className="font-semibold text-lg text-gray-800">Starten Sie Ihre Bauanalyse</p>
<p className="text-sm mt-2 text-gray-600 font-bold">
Um die Analyse zu starten, benötigen Sie **eines** der folgenden Elemente:
</p>
<ul className="text-sm mt-3 space-y-1 text-gray-700 text-left mx-auto max-w-xs">
<li>
<span className='font-bold text-red-600 mr-1'>1.</span> Ein Foto der Problemstelle **(Abschnitt 2)**
</li>
<li>
<span className='font-bold text-red-600 mr-1'>2.</span> Eine detaillierte Problembeschreibung **(Abschnitt 2)**
</li>
</ul>
<p className="text-xs mt-4 text-gray-500">Wählen Sie zuerst Ihr Gewerk (Abschnitt 1) für eine präzisere Diagnose.</p>
</div>
);
}, [isAnalyzing, error, clearError, solutionText, handleExportPdf, materialList, safetyTips, videoLinks, clientReport, isGeneratingMaterials, isGeneratingSafety, isGeneratingVideos, isGeneratingReport, callGeminiMaterialsAPI, callGeminiSafetyAPI, callGeminiVideoSearch, callGeminiClientReportAPI, selectedImageBase64, problemDescription]);
// Profil-Modal-Komponente (angepasst an Rot/Blau)
const UserProfileModal = () => {
const [showProfile, setShowProfile] = useState(false);
const handleSignOut = async () => {
// Nur Abmeldung, wenn Firebase aktiv ist
if (!auth || !userId) return;
try {
// Meldet den aktuellen Benutzer ab
await signOut(auth);
setShowProfile(false);
handleReset(); // App zurücksetzen
} catch (e) {
console.error("Logout Error:", e);
}
};
return (
<>
{/* Profil-Button im Header */}
<button
onClick={() => setShowProfile(true)} // Öffnet Profil-Modal
className={`p-2 rounded-full transition duration-200 ${userId ? 'bg-white/20 hover:bg-white/30' : 'bg-gray-500/50 cursor-wait'}`}
disabled={!userId}
title="Benutzerprofil und Historie anzeigen"
>
<User className="w-6 h-6 text-white" />
</button>
{/* Profil Modal */}
{showProfile && (
<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={() => setShowProfile(false)}>
<div
className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-xs transform transition-all duration-300 scale-100"
onClick={e => e.stopPropagation()}
>
<div className="flex justify-between items-center border-b pb-3 mb-4">
<h3 className="text-xl font-bold text-gray-800 flex items-center">
{/* PRIMÄRFARBE: Profil-Icon Rot */}
<User className="w-5 h-5 mr-2 text-red-600" />
Anonyme Sitzung
</h3>
<button onClick={() => setShowProfile(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-light"><X className="w-6 h-6" /></button>
</div>
<p className="text-sm text-gray-600 mb-4 break-words p-2 bg-yellow-50 rounded-lg border border-yellow-200">
<strong className="block text-xs uppercase text-yellow-700 mb-1">Hinweis zur Historie:</strong>
<span className="font-semibold text-gray-700 break-words">Sie sind anonym angemeldet. Beim späteren Ausrollen als Android App können Sie dies durch <span className='font-bold text-red-600'>Google Sign-In</span> ersetzen, um ein dauerhaftes Konto zu erhalten.</span>
</p>
<p className="text-sm text-gray-600 mb-4 break-words">
<strong className="block text-xs uppercase text-gray-500 mb-1">Temporäre ID:</strong>
<span className="font-semibold text-blue-600 break-words">{userId || 'Wird geladen...'}</span>
</p>
<div className="flex justify-between space-x-2 mt-6">
<button
onClick={() => { setShowHistory(true); setShowProfile(false); }}
className="flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition duration-300 text-sm transform active:scale-[0.98]"
disabled={!userId}
>
<List className="w-4 h-4 mr-2" />
Historie
</button>
<button
onClick={handleSignOut}
// Rot, um auf den Verlust der Historie hinzuweisen
className="flex items-center px-4 py-2 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition duration-300 text-sm transform active:scale-[0.98]"
>
<X className="w-4 h-4 mr-2" />
Sitzung beenden
</button>
</div>
</div>
</div>
)}
</>
);
};
if (!isAuthReady || showAuth) {
// Ladebildschirm während der Firebase-Authentifizierung
return (
<div
className="min-h-screen flex justify-center items-center bg-gray-800 bg-cover bg-center bg-fixed bg-no-repeat"
style={{ backgroundImage: "url(https://storage.googleapis.com/bacon-images-prod/gemini/app_builder/werkzeuge.jpg)" }}
>
<div className="absolute inset-0 bg-black/40 z-0"></div>
<div className='text-white p-6 bg-red-600 rounded-xl max-w-sm text-center'>
<Loader2 className="w-8 h-8 mx-auto animate-spin mb-3" />
<p className='font-bold'>Starte Authentifizierung...</p>
</div>
</div>
);
}
// Haupt-App-Ansicht
return (
<div
className="min-h-screen p-4 sm:p-6 flex justify-center relative bg-gray-800 bg-cover bg-center bg-fixed bg-no-repeat"
style={{
backgroundImage: "url(https://storage.googleapis.com/bacon-images-prod/gemini/app_builder/werkzeuge.jpg)",
}}
>
<div className="absolute inset-0 bg-black/40 z-0"></div>
<div className="w-full max-w-sm flex flex-col items-center relative z-10">
{/* Historie-Modal */}
{showHistory && (
<AnalysisHistoryModal
db={db}
userId={userId}
appId={appId}
onClose={() => setShowHistory(false)}
onSelect={handleSelectAnalysis}
/>
)}
{/* Header mit Profil-Button - ANGEPASST AN BILDSTIL (kein Verlauf, nur Orange/Rot) */}
<header className="w-full p-5 bg-red-600 shadow-2xl relative">
<div className="flex items-center justify-between relative z-10">
<div className="flex items-center space-x-3">
{/* EINGEBETTETES, STABILES LOGO (Lucide-Icons) */}
<SmarterCraftLogo />
{/* Versionsnummer stammt aus package.json (siehe vite.config.js define: __APP_VERSION__) */}
<h1 className="text-2xl font-extrabold text-white tracking-tight">Sm@rtCraft! <span className='text-sm font-light italic'>(V{__APP_VERSION__})</span></h1>
</div>
{/* Profil-Button: Öffnet das Profil-Modal */}
<UserProfileModal />
</div>
<p className="text-sm text-white/90 mt-1 relative z-10">Handwerker App - Ihre Lösung auf der Baustelle.</p>
</header>
{/* Haupt-Content-Bereich */}
<main className="p-4 space-y-6 w-full bg-white/95 backdrop-blur-md shadow-2xl overflow-y-auto">
{/* EU AI ACT DISCLAIMER */}
<div className="p-3 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md flex items-start space-x-3">
<AlertTriangle className="w-5 h-5 mt-1 flex-shrink-0 text-red-600" />
<div>
<p className="font-bold">WICHTIGER HAFTUNGSAUSSCHLUSS (EU AI ACT)</p>
<p className="text-xs">Die KI-Diagnose ist ein unterstützender Vorschlag und ersetzt keine professionelle Planung oder statische Bewertung. Führen Sie sicherheitsrelevante Arbeiten nur nach Prüfung durch einen zertifizierten Fachmann aus.</p>
</div>
</div>
{/* 1. Gewerk Auswahl */}
<section>
<h2 className="text-lg font-bold text-gray-700 mb-3 border-b pb-2">1. Gewerk auswählen</h2>
<div className="grid grid-cols-5 gap-2 p-3 bg-gray-100 rounded-xl border border-gray-200 shadow-inner">
{TRADE_ICONS.map((trade) => (
<TradeButton
key={trade.name}
name={trade.name}
icon={trade.icon}
color={trade.color}
hoverClass={trade.hover}
isSelected={selectedTrade === trade.name}
onClick={saveTradePreference} // Speichert direkt in Firestore
/>
))}
</div>
{selectedTrade && (
<p className="mt-3 text-sm text-gray-600 font-medium">Aktuelles Gewerk: <span className="text-blue-600 font-bold">{selectedTrade}</span></p>
)}
</section>
{/* 2. Problem dokumentieren & analysieren - ANPASSUNG AN BILDSTIL */}
<section>
<h2 className="text-lg font-bold text-gray-700 mb-3 border-b pb-2">2. Problem dokumentieren & analysieren</h2>
{/* NEUE STRUKTUR: Wie auf dem Bild (einheitliche Eingabekarte) */}
<div className="bg-white p-4 border border-gray-200 rounded-xl shadow-lg">
{/* Mini-Button-Leiste für Foto-Auswahl im Tab-Stil - Jetzt klarer als Dateiauswahl */}
<div className="flex space-x-4 text-sm font-semibold text-gray-700 mb-4 border-b pb-2 -mt-2">
{/* Foto direkt mit der Kamera aufnehmen: "capture" öffnet auf dem Handy die
    Kamera-App statt einer Dateiauswahl, damit die Analyse live auf der
    Baustelle passiert. Auf dem Desktop ohne Kamera fällt der Browser
    automatisch auf eine normale Dateiauswahl zurück. */}
<label htmlFor="camera-input" className="flex items-center space-x-1 cursor-pointer hover:text-red-600 transition">
<Camera className="w-5 h-5 text-red-600" />
<span>Foto aufnehmen</span>
<input id="camera-input" type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
</label>
{/* Galerie: bewusst ohne "capture", damit auch ein bereits vorhandenes Foto ausgewählt werden kann */}
<label htmlFor="gallery-input" className="flex items-center space-x-1 cursor-pointer hover:text-red-600 transition">
<Image className="w-5 h-5 text-red-600" />
<span>Galerie</span>
<input id="gallery-input" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
</label>
{/* Cloud Upload Placeholder */}
<label htmlFor="cloud-input" className="flex items-center space-x-1 cursor-pointer text-gray-400 transition" title="In Kürze verfügbar">
<Upload className="w-5 h-5" />
<span>Google Fotos</span>
</label>
</div>
{/* Bild-Vorschau und Beschreibung */}
{(selectedImageBase64 || problemDescription.trim().length > 0) && (
<div className="mt-2">
{selectedImageBase64 && (
<div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center mb-4">
<img
src={`data:image/jpeg;base64,${selectedImageBase64}`}
alt="Vorschau des ausgewählten Bauproblems"
className="object-cover w-full h-full"
/>
<button
onClick={() => setSelectedImageBase64(null)}
className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full text-xs hover:bg-black/70 transition"
title="Bild entfernen"
>
<X className="w-4 h-4" />
</button>
</div>
)}
{/* Beschreibung des Problems */}
<div>
<label htmlFor="problem-desc" className="sr-only">Problembeschreibung</label>
<textarea
id="problem-desc"
rows="2"
value={problemDescription}
onChange={(e) => setProblemDescription(e.target.value)}
placeholder="Z.B. 'Dachbalken zeigt Risse nach Feuchtigkeitsschaden.' (Optional)"
className="w-full p-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 resize-none text-sm"
/>
</div>
</div>
)}
</div>
{/* ANGEPASST: Reset-Button wieder neben dem Analyse-Button */}
<div className="flex space-x-3 mt-4 w-full">
{/* Reset Button */}
<button
onClick={handleReset}
className="w-1/3 flex items-center justify-center py-3 rounded-xl font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 transition duration-300 text-sm shadow-md transform active:scale-[0.98]"
>
<RefreshCw className="w-4 h-4 mr-1" />
Zurücksetzen
</button>
{/* Primär Analyse Button - Orange Theme */}
<button
onClick={callGeminiVisionAPI}
disabled={isAnalyzing || (!selectedImageBase64 && problemDescription.trim().length === 0)}
className={`w-2/3 flex items-center justify-center py-3 rounded-xl font-bold text-white shadow-lg transition duration-300 transform active:scale-[0.98]
${isAnalyzing || (!selectedImageBase64 && problemDescription.trim().length === 0) ? 'bg-orange-400 cursor-wait' : 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800'}`
}
>
{isAnalyzing ? (
<>
<Loader2 className="w-5 h-5 mr-2 animate-spin text-white" />
Analysiere...
</>
) : (
<>
<Zap className="w-5 h-5 mr-2" />
Problem analysieren
</>
)}
</button>
</div>
</section>
{/* 3. Analyseergebnisse */}
<section className="mt-6">
<h2 className="text-lg font-bold text-gray-700 mb-3 border-b pb-2">3. Ergebnis der KI-Analyse</h2>
{ResultDisplay}
</section>
</main>
</div>
</div>
);
};
export default App;
