import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // --- SCHRITT 1: DER TÜRSTEHER (Authentifizierung) ---
  // Wir prüfen, ob das geheime Passwort im Header mitgeschickt wurde.
  const apiKey = req.headers.authorization;
  if (apiKey !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
    // Wenn das Passwort falsch oder nicht vorhanden ist, weisen wir die Anfrage sofort ab.
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { conversation } = req.body;

    // --- SCHRITT 3: DER PAKET-SCANNER (Datenvalidierung) ---
    // 1. Prüfen, ob 'conversation' überhaupt ein Array ist und nicht leer ist.
    if (!Array.isArray(conversation) || conversation.length === 0) {
      return res.status(400).json({ error: 'Ungültiges Format: Gesprächsverlauf muss ein nicht-leeres Array sein.' });
    }

    // 2. Prüfen, ob jedes Element im Array die richtige Struktur hat.
    for (const msg of conversation) {
      if (typeof msg.role !== 'string' || typeof msg.content !== 'string') {
        return res.status(400).json({ error: 'Ungültiges Format: Jede Nachricht muss "role" und "content" als String enthalten.' });
      }
    }

    // Erzeugt einen einzigartigen Schlüssel für diesen Thread, z.B. "thread_1688822400000"
    const key = `thread_${Date.now()}`;
    
    // Speichert die komplette Konversation unter dem Schlüssel in der KV-Datenbank
    await kv.set(key, conversation);

    res.status(200).json({ success: true, message: 'Thread gespeichert.', key: key });

  } catch (error) {
    console.error("Fehler beim Speichern des Threads:", error);
    res.status(500).json({ error: 'Thread konnte nicht gespeichert werden.' });
  }
}


// --- SCHRITT 2: DIE LKW-WAAGE (Größenbeschränkung) ---
// Wir konfigurieren Vercel, um Anfragen über 500kb abzulehnen.
// Das ist großzügig für Text, aber stoppt missbräuchliche große Uploads.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '500kb',
    },
  },
};
