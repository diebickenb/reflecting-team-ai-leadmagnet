import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI();

// Liest die Prompt-Datei einmal ein. Das ist effizienter.
const promptFilePath = path.join(process.cwd(), 'prompt.txt');
const systemPrompt = fs.readFileSync(promptFilePath, 'utf8');

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
    const { messages } = req.body;

    if (!messages || messages.length === 0) {
      return res.status(400).json({ error: 'Kein Nachrichtenverlauf im Body gefunden.' });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: systemPrompt }, // Hier wird der geladene Prompt verwendet
        ...messages
      ],
    });

    res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (error) {
    console.error("Fehler im Backend:", error);
    res.status(500).json({ error: 'Fehler bei der Kommunikation mit der KI.' });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};
