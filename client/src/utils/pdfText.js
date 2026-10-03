/**
 * PDF-Textindex für die Suche: Server (pdftotext), nicht pdfjs im Browser.
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */

/**
 * @param {string} src  `/api/vault/file?path=…`
 * @returns {Promise<Array<{ page: number, text: string }>>}
 */
export async function extractPdfPages(src) {
  const raw = String(src || "");
  if (!raw) return [];
  const u = new URL(raw, "http://glyph.local");
  u.searchParams.set("format", "pages");
  const res = await fetch(`${u.pathname}?${u.searchParams.toString()}`);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(j.error || `PDF-Text HTTP ${res.status}`);
  }
  if (j && j.ok === false) {
    throw new Error(j.error || "PDF-Text nicht lesbar");
  }
  return Array.isArray(j.pages) ? j.pages : [];
}
