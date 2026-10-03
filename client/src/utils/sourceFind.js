/**
 * Textsuche für das Quellen-Fenster (PDF-Seitenindex und Markdown).
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */

/** @returns {Array<{ start: number, end: number }>} */
export function findMatchOffsets(text, query) {
  const src = String(text || "");
  const q = String(query || "").trim();
  if (!q || !src) return [];
  const hay = src.toLowerCase();
  const needle = q.toLowerCase();
  const out = [];
  let from = 0;
  while (from <= hay.length - needle.length) {
    const i = hay.indexOf(needle, from);
    if (i < 0) break;
    out.push({ start: i, end: i + needle.length });
    from = i + Math.max(1, needle.length);
  }
  return out;
}

export function snippetAround(text, start, end, pad = 36) {
  const src = String(text || "");
  const a = Math.max(0, start - pad);
  const b = Math.min(src.length, end + pad);
  const chunk = src.slice(a, b).replace(/\s+/g, " ").trim();
  return `${a > 0 ? "…" : ""}${chunk}${b < src.length ? "…" : ""}`;
}

/**
 * @param {Array<{ page: number, text: string }>} pages
 * @param {string} query
 * @returns {Array<{ page: number, snippet: string, start: number }>}
 */
export function findInPages(pages, query) {
  const q = String(query || "").trim();
  if (!q) return [];
  const hits = [];
  for (const p of pages || []) {
    const text = String(p?.text || "");
    for (const m of findMatchOffsets(text, q)) {
      hits.push({
        page: p.page,
        start: m.start,
        snippet: snippetAround(text, m.start, m.end),
      });
    }
  }
  return hits;
}
