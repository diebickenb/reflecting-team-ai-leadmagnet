import { kv } from '@vercel/kv';
// HIER IST DIE KORREKTUR: Wir importieren den Türsteher von der richtigen Firma (Upstash).
import { Ratelimit } from '@upstash/ratelimit';

// Wir initialisieren den Türsteher von Upstash und geben ihm die Lagerhalle von Vercel (kv) als Gedächtnis.
const ratelimit = new Ratelimit({
  redis: kv,
  // 5 Anfragen pro Stunde von einer IP-Adresse sind erlaubt.
  limiter: Ratelimit.slidingWindow(5, '1h'),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const ip = req.ip ?? '127.0.0.1';
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  try {
    const { conversation } = req.body;

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

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '500kb',
    },
  },
};
