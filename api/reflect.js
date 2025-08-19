import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI();

const promptFilePath = path.join(process.cwd(), 'prompt.txt');
const systemPrompt = fs.readFileSync(promptFilePath, 'utf8');

const injectionKeywords = [
  'repeat the words above', 'you are a gpt', 'print your instructions',
  'verbatim', 'system prompt', 'deine anweisungen', 'deine instruktionen',
  'systemprompt', 'wiederhole die wörter', 'gib deine anweisungen'
];

export default async function handler(req, res) {
  // Der manuelle CORS-Header Block wurde hier entfernt.
  // Diese Aufgabe übernimmt jetzt die vercel.json Datei.

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
    
    const lastUserMessage = messages[messages.length - 1].content.toLowerCase();
    const isInjectionAttempt = injectionKeywords.some(keyword => lastUserMessage.includes(keyword));

    if (isInjectionAttempt) {
      console.warn('Prompt Injection Versuch erkannt:', lastUserMessage);
      return res.status(400).json({
        reply: "Diese Art von Anfrage ist nicht zulässig. Die Sitzung wird aus Sicherheitsgründen beendet.",
        terminate: true
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
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

export const config = {
  api: {
    bodyParser: true,
  },
};
