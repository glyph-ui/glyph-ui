/**
 * webScope — serverseitige Freigabe für die Web-Fläche (glyph-ui.com).
 *
 * Grund (Prüfung 2026-10-03): Die Auswahl „was Kunden sehen“ filterte bisher nur
 * die ANZEIGE im Browser. Der Server lieferte grundsätzlich alles außer Privat —
 * inklusive Mandanten-Auditberichten mit Namen und Firmen. Für Fremde muss die
 * Sperre im Zugriff selbst greifen: Whitelist der Sammlungen, Sperrliste für
 * Pfade, dazu eine Namens-Maske in den Treffer-Auszügen.
 *
 * Konfiguration: `~/.glyph-ui/web-scope.json`
 *   {
 *     "vaults":    ["ASI, BS. UWS, QM, EM", "HSEQ Sync"],   // erlaubte Sammlungen
 *     "denyPaths": ["00 Arbeitsfluss/Eingang", "..."],        // gesperrte Ordner
 *     "redact":    true                                        // Namen in Auszügen maskieren
 *   }
 * Nicht gesetzte Felder fallen auf die Default-Werte unten zurück. Die Datei
 * kann ohne Neustart geändert werden (wird pro Anfrage gelesen).
 *
 * WICHTIG: Die Defaults sind ein Anfangsstand — bitte selbst durchsehen, was
 * Kunden sehen dürfen. Besonders `Vorlagen/` enthält teils echte Kundendokumente.
 *
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/** Anfangsstand — bewusst eng, aber: bitte einmal selbst prüfen. */
export const DEFAULT_WEB_SCOPE = Object.freeze({
  vaults: Object.freeze(["ASI, BS. UWS, QM, EM", "HSEQ Sync"]),
  denyPaths: Object.freeze([
    "00 Arbeitsfluss/Eingang",
    "00 Arbeitsfluss/Fertig",
    "99 Zwischenablage",
    "Vorlagen/Jobs",
  ]),
  redact: true,
});

/** Konfiguration lesen; fehlt/unlesbar gilt der Anfangsstand. */
export function loadWebScope(stateDir = path.join(os.homedir(), ".glyph-ui")) {
  const file = path.join(stateDir, "web-scope.json");
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8")) || {};
  } catch {
    raw = {};
  }
  const list = (v) => (Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : null);
  return {
    vaults: list(raw.vaults) || [...DEFAULT_WEB_SCOPE.vaults],
    denyPaths: list(raw.denyPaths) || [...DEFAULT_WEB_SCOPE.denyPaths],
    redact: raw.redact !== false,
    file,
  };
}

/**
 * Pfad normalisieren: Backslashes, führende Slashes, `.`/`..`.
 * Ein `..`, das aus dem Root herausführen würde, ergibt "" (→ abgelehnt).
 * Sonst könnte `ErlaubterVault/../../Privat/x` die denyPaths-Prüfung umgehen:
 * Der Präfix-Vergleich sah nur den erlaubten Vault, der Rest enthielt `..`.
 */
function normPath(p) {
  const raw = String(p || "").replace(/\\/g, "/");
  const out = [];
  for (const seg of raw.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      if (out.length === 0) return "";
      out.pop();
      continue;
    }
    out.push(seg);
  }
  return out.join("/");
}

/**
 * Darf die Web-Fläche diesen Pfad sehen? Pfadangaben wie im Index:
 * `/Sammlung/rel/Datei.md` oder `Sammlung/rel/Datei.md`.
 */
export function isPathAllowed(p, scope) {
  const rel = normPath(p);
  if (!rel) return false;
  const vault = rel.split("/")[0];
  if (!vault || !scope.vaults.includes(vault)) return false;
  const rest = rel.slice(vault.length + 1);
  for (const d of scope.denyPaths) {
    const dd = normPath(d);
    if (dd && (rest === dd || rest.startsWith(`${dd}/`))) return false;
  }
  return true;
}

/**
 * Namen, Ansichten, Mails, Telefonnummern in Auszügen maskieren.
 * Vorsicht: das ist ein Sieb, keine Garantie — der Schutz besteht darin,
 * heikle Dokumente gar nicht freizugeben (denyPaths).
 */
export function redact(text) {
  let s = String(text ?? "");
  // Anreden plus Namen, auch mit Kürzeln („Hr. A. Hubert“)
  s = s.replace(
    /\b(?:Hr\.?|Frau|Fr\.?|Dr\.?|Prof\.?)\s+(?:[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]*\.?\s*)+/g,
    "…",
  );
  s = s.replace(/[\w.+-]+@[\w-]+\.[A-Za-z]{2,}/g, "…");
  s = s.replace(/\+?\d{2,4}[\s-]\d{3,4}[\s-]\d{3,8}/g, "…");
  return s;
}

/** Trefferliste für die Web-Fläche: nur freigegebene Pfade, Auszüge maskiert. */
export function filterHits(hits, scope) {
  const out = [];
  for (const h of Array.isArray(hits) ? hits : []) {
    if (!h) continue;
    if (h.kind === "web") {
      out.push(h);
      continue;
    }
    if (!isPathAllowed(h.path, scope)) continue;
    out.push(scope.redact ? { ...h, excerpt: redact(h.excerpt) } : h);
  }
  return out;
}

/** Vault-Liste für die Web-Fläche: nur freigegebene Sammlungen, keine Pfade. */
export function filterVaults(json, scope) {
  const rows = Array.isArray(json?.vaults)
    ? json.vaults
    : Array.isArray(json)
      ? json
      : [];
  const keep = rows
    .filter((v) => v && scope.vaults.includes(String(v.name || v.id || "")))
    .map((v) => {
      const { path: _p, ...rest } = v;
      return rest;
    });
  return Array.isArray(json?.vaults) ? { ...json, vaults: keep } : keep;
}
