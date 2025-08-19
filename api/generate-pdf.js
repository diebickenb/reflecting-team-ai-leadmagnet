import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// NEU: Sicherheitsfunktion zum Entschärfen von HTML-Sonderzeichen
const escapeHtml = (unsafe) => {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Hilfsfunktion zum Umwandeln des Chatverlaufs in HTML
function conversationToHtml(conversation) {
  let html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; }
          h1 { color: #005a87; border-bottom: 2px solid #005a87; padding-bottom: 10px; }
          .message { margin-bottom: 20px; padding: 15px; border-radius: 8px; max-width: 90%; word-break: break-word; }
          .user { background-color: #005a87; color: white; margin-left: auto; border-bottom-right-radius: 0; }
          .assistant { background-color: #f1f1f1; color: #333; border-bottom-left-radius: 0; }
          .speaker-name { font-weight: bold; display: block; margin-bottom: 5px; }
          .content { white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <h1>Resonanz-Bericht</h1>
  `;

  conversation.forEach(msg => {
    let speakerName = '';
    let content = msg.content;
    
    if (msg.role === 'assistant') {
      const styleMatch = content.match(/^(\S+:\s*)?\[(.*?)\]\s*\[(.*?)\]\s*/);
      if (styleMatch) {
        speakerName = styleMatch[2];
        content = content.substring(styleMatch[0].length).trim();
      }
    }
    
    // GEÄNDERT: escapeHtml wird auf alle variablen Inhalte angewendet
    const speakerHtml = speakerName ? `<span class="speaker-name">${escapeHtml(speakerName)}</span>` : '';
    html += `
      <div class="message ${escapeHtml(msg.role)}">
        ${speakerHtml}
        <div class="content">${escapeHtml(content)}</div>
      </div>
    `;
  });

  html += '</body></html>';
  return html;
}


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { conversation } = req.body;
    if (!conversation || conversation.length === 0) {
      return res.status(400).json({ error: 'Kein Gesprächsverlauf empfangen.' });
    }

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    const htmlContent = conversationToHtml(conversation);
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=Resonanz-Bericht.pdf');
    res.status(200).send(pdfBuffer);

  } catch (error) {
    console.error("Fehler bei PDF-Erstellung:", error);
    res.status(500).json({ error: 'PDF konnte nicht erstellt werden.' });
  }
}
