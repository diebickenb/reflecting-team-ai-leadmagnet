// --- CORS & Preflight (optional bei Vercel Functions, schadet aber nicht) ---
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "*";
function setBaseCors(res) {
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export async function OPTIONS(req, res) {
  // Hinweis: Bei Vercel Functions wird normalerweise die default-Function genutzt.
  // Wir beantworten OPTIONS zusätzlich hier "sicher".
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  setBaseCors(res);
  return res.status(204).end();
}
// --- Ende CORS-Block ---

import { jsPDF } from "jspdf";

// (Optional – wird in deinem Code nicht genutzt)
const escapeHtml = (unsafe) => {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

function extractTextFromMessage(message) {
  let content = message.content;
  let speakerName = "";
  if (message.role === "assistant") {
    const styleMatch = content.match(/^(\S+:\s*)?\[(.*?)\]\s*\[(.*?)\]\s*/);
    if (styleMatch) {
      speakerName = styleMatch[2];
      content = content.substring(styleMatch[0].length).trim();
    }
  }
  return { speakerName, content };
}

export default async function handler(req, res) {
  // --- CORS (robust) ---
  const origin = req.headers.origin || "";
  const allowed = [
    "https://www.dieterbickenbach.de",
    "https://reflecting-team-ai-leadmagnet.vercel.app",
    "http://localhost:3000",
  ];
  if (origin && (allowed.includes(origin) || origin.endsWith(".vercel.app"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (ALLOWED_ORIGIN === "*") {
    // Fallback, wenn du testweise alles erlauben willst:
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Vary", "Origin");
  setBaseCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // ---- Request-Body sicher lesen ----
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const { conversation } = body || {};
    if (!Array.isArray(conversation) || conversation.length === 0) {
      return res.status(400).json({ error: "Kein Gesprächsverlauf empfangen." });
    }

    // ---- PDF-Erstellung mit jsPDF ----
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const usableWidth = pageWidth - 2 * margin;
    let y = margin;

    // Titel
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Resonanz-Bericht", margin, y);
    y += 15;

    // Gesprächsverlauf
    for (const message of conversation) {
      const { speakerName, content } = extractTextFromMessage(message);

      if (y > 270) { // Seitenumbruch
        doc.addPage();
        y = margin;
      }

      doc.setFontSize(10);
      if (message.role === "user") {
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100);
        const textLines = doc.splitTextToSize(`Sie: ${content}`, usableWidth);
        doc.text(textLines, margin, y);
        y += textLines.length * 5;
      } else {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        if (speakerName) {
          doc.text(`${speakerName}:`, margin, y);
          y += 6;
        }
        doc.setFont("helvetica", "normal");
        const textLines = doc.splitTextToSize(content, usableWidth);
        doc.text(textLines, margin, y);
        y += textLines.length * 5;
      }
      y += 8;
    }

    // ---- PDF senden (wichtig: ArrayBuffer -> Buffer) ----
    const pdfArrayBuffer = doc.output("arraybuffer");
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Resonanz-Bericht.pdf"');
    return res.status(200).send(pdfBuffer);

  } catch (error) {
    console.error("Detaillierter Fehler bei PDF-Erstellung:", error);
    return res.status(500).json({ error: "PDF konnte nicht erstellt werden." });
  }
}
