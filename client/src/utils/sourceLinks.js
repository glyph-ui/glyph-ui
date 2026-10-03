/**
 * sourceLinks — reine Helfer für Quellen-Chips und das Quelldatei-Fenster.
 *
 * Der Agent liefert Quellen strukturiert im Trace (`sources.vault.files`); ältere
 * Antworten haben nur `items` (Pfad-Strings). Beide Formen werden hier vereinheitlicht,
 * dazu die URLs fürs Anzeigen (Proxy) und Öffnen (Obsidian).
 *
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */

const MAX_CHIPS = 6;

/** "pdf" | "md" | "web" — aus `kind`, sonst aus URL/Endung. */
export function sourceKind(file) {
  const k = String(file?.kind || "").toLowerCase();
  if (k === "pdf" || k === "md" || k === "web") return k;
  const loc = String(file?.url || file?.path || "");
  if (/^https?:\/\//i.test(loc)) return "web";
  return loc.toLowerCase().endsWith(".pdf") ? "pdf" : "md";
}

/**
 * Kurzes Anzeige-Label: Dateiname bzw. host/…/datei — nicht die volle URL.
 * @param {string} url
 * @param {number} [max]
 */
export function shortLinkLabel(url, max = 36) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw) && looksLikeVaultFile(raw)) {
    return raw.split("/").pop() || raw;
  }
  try {
    const abs = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(abs);
    const host = u.host.replace(/^www\./i, "");
    const segs = u.pathname.split("/").filter(Boolean);
    const last = segs.length ? decodeURIComponent(segs[segs.length - 1]) : "";
    let s = !last ? host : segs.length === 1 ? `${host}/${last}` : `${host}/…/${last}`;
    if (s.length > max) {
      const keepLast = last.length > 22 ? `${last.slice(0, 20)}…` : last;
      const hostRoom = Math.max(12, max - keepLast.length - 4);
      const h = host.length > hostRoom ? `${host.slice(0, hostRoom - 1)}…` : host;
      s = keepLast ? `${h}/…/${keepLast}` : `${h}…`;
    }
    return s;
  } catch {
    return raw.length > max ? `${raw.slice(0, max - 1)}…` : raw;
  }
}

/**
 * Anzeigewort fuer einen Web-Link: nur die Domain, z. B. `dguv.de`.
 *
 * Warum nicht `shortLinkLabel`: das baute `host/…/letzter-pfadteil` und blieb
 * damit lang, ohne etwas zu erklaeren — der Pfad steht vollstaendig im Tooltip
 * und im Vorschaufenster, dem Link folgen kann man dort ebenfalls. Im Chat
 * genuegt das Wort.
 *
 * Nicht-URLs (Vault-Pfade) bekommen wie bisher den Dateinamen.
 */
export function siteLabel(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) return shortLinkLabel(raw);
  try {
    const host = new URL(raw).host.replace(/^www\./i, "");
    return host || shortLinkLabel(raw);
  } catch {
    return shortLinkLabel(raw);
  }
}

/** Letztes Pfadsegment, hart gekuerzt — nur zur Unterscheidung gleicher Domains. */
function tailSlug(url) {
  try {
    const segs = new URL(url).pathname.split("/").filter(Boolean);
    const last = decodeURIComponent(segs[segs.length - 1] || "");
    if (!last) return "";
    return last.length > 18 ? `${last.slice(0, 17)}…` : last;
  } catch {
    return "";
  }
}

/**
 * Seitentitel fuer den Chip. Leer, wenn keiner geliefert wurde oder der
 * "Titel" selbst nur eine URL ist — dann faellt die Anzeige auf die Domain
 * zurueck. Gekuerzt, weil ein Titel sonst eine ganze Zeile fuellt; der volle
 * Text steht im Tooltip und im Vorschaufenster.
 */
function usableTitle(raw, max = 60) {
  const t = String(raw || "").replace(/\s+/g, " ").trim();
  if (!t || /^https?:\/\//i.test(t)) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Titel setzen, wo noch keiner steht: Domain als Rueckfall, und nur wenn
 * dieselbe Domain mehrfach vorkommt mit kurzem Zusatz, damit die Chips
 * unterscheidbar bleiben. Echte Seitentitel bleiben unangetastet.
 */
function withSiteLabels(list) {
  const counts = new Map();
  for (const it of list) {
    if (it.title) continue;
    const base = siteLabel(it.url);
    counts.set(base, (counts.get(base) || 0) + 1);
  }
  return list.map((it) => {
    if (it.title) return it;
    const base = siteLabel(it.url);
    if ((counts.get(base) || 0) < 2) return { ...it, title: base };
    const slug = tailSlug(it.url);
    return { ...it, title: slug ? `${base}/${slug}` : base };
  });
}

/** Dateiname / Kurz-URL als Anzeigetext. */
export function sourceTitle(file) {
  if (sourceKind(file) === "web") {
    const t = String(file?.title || "").trim();
    if (t && !/^https?:\/\//i.test(t) && t.length <= 40) return t;
    return shortLinkLabel(file?.url || file?.path || t);
  }
  const t = String(file?.title || "").trim();
  if (t) return t;
  const p = String(file?.path || "");
  return p.split("/").pop() || p;
}

/** Vault-Name aus dem kanonischen Pfad (/Vault/rel) — oder aus `file.vault`. */
export function sourceVault(file) {
  const v = String(file?.vault || "").trim();
  if (v) return v;
  const rest = String(file?.path || "").replace(/^\/+/, "");
  return rest.includes("/") ? rest.split("/", 1)[0] : "";
}

/** Pfad relativ zum Vault (ohne Vault-Präfix) — für obsidian://. */
export function sourceRelPath(file) {
  const rest = String(file?.path || "").replace(/^\/+/, "");
  const vault = sourceVault(file);
  if (vault && rest.startsWith(`${vault}/`)) return rest.slice(vault.length + 1);
  return rest;
}

/**
 * Trefferliste für die Chips: bevorzugt strukturierte `files`, sonst `items`.
 * @returns {Array<{path: string, title: string, kind: string, full_text?: boolean}>}
 */
export function buildSourceList(sources, limit = MAX_CHIPS) {
  const files = Array.isArray(sources?.files) ? sources.files : [];
  const items = Array.isArray(sources?.items) ? sources.items : [];
  const raw = files.length
    ? files
    : items.map((p) => ({ path: p, title: String(p).split("/").pop(), kind: sourceKind({ path: p }) }));
  return raw
    .filter((f) => f && f.path)
    .slice(0, Math.max(0, limit))
    .map((f) => ({ ...f, title: sourceTitle(f), kind: sourceKind(f) }));
}

/** Proxy-URL zum Anzeigen der Datei (Agent prüft den Vault-Scope). */
export function sourceFileUrl(path) {
  return `/api/vault/file?path=${encodeURIComponent(String(path || ""))}`;
}

/** obsidian://open?vault=<Vault>&file=<rel> — leer, wenn nicht ableitbar. */
export function obsidianUrl(file) {
  const vault = sourceVault(file);
  const rel = sourceRelPath(file);
  if (!vault || !rel) return "";
  return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(rel)}`;
}

/** Präfix für Links, die MarkdownBody als öffnenden Button rendert. */
export const VAULT_OPEN_SCHEME = "vaultopen:";

/** Pfad aus einem vaultopen:-href zurückgewinnen. */
export function pathFromOpenHref(href) {
  const h = String(href || "");
  if (!h.startsWith(VAULT_OPEN_SCHEME)) return "";
  try {
    return decodeURIComponent(h.slice(VAULT_OPEN_SCHEME.length));
  } catch {
    return "";
  }
}

const VAULT_FILE_RE = /\.(pdf|md)(?:$|[?#])/i;

/** PDF/Markdown-Pfad — auch mit Query/Hash. */
export function looksLikeVaultFile(path) {
  const p = String(path || "").split("?")[0].split("#")[0];
  return VAULT_FILE_RE.test(p);
}

function _decodePath(p) {
  const s = String(p || "");
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Web-URLs aus dem Trace fuer die Chip-Leiste.
 *
 * `sources.web.files` traegt den Seitentitel (die Engine liefert ihn seit
 * Kurzem mit), `items` nur die URL — Antworten von vorher haben noch keine
 * files, die fallen auf die Domain zurueck.
 * @returns {Array<{url: string, title: string, kind: "web"}>}
 */
export function buildWebList(web, limit = MAX_CHIPS) {
  const files = Array.isArray(web?.files) ? web.files : [];
  const items = Array.isArray(web?.items) ? web.items : Array.isArray(web) ? web : [];
  const rows = files.length
    ? files
    : items.map((it) =>
        typeof it === "string" ? { url: it } : { url: it?.url || it?.link },
      );
  const out = [];
  const seen = new Set();
  const cap = Math.max(0, limit);
  if (cap > 0) {
    for (const r of rows) {
      const url = String(r?.url || "");
      if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
      seen.add(url);
      out.push({ url, title: usableTitle(r?.title), kind: "web" });
      if (out.length >= cap) break;
    }
  }
  return withSiteLabels(out);
}

/**
 * Wohin ein Markdown-href gehört — nie die Glyph-Session selbst.
 *
 * @param {string} href
 * @param {string} [origin]  z. B. location.origin; in Tests setzen
 * @returns {{ kind: "vault"|"web"|"obsidian"|"internal"|"hash", path?: string, url?: string }}
 */
export function classifyLink(href, origin = "") {
  const h = String(href || "").trim();
  if (!h) return { kind: "internal" };
  if (h.startsWith("#")) return { kind: "hash" };
  if (h.startsWith(VAULT_OPEN_SCHEME)) {
    const path = pathFromOpenHref(h);
    return path ? { kind: "vault", path } : { kind: "internal" };
  }
  if (/^obsidian:/i.test(h)) return { kind: "obsidian", url: h };
  if (/^(mailto|tel):/i.test(h)) return { kind: "web", url: h };

  // Kein Schema: Vault-Datei mit Leerzeichen im Pfad, sonst intern.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(h)) {
    if (looksLikeVaultFile(h)) return { kind: "vault", path: h };
    if (h.startsWith("/api/vault/file")) {
      try {
        const u = new URL(h, "http://glyph.local");
        const path = u.searchParams.get("path") || "";
        return path ? { kind: "vault", path } : { kind: "internal" };
      } catch {
        return { kind: "internal" };
      }
    }
  }

  const base =
    origin ||
    (typeof globalThis !== "undefined" && globalThis.location && globalThis.location.origin) ||
    "http://glyph.local";

  try {
    const u = new URL(h, base.endsWith("/") ? base : `${base}/`);
    if (u.protocol === "obsidian:") return { kind: "obsidian", url: h };

    if (u.pathname === "/api/vault/file") {
      const path = u.searchParams.get("path") || "";
      return path ? { kind: "vault", path } : { kind: "internal" };
    }

    const same = u.origin === new URL(base).origin;
    const filePath = _decodePath(u.pathname || "");

    if (looksLikeVaultFile(filePath) && (same || u.protocol === "file:")) {
      return { kind: "vault", path: filePath };
    }

    if (u.protocol === "http:" || u.protocol === "https:") {
      if (same) return { kind: "internal" };
      return { kind: "web", url: u.href };
    }
  } catch {
    /* fall through */
  }

  if (looksLikeVaultFile(h)) return { kind: "vault", path: h };
  return { kind: "internal" };
}

// --- Vault-Namen (enthalten Leerzeichen → Anker statt Whitespace-Grenze) ---
let _vaults = [];
let _vaultsVersion = 0;
const _vaultSubs = new Set();

/** Bekannte Vault-Namen setzen (aus /api/vaults). Nötig für Pfade mit Leerzeichen. */
export function setKnownVaults(list) {
  _vaults = (Array.isArray(list) ? list : [])
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  _vaultsVersion += 1;
  for (const fn of _vaultSubs) {
    try {
      fn();
    } catch {
      /* egal */
    }
  }
}

export function knownVaults() {
  return _vaults.slice();
}

/** Für useSyncExternalStore: MarkdownBody rendert neu, sobald die Namen da sind. */
export function subscribeVaults(fn) {
  _vaultSubs.add(fn);
  return () => _vaultSubs.delete(fn);
}

export function vaultsVersion() {
  return _vaultsVersion;
}

function _escRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Web-URLs (das Modell schreibt sie oft in Backticks oder nackt) ---

function _urlHref(t) {
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function _looksUrl(t) {
  if (!t || t.includes("…")) return false;
  return /^(?:https?:\/\/|www\.|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)[^\s]*\.[a-z]{2,}(?:\/|$)/i.test(t);
}

/** `` `bghm.de/…` `` und `` `kuvb.de/file.pdf` `` → echte Links (gekürzte mit „…" nicht). */
function _linkifyInlineCode(part) {
  return part.replace(/`([^`\n]+)`/g, (m, inner) => {
    const t = inner.trim();
    if (_looksUrl(t)) {
      const href = _urlHref(t);
      return `[${siteLabel(href)}](${href})`;
    }
    return m;
  });
}

/** Nackte Domains/URLs (ohne Backticks) → echte Links; überspringt Link-Ziele. */
/** Web-Endungen für blanke Domains (ohne Pfad) — schützt „x.md" vor Domain-Ergebnis. */
const BARE_TLDS =
  "de|com|org|net|eu|info|biz|online|site|shop|io|ai|ch|at|nl|dk|se|no|pl|fr|es|it|cz|uk|us|gov|edu";

const URL_ISH =
  /^((?:https?:\/\/|www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/?\S*)$/i;

/**
 * Zitier-Ballast der Schwarm-Synthese entfernen (Meldung 2026-10-02):
 * „( WEB a.de ; WEB b.de )" wird zu „a.de · b.de". Nur reine URL-Gruppen in
 * Klammern werden aufgelöst — normale Klammerzusätze („(Kapitel 7)") bleiben.
 */
function _tidyCitations(part) {
  let out = part.replace(/\bWEB\s+(?=((?:https?:\/\/|www\.)?[a-z0-9][a-z0-9-]*\.))/gi, "");
  out = out.replace(/\(([^()]+)\)/g, (m, inner) => {
    const pieces = inner
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!pieces.length) return m;
    if (!pieces.every((s) => URL_ISH.test(s))) return m;
    return ` ${pieces.join(" · ")} `;
  });
  return out;
}

function _autolinkWeb(part) {
  const wrap = (m, t) => {
    if (t.includes("…")) return m;
    // bereits erzeugtes Link-Ziel oder Link-Text → nicht doppelt umschließen
    if (m[0] === "(" || m[0] === "]") return m;
    const prefix = m.slice(0, m.length - t.length);
    const href = _urlHref(t);
    return `${prefix}[${siteLabel(href)}](${href})`;
  };
  // Mit Pfad (beliebige Endung) …
  const rePath =
    /(?:^|[\s(„"“»>*])((?:https?:\/\/|www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(?:[a-z0-9-]+\.)*[a-z]{2,}\/[^\s)"'`<>]*)/gi;
  // … und blanke Domains: nur bekannte Web-Endungen, damit Dateinamen
  // („Verarbeitungslog.md") nie zur Domain werden. Nutzer-Meldung 2026-10-02:
  // „berliner-feuerwehr.de" ohne Schrägstrich blieb Text statt Knopf.
  const reBare = new RegExp(
    `(?:^|[\\s(„"“»>*])((?:https?:\\/\\/|www\\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\\.(?:${BARE_TLDS}))(?![a-z0-9-])`,
    "gi",
  );
  return part.replace(rePath, wrap).replace(reBare, wrap);
}

function _linkifyVault(part) {
  if (!_vaults.length || !part.includes(".")) return part;
  const alt = _vaults
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(_escRe)
    .join("|");
  const re = new RegExp(
    `(?:^|[\\s(„"“»>*])((?:\\/)?(?:${alt})\\/[^\\n)"'\`|<>*]+?\\.(?:pdf|md|PDF|MD))`,
    "gi",
  );
  return part.replace(re, (match, path) => {
    const prefix = match.slice(0, match.length - path.length);
    // Relative /api/…-URL: react-markdown streicht unbekannte Schemas (vaultopen:).
    return `${prefix}[${sourceTitle({ path })}](${sourceFileUrl(path)})`;
  });
}

/**
 * Macht Quellen im Antworttext klickbar: URLs in Backticks, nackte Domains und
 * Vault-Pfade. Code-Blöcke (```) bleiben unangetastet.
 */
export function linkifyAnswer(text) {
  const src = String(text ?? "");
  if (!src) return src;
  const parts = src.split(/(```[\s\S]*?```)/);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // Fenced-Codeblock
      let p = _linkifyInlineCode(part);
      p = _tidyCitations(p);
      p = _autolinkWeb(p);
      p = _linkifyVault(p);
      return p;
    })
    .join("");
}

/**
 * Vault-Pfade anklickbar (Nur-Vault-Variante, abwärtskompatibel für Tests).
 * Code-Blöcke bleiben unangetastet, URLs werden übersprungen.
 */
export function linkifyVaultPaths(text) {
  const src = String(text ?? "");
  if (!src || (!src.includes(".pdf") && !src.includes(".md") && !src.includes(".PDF") && !src.includes(".MD"))) {
    return src;
  }
  const parts = src.split(/(```[\s\S]*?```)/);
  return parts.map((part, i) => (i % 2 === 1 ? part : _linkifyVault(part))).join("");
}
