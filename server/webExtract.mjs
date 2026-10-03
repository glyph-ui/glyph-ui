/**
 * webExtract — Web-Seite einordnen, Einbettbarkeit prüfen, Text herausziehen.
 *
 * Quellen-Fenster: Web-Quellen laufen im <iframe>. Seiten mit X-Frame-Options
 * oder CSP `frame-ancestors` verbieten das — der Browser zeigt dann nur den
 * durchgestrichenen Kreis („keine Anzeige“). Für solche Seiten holt glyph-ui
 * den Inhalt als lesbaren Text, damit die Quelle im Fenster sichtbar bleibt.
 *
 * Reine Helfer ohne I/O — server/index.js holt das HTML, hier wird geprüft und
 * gelesen. Copyright (c) 2026 Alexander Hubert — MIT License
 */

const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const BLOCK_TAGS =
  /<(script|style|noscript|svg|iframe|template|object|canvas)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const COMMENT_RE = /<!--[\s\S]*?-->/g;
const BREAK_CLOSE =
  /<\/(p|div|section|article|header|footer|nav|aside|li|h[1-6]|tr|blockquote|pre|figure|figcaption|table|ul|ol)\s*>/gi;
const BR_RE = /<br\s*\/?>/gi;
const TAG_RE = /<[^>]+>/g;
const NUM_ENT = /&#(x?)([0-9a-f]+);/gi;
const NAMED_ENT = /&(amp|lt|gt|quot|apos|nbsp);/gi;
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export const TEXT_CAP_DEFAULT = 60000;
export const HTML_CAP = 1500000;

/** HTML-Entities (häufige + numerische) zurück in Zeichen. */
export function decodeEntities(s) {
  return String(s ?? "")
    .replace(NUM_ENT, (_m, hex, code) => {
      try {
        return String.fromCodePoint(parseInt(code, hex ? 16 : 10));
      } catch {
        return "";
      }
    })
    .replace(NAMED_ENT, (_m, name) => NAMED[name] || "");
}

/**
 * Titel + lesbaren Text aus HTML. Tags raus, Blockenden als Absatz-Umbruch,
 * Skripte/Stiles/Störgrafik komplett draußen. Kein HTML im Ergebnis — die
 * Textansicht rendert deshalb gefahrlos.
 */
export function extractReadable(html) {
  const s = String(html ?? "");
  const m = TITLE_RE.exec(s);
  let body = s.replace(COMMENT_RE, " ").replace(BLOCK_TAGS, " ");
  body = body.replace(BR_RE, "\n").replace(BREAK_CLOSE, "\n").replace(TAG_RE, " ");
  body = decodeEntities(body).replace(/\u00a0/g, " ");
  const text = body
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const title = decodeEntities(m ? m[1] : "")
    .replace(/\s+/g, " ")
    .trim();
  return { title, text };
}

/** Textlänge deckeln, mit ehrlichem Hinweis am Ende. */
export function capText(text, max = TEXT_CAP_DEFAULT) {
  const s = String(text ?? "");
  return s.length <= max ? s : `${s.slice(0, max)}\n\n[… Auszug — vollständig im Browser]`;
}

/**
 * Darf die Seite in unser <iframe>? Antwort-Header entscheiden:
 * X-Frame-Options (außer allowall) oder CSP frame-ancestors ohne * sperren.
 */
export function isEmbeddable(headers) {
  // Header-Zugriff egal wie geschrieben (Headers-Objekt oder schlichtes Objekt).
  const get = (name) => {
    if (typeof headers?.get === "function") return headers.get(name);
    if (!headers || typeof headers !== "object") return null;
    const lower = String(name).toLowerCase();
    for (const k of Object.keys(headers)) {
      if (String(k).toLowerCase() === lower) return headers[k];
    }
    return null;
  };
  const xfo = String(get("x-frame-options") || "")
    .trim()
    .toLowerCase();
  if (xfo && !xfo.includes("allowall")) return false;
  const csp = String(get("content-security-policy") || "").toLowerCase();
  const m = csp.match(/frame-ancestors\s+([^;]*)/);
  if (m) {
    const src = m[1].trim();
    if (!src || src.includes("'none'")) return false;
    if (!src.split(/\s+/).includes("*")) return false;
  }
  return true;
}

/** Grundschutz gegen SSRF: lokale/dienstinterne Hosts nicht anfassen. */
export function isPrivateHost(hostname) {
  const h = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h === "::1" ||
    h === "::" ||
    h === "0.0.0.0"
  ) {
    return true;
  }
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/** URL für den Seitenabruf prüfen: nur http/https, keine lokalen Ziele. */
export function parsePageUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return { ok: false, error: "url fehlt" };
  let u;
  try {
    u = new URL(s);
  } catch {
    return { ok: false, error: "URL ungültig" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, error: "nur http/https" };
  }
  if (isPrivateHost(u.hostname)) {
    return { ok: false, error: "lokale Adressen sind gesperrt" };
  }
  return { ok: true, url: u.toString() };
}
