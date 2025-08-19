import { kv } from '@vercel/kv';
import { Ratelimit } from '@vercel/ratelimit';

// Initialisiert den KV-Store als Speicher für den Rate Limiter
const ratelimit = new Ratelimit({
  redis: kv,
  // 5 Anfragen pro Stunde von einer IP-Adresse sind erlaubt.
  // Dies ist ein guter Startwert, den Sie später anpassen können.
  limiter: Ratelimit.slidingWindow(5, '1h'),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Die IP-Adresse des anfragenden Nutzers ermitteln.
  const ip = req.ip ?? '127.0.0.1';

  // Den "Türsteher" prüfen lassen.
  const { success, limit, remaining, reset } = await ratelimit.limit(ip);

  if (!success) {
    // Wenn das Limit erreicht ist, wird die Anfrage blockiert.
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  // --- AB HIER LÄUFT DER CODE NUR WEITER, WENN DAS LIMIT NICHT ÜBERSCHRITTEN WURDE ---

  try {
    const { conversation } = req.body;

    // Die bestehenden Validierungen bleiben erhalten (sehr wichtig!)
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

// Die Größenbeschränkung bleibt ebenfalls erhalten!
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '500kb',
    },
  },
};
