/**
 * Suchtreffer in Text aufteilen (rein, ohne DOM).
 *
 * Grund: Das Quellen-Fenster markiert Treffer früher per DOM-Umbau im
 * React-Baum. Beim Schliessen des Fensters versuchte React danach, genau
 * diesen Knoten zu entfernen — er war nicht mehr da → Absturz → weisse
 * Seite. Die Markierung läuft jetzt ueber React, die Aufteilung hier.
 */

/**
 * @param {string} text
 * @param {string} query
 * @returns {{text: string, hit: boolean}[]}
 */
export function splitByQuery(text, query) {
  const src = String(text ?? "");
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return [{ text: src, hit: false }];
  const lower = src.toLowerCase();
  const out = [];
  let from = 0;
  let i = lower.indexOf(q, from);
  while (i >= 0) {
    if (i > from) out.push({ text: src.slice(from, i), hit: false });
    out.push({ text: src.slice(i, i + q.length), hit: true });
    from = i + q.length;
    i = lower.indexOf(q, from);
  }
  if (from < src.length) out.push({ text: src.slice(from), hit: false });
  return out.length ? out : [{ text: src, hit: false }];
}
