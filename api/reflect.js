// Dies ist unsere Serverless Function, die auf Anfragen wartet.
export default function handler(req, res) {
  // Wichtige Sicherheitseinstellung: CORS-Header
  // Dies ist wie ein Türschild, das Ihrer WordPress-Seite erlaubt, hier anzuklopfen.
  res.setHeader('Access-Control-Allow-Origin', '*'); // Erlaubt Anfragen von jeder Herkunft
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Wenn die Anfrage eine OPTIONS-Anfrage ist (ein "Vorab-Check" des Browsers),
  // antworten wir einfach mit OK.
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Sende eine einfache Test-Antwort im JSON-Format zurück.
  res.status(200).json({ 
    reply: "Die Verbindung zum Maschinenraum steht! Der erste Code funktioniert." 
  });
}
