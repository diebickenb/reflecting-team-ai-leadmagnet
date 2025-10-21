// --- CORS / Sicherheit -------------------------------------------------------
const ALLOWED_STATIC = [
  "https://www.dieterbickenbach.de",
  "https://reflecting-team-ai-leadmagnet.vercel.app",
  "http://localhost:3000",
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL || "";
  return (
    (envOrigin && origin === envOrigin) ||
    ALLOWED_STATIC.includes(origin) ||
    origin.endsWith(".vercel.app")
  );
}

function setCors(req, res) {
  const origin = req.headers.origin || "";
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

// --- Imports -----------------------------------------------------------------
import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";

// --- Fonts: Modul-Cache (nur pro Cold-Start laden) ---------------------------
let FONT_CACHE = null; // { regular, bold, italic } base64 strings
function loadFontCacheOnce() {
  if (FONT_CACHE) return FONT_CACHE;
  const dir = path.join(process.cwd(), "public", "fonts");
  const tryRead = (file) => {
    try {
      const p = path.join(dir, file);
      if (fs.existsSync(p)) return fs.readFileSync(p, "base64");
    } catch (e) {
      console.warn("[pdf] Font read failed:", file, e?.message);
    }
    return null;
  };
  FONT_CACHE = {
    regular: tryRead("NotoSans-Regular.ttf"),
    bold: tryRead("NotoSans-Bold.ttf"),
    italic: tryRead("NotoSans-Italic.ttf"),
  };
  if (!FONT_CACHE.regular) {
    console.warn("[pdf] NotoSans-Regular.ttf fehlt – falle auf Helvetica zurück.");
  }
  return FONT_CACHE;
}

function registerFonts(doc) {
  const fonts = loadFontCacheOnce();
  let family = "helvetica";
  if (fonts.regular) {
    doc.addFileToVFS("NotoSans-Regular.ttf", fonts.regular);
    doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    family = "NotoSans";
  }
  if (fonts.bold) {
    doc.addFileToVFS("NotoSans-Bold.ttf", fonts.bold);
    doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
  }
  if (fonts.italic) {
    doc.addFileToVFS("NotoSans-Italic.ttf", fonts.italic);
    doc.addFont("NotoSans-Italic.ttf", "NotoSans", "italic");
  }
  doc.setFont(family, "normal");
  return family;
}

// --- Text-Helfer -------------------------------------------------------------
function normalizeText(s = "") {
  return String(s)
    .replace(/\r\n/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, ""); // Steuerzeichen raus
}

function extractAssistant(message) {
  // [Agent][Style] ... -> Name & gekürzter Inhalt
  let content = String(message?.content ?? "");
  let speakerName = "";
  const m = content.match(/^(\S+:\s*)?\[(.*?)\]\s*\[(.*?)\]\s*/);
  if (m) {
    speakerName = m[2];
    content = content.slice(m[0].length).trim();
  }
  return { speakerName, content };
}

// --- PDF-Writer --------------------------------------------------------------
function writeWrapped(doc, text, x, y, maxWidth, lineH) {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return lines.length * lineH;
}

// --- Handler -----------------------------------------------------------------
export default async function handler(req, res) {
  setCors(req, res);

  // Einheitlicher OPTIONS-Handler
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Origin prüfen (hart blocken, statt stillschweigend zuzulassen)
  if (!isAllowedOrigin(req.headers.origin || "")) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  try {
    // ---- Input-Validierung (leichtgewichtig) ----
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    let { conversation } = body || {};
    if (!Array.isArray(conversation) || conversation.length === 0) {
      return res.status(400).json({ error: "Kein Gesprächsverlauf empfangen." });
    }

    // weiche Limits gegen Missbrauch / OOM
    const MAX_MESSAGES = 300;
    const MAX_CHARS = 5000;
    conversation = conversation.slice(0, MAX_MESSAGES).map((m) => ({
      role: m?.role === "user" ? "user" : "assistant",
      content: normalizeText(String(m?.content || "").slice(0, MAX_CHARS)),
    }));

    // ---- PDF erstellen ----
    const doc = new jsPDF();
    const fontFamily = registerFonts(doc);

    const margin = 15;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const usableW = pageW - 2 * margin;

    const titleSize = 22;
    const fontSize = 10;
    const lineH = Math.round(fontSize * 1.25);
    let y = margin;

    // Titel
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(titleSize);
    y += writeWrapped(doc, "Resonanz-Bericht", margin, y, usableW, Math.round(titleSize * 0.6));
    y += 6;
    doc.setFontSize(fontSize);

    const ensureSpace = (need) => {
      if (y + need > pageH - margin) {
        doc.addPage();
        y = margin;
      }
    };

    for (const message of conversation) {
      if (message.role === "user") {
        doc.setFont(fontFamily, "italic");
        doc.setTextColor(100);
        const text = `Sie: ${message.content}`;
        const lines = doc.splitTextToSize(text, usableW);
        ensureSpace(lines.length * lineH + 8);
        doc.text(lines, margin, y);
        y += lines.length * lineH + 8;
      } else {
        let { speakerName, content } = extractAssistant(message);
        doc.setFont(fontFamily, "bold");
        doc.setTextColor(0);
        if (speakerName) {
          ensureSpace(lineH);
          doc.text(`${speakerName}:`, margin, y);
          y += lineH;
        }
        doc.setFont(fontFamily, "normal");
        const lines = doc.splitTextToSize(content, usableW);
        ensureSpace(lines.length * lineH + 8);
        doc.text(lines, margin, y);
        y += lines.length * lineH + 8;
      }
    }

    // Antwort
    const pdfArrayBuffer = doc.output("arraybuffer");
    const pdfBuffer = Buffer.from(pdfArrayBuffer);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Resonanz-Bericht.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error("[pdf] Fehler:", err);
    return res.status(500).json({ error: "PDF konnte nicht erstellt werden." });
  }
}
