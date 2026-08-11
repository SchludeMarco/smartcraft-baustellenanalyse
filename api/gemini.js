// "latest"-Alias statt fest datiertem Modellnamen, damit die App nicht erneut
// durch eine Modell-Abschaltung bricht (siehe Git-Historie: gemini-2.5-flash-preview-09-2025
// und gemini-2.5-flash wurden beide bereits zurückgezogen).
const MODEL_NAME = 'gemini-flash-latest';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Nur Requests akzeptieren, die tatsächlich vom eigenen Frontend kommen
  // (verhindert, dass fremde Seiten diesen Endpoint als kostenlosen
  // Gemini-Proxy missbrauchen und das API-Kontingent/Kosten verursachen).
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  let originHost = null;
  try {
    originHost = req.headers.origin ? new URL(req.headers.origin).host : null;
  } catch {
    originHost = null;
  }
  if (!originHost || originHost !== host) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server misconfigured: GEMINI_API_KEY missing' });
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const text = await upstream.text();
    res.status(upstream.status).setHeader('Content-Type', 'application/json').send(text);
  } catch (error) {
    res.status(502).json({ error: 'Upstream Gemini request failed' });
  }
}
