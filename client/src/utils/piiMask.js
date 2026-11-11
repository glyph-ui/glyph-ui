/**
 * PII-Maskierung: Adressen, Firmennamen, E-Mails, Telefonnummern erkennen
 * und für die Anzeige schwärzen.
 *
 * Schutz vor versehentlicher Offenlegung in Screenshots, Chat-Verlauf und
 * Cloud-Kontext. Die Originaldatei bleibt unverändert.
 */

// Deutsche Straßennamen mit Hausnummer
const STREET_RE =
  /\b[A-ZÄÖÜ][A-Za-zäöüß-]+?(?:straße|str\.|weg|platz|allee|gasse|ring|damm|chaussee|ufer|garten|park)\s+\d+[a-z]?\b/gi;

// PLZ + Ort
const PLZ_RE = /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?/g;

// Firmennamen mit Rechtsform
const COMPANY_RE =
  /\b[A-ZÄÖÜ][A-Za-zäöüß&\s.,-]{2,}?(?:GmbH|AG|mbH|UG|e\.V\.|KG|OHG|SE|KGaA|GmbH\s*&\s*Co\.?\s*KG)\b/g;

// E-Mail-Adressen
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// Deutsche Telefonnummern
const PHONE_RE =
  /\b(?:\+49|0)\s?\d{2,4}[\s/()-]*\d{3,}[\s/()-]*\d{0,}\b/g;

// Anrede + Name (Herr/Frau + Nachname)
const PERSON_RE = /\b(?:Herr|Frau|Dr\.?|Prof\.?|Dipl\.?[- ]?\w*)\s+[A-ZÄÖÜ][a-zäöüß]{2,}\b/g;

const ALL_PATTERNS = [
  STREET_RE,
  PLZ_RE,
  COMPANY_RE,
  EMAIL_RE,
  PHONE_RE,
  PERSON_RE,
];

/**
 * PII in reinem Text maskieren.
 * @param {string} text
 * @returns {string} Text mit maskierten PII-Stellen (████████)
 */
export function maskPiiText(text) {
  let result = String(text ?? "");
  for (const pattern of ALL_PATTERNS) {
    result = result.replace(pattern, "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588");
  }
  return result;
}

/**
 * PII-Regionen in pdf.js-Textinhalt finden (für Overlay auf der Canvas).
 *
 * @param {Array<{str: string, transform: number[], width: number, height: number}>} textItems
 *   pdf.js `page.getTextContent().items`
 * @returns {Array<{x: number, y: number, w: number, h: number}>}
 *   Rechtecke in PDF-Koordinaten (transform[4], transform[5], width, height)
 */
export function findPiiRegions(textItems) {
  const regions = [];
  for (const item of textItems || []) {
    if (!item?.str) continue;
    let masked = false;
    for (const pattern of ALL_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(item.str)) {
        masked = true;
        break;
      }
    }
    if (!masked) continue;
    const t = item.transform || [1, 0, 0, 1, 0, 0];
    regions.push({
      x: t[4],
      y: t[5],
      w: item.width || item.str.length * 6,
      h: item.height || 12,
    });
  }
  return regions;
}

/**
 * Prüft ob ein Text PII enthält (für schnelle Anzeige-Entscheidung).
 * @param {string} text
 * @returns {boolean}
 */
export function containsPii(text) {
  const s = String(text ?? "");
  return ALL_PATTERNS.some((p) => {
    p.lastIndex = 0;
    return p.test(s);
  });
}
