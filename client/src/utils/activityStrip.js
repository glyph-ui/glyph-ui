/**
 * activityStrip — Bausteine für den Haiku-artigen Aktivitäts-Streifen
 * (Arbeitsprotokoll als schmaler Streifen, aufklappbar zu Einzel-Stufen).
 *
 * Reine Funktionen ohne DOM — testbar in tests/unit/activityStrip.test.js.
 *
 * Copyright (c) 2026 Alexander Hubert · SPDX-License-Identifier: MIT
 */

/** Erste Zeile eines mehrzeiligen Textes (Streifen zeigt nur eine Zeile). */
function firstLine(text) {
  const line = String(text).split("\n")[0].trim();
  return line;
}

/**
 * Neuestes Aktivitätsereignis für den Streifen: Zeile + ob die Stufe noch läuft.
 * Bevorzugt das Ergebnis der letzten Stufe (jüngstes Ereignis), sonst deren
 * Start. Ohne Live-Stufen zählt die letzte Banner-Zeile (Alt-Responses ohne
 * Streaming), sonst der Fallback.
 *
 * @param {Array<{start?: string, result?: string}>|undefined} steps Live-Stufen
 * @param {string|undefined} banner roher Banner-Text (\n-getrennt)
 * @param {string} [fallback] Fallback-Zeile
 * @returns {{line: string, running: boolean}}
 */
export function latestActivity(steps, banner, fallback = "Agent arbeitet …") {
  if (Array.isArray(steps)) {
    for (let i = steps.length - 1; i >= 0; i -= 1) {
      const s = steps[i] || {};
      const result = firstLine(s.result || "");
      if (result) return { line: result, running: false };
      const start = firstLine(s.start || "");
      if (start) return { line: start, running: true };
    }
  }
  if (banner) {
    const lines = String(banner)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length) return { line: firstLine(lines[lines.length - 1]), running: false };
  }
  return { line: fallback, running: true };
}

/**
 * Neueste Aktivitätszeile für den Streifen (ohne Phasen-Merkmal).
 *
 * @param {Array<{start?: string, result?: string}>|undefined} steps
 * @param {string|undefined} banner
 * @param {string} [fallback]
 * @returns {string}
 */
export function latestActivityLine(steps, banner, fallback = "Agent arbeitet …") {
  return latestActivity(steps, banner, fallback).line;
}

/*
  Verb-Erkennung der Stufen-Zeilen („SearchWeb · suche im Internet …“) →
  Haiku-artige Statuszeilen: „Websuche läuft …“, „Web durchsucht · 5 Treffer“.
 */
const ACTIVITY_VERBS = [
  {
    re: /^(search\s*web|websearch|web)\b/i,
    live: "Websuche läuft …",
    done: "Web durchsucht",
    keepDetail: true,
  },
  {
    re: /^(search\s*vault|vaultfind|vault)\b/i,
    live: "Suche im Vault läuft …",
    done: "Im Vault gesucht",
    keepDetail: true,
  },
  {
    re: /^(think|denk|reason)\b/i,
    live: "Antwort wird formuliert …",
    done: "Antwort formuliert",
    keepDetail: false,
  },
  {
    re: /^(read|lese)\b/i,
    live: "Datei wird gelesen …",
    done: "Datei gelesen",
    keepDetail: true,
  },
  {
    re: /^(write|schreib)\b/i,
    live: "Datei wird geschrieben …",
    done: "Datei geschrieben",
    keepDetail: true,
  },
  {
    re: /^(draft|entwurf)\b/i,
    live: "Entwurf wird formuliert …",
    done: "Entwurf formuliert",
    keepDetail: false,
  },
];

/** Detail-Teil kürzen: Quelle/Query abtrennen, Klammern entfernen. */
function trimDetail(detail) {
  return String(detail || "")
    .split(" — ")[0]
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Haiku-artige Statuszeile aus einer rohen Stufen-Zeile.
 * Unbekannte Verben bleiben unverändert (volle Nachvollzugbarkeit).
 *
 * @param {string} line rohe Stufen-Zeile („SearchWeb · suche im Internet …“)
 * @param {boolean} [running] Stufe läuft noch (Status im Präsens)
 * @returns {string}
 */
export function friendlyActivityLine(line, running = false) {
  const text = String(line || "").trim();
  if (!text) return "";
  const sep = text.indexOf("·");
  const verb = (sep >= 0 ? text.slice(0, sep) : text.split(" ")[0]).trim();
  const detail = sep >= 0 ? trimDetail(text.slice(sep + 1)) : "";
  const entry = ACTIVITY_VERBS.find((v) => v.re.test(verb));
  if (!entry) return text;
  if (running) return entry.live;
  return detail && entry.keepDetail ? `${entry.done} · ${detail}` : entry.done;
}

/**
 * Kompakte Zähler-Zeile („3 Schritte · 1 Entwurf“) für den geschlossenen
 * Streifen nach Runden-Ende und für title/aria.
 *
 * @param {number} stepCount Anzahl Stufen
 * @param {number} draftCount Anzahl Entwürfe
 * @returns {string}
 */
export function activityCounts(stepCount, draftCount) {
  const parts = [];
  if (stepCount > 0) {
    parts.push(`${stepCount} Schritt${stepCount === 1 ? "" : "e"}`);
  }
  if (draftCount > 0) {
    parts.push(draftCount === 1 ? "1 Entwurf" : `${draftCount} Entwürfe`);
  }
  return parts.join(" · ");
}

/**
 * Laufzeit im Streifen-Format: „12s“, ab einer Minute „2:05“.
 * Unbekannte Laufzeit → leerer String (Streifen zeigt dann keine Zeit).
 *
 * @param {number|null|undefined} seconds
 * @returns {string}
 */
export function formatElapsed(seconds) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    return "";
  }
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
