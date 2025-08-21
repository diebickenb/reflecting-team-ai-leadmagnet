import { jsPDF } from "jspdf";

// Diese Hilfsfunktionen werden für die Text-Extraktion benötigt
const escapeHtml = (unsafe) => {
  if (!unsafe) return '';
  return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

function extractTextFromMessage(message) {
    let content = message.content;
    let speakerName = '';
    if (message.role === 'assistant') {
      const styleMatch = content.match(/^(\S+:\s*)?\[(.*?)\]\s*\[(.*?)\]\s*/);
      if (styleMatch) {
        speakerName = styleMatch[2];
        content = content.substring(styleMatch[0].length).trim();
      }
    }
    return { speakerName, content };
}

export default async function handler(req, res) {
  // Der robuste CORS-Block bleibt unverändert
  const allowedOrigins = [ 'https://www.dieterbickenbach.de' ];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.some(allowedOrigin => origin.startsWith(allowedOrigin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
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

    // --- NEUE PDF-ERSTELLUNG MIT jsPDF ---
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const usableWidth = pageWidth - 2 * margin;
    let y = margin; // Vertikale Position

    // Titel
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Resonanz-Bericht", margin, y);
    y += 15;

    // Gesprächsverlauf
    conversation.forEach(message => {
        const { speakerName, content } = extractTextFromMessage(message);

        if (y > 270) { // Check für Seitenumbruch
            doc.addPage();
            y = margin;
        }

        doc.setFontSize(10);
        if (message.role === 'user') {
            doc.setFont("helvetica", "italic");
            doc.setTextColor(100); // Grau
            const textLines = doc.splitTextToSize(`Sie: ${content}`, usableWidth);
            doc.text(textLines, margin, y);
            y += textLines.length * 5;
        } else { // assistant
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0); // Schwarz
            if (speakerName) {
                doc.text(`${speakerName}:`, margin, y);
                y += 6;
            }
            doc.setFont("helvetica", "normal");
            const textLines = doc.splitTextToSize(content, usableWidth);
            doc.text(textLines, margin, y);
            y += textLines.length * 5;
        }
        y += 8; // Abstand zwischen den Nachrichten
    });

    const pdfBuffer = doc.output('arraybuffer');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=Resonanz-Bericht.pdf');
    res.status(200).send(Buffer.from(pdfBuffer));

  } catch (error) {
    console.error("Detaillierter Fehler bei PDF-Erstellung:", error);
    res.status(500).json({ error: 'PDF konnte nicht erstellt werden.' });
  }
}
