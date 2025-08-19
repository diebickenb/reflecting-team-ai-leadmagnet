import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// ... (openai, promptFilePath, systemPrompt, injectionKeywords Initialisierung bleibt gleich)
const openai = new OpenAI();
const promptFilePath = path.join(process.cwd(), 'prompt.txt');
const systemPrompt = fs.readFileSync(promptFilePath, 'utf8');
const injectionKeywords = [ /* ... */ ];


export default async function handler(req, res) {
  // --- ROBUSTE CORS-BEHANDLUNG (GEMÄSS REVIEW) ---
  // Wir setzen die Header bei JEDER Anfrage, um maximale Kompatibilität zu gewährleisten.
  // Die Sicherheit (wer zugreifen darf) wird durch die vercel.json sichergestellt.
  res.setHeader('Access-Control-Allow-Origin', 'https://IHRE-WORDPRESS-DOMAIN.DE'); // Passen Sie dies an Ihre Domain an!
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  // --- ENDE CORS-BEHANDLUNG ---
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Der Rest der Logik bleibt exakt gleich
    const { messages } = req.body;
    // ... (Validierung, Injection-Check, OpenAI-Call)
    if (!messages || messages.length === 0) {
      return res.status(400).json({ error: 'Kein Nachrichtenverlauf im Body gefunden.' });
    }
    const lastUserMessage = messages[messages.length - 1].content.toLowerCase();
    const isInjectionAttempt = injectionKeywords.some(keyword => lastUserMessage.includes(keyword));
    if (isInjectionAttempt) {
      console.warn('Prompt Injection Versuch erkannt:', lastUserMessage);
      return res.status(400).json({ reply: "Diese Art von Anfrage ist nicht zulässig. Die Sitzung wird aus Sicherheitsgründen beendet.", terminate: true });
    }
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
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
