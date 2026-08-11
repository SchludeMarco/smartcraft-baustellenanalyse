import React, { useState, useCallback } from 'react';
import { Lock, Bug, Mail, X, Loader2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { fetchAllErrorReports, getErrorContextInfo } from './errorReporting';

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN;
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'marco.schlude@gmail.com';

if (!ADMIN_PIN) {
  // Kein Blocker, aber ohne PIN lässt sich der Admin-Bereich nie entsperren.
  console.warn('VITE_ADMIN_PIN ist nicht gesetzt – Admin-Bereich bleibt gesperrt.');
}

const formatTimestamp = (ms) => (ms ? new Date(ms).toLocaleString('de-DE') : 'Unbekannt');

const buildMailto = (report) => {
  const info = getErrorContextInfo(report.context);
  const subject = `Sm@rtCraft Fehlerreport: ${info.label}`;
  const body = [
    `Kontext: ${report.context}`,
    `Zeitpunkt: ${formatTimestamp(report.timestamp)}`,
    `App-Version: ${report.appVersion || 'unbekannt'}`,
    `User-Agent: ${report.userAgent || 'unbekannt'}`,
    `Firestore-Pfad: ${report.path || 'unbekannt'}`,
    '',
    'Fehlermeldung:',
    report.message || '(keine Meldung)',
    '',
    'Vermutliche Ursache:',
    info.cause,
    '',
    'Lösungsansatz:',
    info.fix,
    '',
    'Stacktrace (ggf. gekürzt):',
    (report.stack || '(kein Stacktrace)').slice(0, 1000),
  ].join('\n');
  return `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

// Admin-Bereich: PIN-geschützte Übersicht aller Fehlerreports (Collection-Group-Query
// über alle Nutzer, siehe fetchAllErrorReports). Der PIN ist reiner UI-Sichtschutz,
// keine echte Zugriffskontrolle (siehe Kommentar in firestore.rules).
const AdminPanel = ({ db, onClose }) => {
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const loadReports = useCallback(async () => {
    if (!db) {
      setLoadError('Datenbank nicht bereit.');
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchAllErrorReports(db);
      setReports(data);
    } catch (e) {
      console.error('Fehler beim Laden der Fehlerreports:', e);
      setLoadError('Fehler beim Laden: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (ADMIN_PIN && pinInput === ADMIN_PIN) {
      setUnlocked(true);
      setPinError(false);
      loadReports();
    } else {
      setPinError(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b pb-3 mb-4 flex-shrink-0">
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            <Bug className="w-5 h-5 mr-2 text-red-600" />
            Admin: Fehlerreports
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-light">
            <X className="w-6 h-6" />
          </button>
        </div>

        {!unlocked ? (
          <form onSubmit={handleUnlock} className="flex flex-col items-center justify-center flex-grow text-center">
            <Lock className="w-8 h-8 text-gray-400 mb-3" />
            <p className="text-sm text-gray-600 mb-4">Bitte Admin-PIN eingeben.</p>
            <input
              type="password"
              inputMode="numeric"
              value={pinInput}
              onChange={(e) => { setPinInput(e.target.value); setPinError(false); }}
              autoFocus
              className={`w-40 text-center p-2 border rounded-lg mb-2 focus:ring-red-500 focus:border-red-500 ${pinError ? 'border-red-500' : 'border-gray-300'}`}
            />
            {pinError && <p className="text-xs text-red-600 mb-2">Falscher PIN.</p>}
            <button type="submit" className="mt-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition text-sm">
              Entsperren
            </button>
          </form>
        ) : (
          <>
            <div className="flex justify-between items-center mb-3 flex-shrink-0">
              <p className="text-xs text-gray-500">{reports.length} Report{reports.length === 1 ? '' : 's'} insgesamt</p>
              <button onClick={loadReports} disabled={isLoading} className="flex items-center text-xs text-blue-600 hover:text-blue-800 font-semibold">
                <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Aktualisieren
              </button>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center flex-grow">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              </div>
            ) : loadError ? (
              <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg text-sm">{loadError}</div>
            ) : reports.length === 0 ? (
              <div className="text-center p-8 text-gray-500 flex-grow">
                <p>Keine Fehlerreports vorhanden.</p>
              </div>
            ) : (
              <ul className="space-y-3 overflow-y-auto flex-grow pr-1">
                {reports.map((report) => {
                  const info = getErrorContextInfo(report.context);
                  const isExpanded = expandedId === report.id;
                  return (
                    <li key={report.id} className="border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : report.id)}
                        className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 transition flex items-start justify-between"
                      >
                        <div className="flex-grow pr-2">
                          <p className="text-xs text-gray-500">{formatTimestamp(report.timestamp)}</p>
                          <p className="text-sm font-semibold text-gray-800">{info.label}</p>
                          <p className="text-xs text-gray-600 mt-0.5 break-words line-clamp-2">{report.message}</p>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                      </button>
                      {isExpanded && (
                        <div className="p-3 bg-white border-t border-gray-200 space-y-2 text-xs text-gray-700">
                          <p><strong>Kontext:</strong> {report.context}</p>
                          <p><strong>Nutzer-Pfad:</strong> <span className="break-all">{report.path}</span></p>
                          <p><strong>App-Version:</strong> {report.appVersion || 'unbekannt'}</p>
                          <p><strong>User-Agent:</strong> <span className="break-all">{report.userAgent || 'unbekannt'}</span></p>
                          <div className="p-2 bg-red-50 border-l-4 border-red-400 rounded">
                            <p className="font-bold text-red-700 mb-1">Fehlermeldung (ausgeschrieben):</p>
                            <p className="break-words whitespace-pre-wrap">{report.message}</p>
                          </div>
                          {report.stack && (
                            <div className="p-2 bg-gray-100 rounded max-h-40 overflow-y-auto">
                              <p className="font-bold text-gray-600 mb-1">Stacktrace:</p>
                              <pre className="whitespace-pre-wrap break-words text-[10px]">{report.stack}</pre>
                            </div>
                          )}
                          <div className="p-2 bg-blue-50 border-l-4 border-blue-400 rounded">
                            <p className="font-bold text-blue-700 mb-1">Vermutliche Ursache:</p>
                            <p>{info.cause}</p>
                            <p className="font-bold text-blue-700 mt-2 mb-1">Lösungsansatz:</p>
                            <p>{info.fix}</p>
                          </div>
                          <a
                            href={buildMailto(report)}
                            className="mt-2 flex items-center justify-center px-4 py-2 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition text-sm"
                          >
                            <Mail className="w-4 h-4 mr-2" />
                            Per Mail an Admin senden
                          </a>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
