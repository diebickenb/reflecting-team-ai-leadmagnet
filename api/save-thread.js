import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { conversation } = req.body;
    if (!conversation || conversation.length === 0) {
      return res.status(400).json({ error: 'Kein Gesprächsverlauf empfangen.' });
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
