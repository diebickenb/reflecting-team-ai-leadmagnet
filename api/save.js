// api/save.js
import { put } from '@vercel/blob';

export default async function handler(req, res) {
  // Sicherheits-Header, genau wie in reflect.js
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { conversation } = req.body;

    if (!conversation || conversation.length === 0) {
      return res.status(400).json({ error: 'Kein Gesprächsverlauf empfangen.' });
    }

    // Wir formatieren die Konversation in einen lesbaren Text
    const conversationText = conversation.map(msg => {
      return `[${msg.role.toUpperCase()}]\n${msg.content}\n\n--------------------\n`;
    }).join('');

    // Ein einzigartiger Dateiname, z.B. "reflexion-2023-10-27T10_30_05.123Z.txt"
    const filename = `reflexion-${new Date().toISOString()}.txt`;

    // Die Magie: Speichern der Datei in Vercel Blob
    const { url } = await put(filename, conversationText, {
      access: 'private', // Nur Sie können darauf zugreifen
    });

    // Wir senden eine Erfolgsmeldung zurück an den Browser
    res.status(200).json({ success: true, message: 'Verlauf gespeichert.', url: url });

  } catch (error) {
    console.error("Fehler beim Speichern des Verlaufs:", error);
    res.status(500).json({ error: 'Interner Serverfehler beim Speichern.' });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};
