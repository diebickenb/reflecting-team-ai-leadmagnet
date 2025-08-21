import { kv } from '@vercel/kv';
import { Ratelimit } from '@upstash/ratelimit';

// Initialisiert den KV-Store als Speicher für den Rate Limiter
const ratelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(5, '1h'),
});

export default async function handler(req, res) {
  // --- HINZUGEFÜGTE ROBUSTE CORS-BEHANDLUNG ---
  const allowedOrigins = [
    'https://www.dieterbickenbach.de'
  ];
  const origin = req.headers.origin;

  if (origin && allowedOrigins.some(allowedOrigin => origin.startsWith(allowedOrigin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  // --- ENDE CORS-BEHANDLUNG ---

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Rate Limiting
  const ip = req.ip ?? '127.0.0.1';
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  try {
    const { conversation } = req.body;

    // Datenvalidierung
    if (!Array.isArray(conversation) || conversation.length === 0) {
      return res.status(400).json({ error: 'Ungültiges Format: Gesprächsverlauf muss ein nicht-leeres Array sein.' });
    }
    for (const msg of conversation) {
      if (typeof msg.role !== 'string' || typeof msg.content !== 'string') {
        return res.status(400).json({ error: 'Ungültiges Format: Jede Nachricht muss "role" und "content" als String enthalten.' });
      }
    }

    const key = `thread_${Date.now()}`;
    await kv.set(key, conversation);

    res.status(200).json({ success: true, message: 'Thread gespeichert.', key: key });

  } catch (error) {
    console.error("Fehler beim Speichern des Threads:", error);
    res.status(500).json({ error: 'Thread konnte nicht gespeichert werden.' });
  }
}

// Die Größenbeschränkung bleibt erhalten
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '500kb',
    },
  },
};
