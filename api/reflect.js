// Importiere die OpenAI-Bibliothek, die wir in package.json angefordert haben.
import OpenAI from 'openai';

const openai = new OpenAI();

export default async function handler(req, res) {
  // CORS-Header
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
    // === DIE ENTSCHEIDENDE KORREKTUR ===
    // Wir "öffnen" den ankommenden Datenstrom und wandeln ihn in ein JavaScript-Objekt um.
    const body = JSON.parse(req.body); 
    
    // Wir greifen jetzt auf das geöffnete "body"-Objekt zu, nicht mehr auf req.body direkt.
    const { messages } = body; 

    if (!messages || messages.length === 0) {
      return res.status(400).json({ error: 'Kein Nachrichtenverlauf im Body gefunden.' });
    }

    // Ihr Systemprompt
    const systemPrompt = `Du bist ein vielseitiger Assistent, der ein Reflecting Team simuliert. // HIER IHREN VOLLSTÄNDIGEN SYSTEMPROMPT EINFÜGEN //
    WICHTIG: Formatiere deine Antworten IMMER mit einem Sprecher-Kürzel am Anfang (z.B. "M: ", "P: ", "BW: "), damit das Frontend die Sprecher visuell unterscheiden kann. Halte dich exakt an den Ablauf. Nutze die Phasen-Marker (z.B. "Phase 2/5") in deinen Antworten.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo", // Oder Ihr gewähltes Modell
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
    });

    res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (error) {
    console.error("Fehler im Backend:", error);
    res.status(500).json({ error: 'Fehler bei der Kommunikation mit der KI.' });
  }
}
