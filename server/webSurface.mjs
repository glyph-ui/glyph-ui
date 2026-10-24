/**
 * Public web surface: glyph-ui.com is Sitz `web`, °_Agent only.
 * Admin (Grok Build / ^_Code) stays on loopback.
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */

import { PACK_TOKENS } from "../shared/contextMeter.mjs";

export const WEB_SEAT = "web";
export const WEB_AGENT_ID = "glyph-agent";
export const WEB_COOKIE = "glyph_web";

const DEFAULT_WEB_HOSTS = ["glyph-ui.com", "www.glyph-ui.com"];

export function normalizeHostname(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .split(",")[0]
    .trim()
    .split(":")[0]
    .replace(/\.$/, "");
}

export function extraWebHosts(raw = process.env.GLYPH_WEB_HOSTS) {
  return String(raw || "")
    .split(",")
    .map((s) => normalizeHostname(s))
    .filter(Boolean);
}

export function isWebHostname(host, extra = process.env.GLYPH_WEB_HOSTS) {
  const h = normalizeHostname(host);
  if (!h) return false;
  if (DEFAULT_WEB_HOSTS.includes(h)) return true;
  return extraWebHosts(extra).includes(h);
}

export function requestHostname(req) {
  const xf = String(req?.get?.("x-forwarded-host") || req?.headers?.["x-forwarded-host"] || "")
    .split(",")[0]
    .trim();
  const host = xf || String(req?.get?.("host") || req?.headers?.host || "");
  return normalizeHostname(host);
}

export function isWebRequest(req) {
  return isWebHostname(requestHostname(req));
}

export function defaultAgentIdForSeat(seat, envAgent) {
  const s = String(seat || "").trim().toLowerCase();
  if (s === WEB_SEAT || s.startsWith(`${WEB_SEAT}:`)) return WEB_AGENT_ID;
  const id = String(envAgent || "").trim();
  return id || "grok";
}

export function agentAllowedOnSeat(seat, agentId) {
  // web:<token>-Seats (Geräte-Sessions) sind Web-Surface → nur °_Agent.
  const s = String(seat || "").trim().toLowerCase();
  if (s !== WEB_SEAT && !s.startsWith(`${WEB_SEAT}:`)) return true;
  const id = String(agentId || "");
  return id === WEB_AGENT_ID || id === "agent";
}

export function parseCookie(header, name) {
  const raw = String(header || "");
  if (!raw || !name) return "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k !== name) continue;
    try {
      return decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      return part.slice(i + 1).trim();
    }
  }
  return "";
}

/**
 * Kanonischer Pfad für Sicherheitsprüfungen.
 *
 * Express routet standardmäßig case-insensitiv und ohne Strict-Slashes:
 * `/API/sessions` trifft die Route `/api/sessions`. Die Prüfungen hier
 * verglichen aber den rohen `req.path` — dadurch galten `/API/...` als
 * „keine API“ und umgingen Web-Tor, Admin-Sperre und CSRF-Guard. Deshalb:
 * dekodieren, Kleinschreibung, doppelte/abschließende Slashes und `.`/`..`
 * normalisieren — dieselbe Sicht, die Express beim Routen hat.
 *
 * @param {string} raw
 * @returns {string}
 */
export function normalizeRequestPath(raw) {
  let p = String(raw || "").split("?")[0].split("#")[0];
  try {
    p = decodeURIComponent(p);
  } catch {
    /* kaputte Kodierung: Rohwert weiter verwenden */
  }
  p = p.replace(/\\/g, "/");
  const out = [];
  for (const seg of p.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      out.pop();
      continue;
    }
    out.push(seg);
  }
  const norm = `/${out.join("/")}`.toLowerCase();
  return norm === "/" ? "/" : norm.replace(/\/+$/, "");
}

const WEB_ADMIN_PREFIXES = [
  "/api/bindings",
  "/api/models",
  "/api/code/",
  "/api/wiki/open",
  "/api/workspace/open",
  "/api/activity",
  "/api/recurring",
  "/api/voice",
  "/api/tts",
];

/** Grok-disk / admin routes the Web-Fläche must not reach. */
export function isWebAdminApi(path) {
  const p = normalizeRequestPath(path);
  for (const prefix of WEB_ADMIN_PREFIXES) {
    if (p === prefix || p.startsWith(prefix)) return true;
  }
  if (p === "/api/sessions" || p.startsWith("/api/sessions/cleanup")) return true;
  if (/^\/api\/sessions\/[^/]+$/.test(p)) return true;
  if (/^\/api\/sessions\/[^/]+\/(open|close)$/.test(p)) return true;
  return false;
}

/**
 * New password for the Web-Tor. Caller still checks the current password.
 * @returns {{ ok: true, password: string } | { ok: false, error: string }}
 */
/**
 * Mindestlänge 4 Zeichen, keine Zeichenklassen-Regeln.
 *
 * Bewusste Entscheidung des Eigentümers: das Kennwort ist ein Zugangsschloss
 * für eine private Instanz, kein Bank-Login. Wer es ändern kann, ändert es
 * sofort, wenn etwas kompromittiert wirkt. Deshalb keine Vorschriften zu
 * Buchstaben, Ziffern, Symbolen — jede Mischung ist gleich gut.
 */
const WEB_PASSWORD_MIN = 4;

export function validateNewWebPassword(next, current) {
  const n = String(next ?? "");
  if (!n) return { ok: false, error: "Neues Passwort fehlt" };
  if (n !== n.trim()) {
    return { ok: false, error: "Kein Leerzeichen am Rand" };
  }
  if (n.length < WEB_PASSWORD_MIN) {
    return { ok: false, error: `Mindestens ${WEB_PASSWORD_MIN} Zeichen` };
  }
  if (n.length > 200) return { ok: false, error: "Zu lang (max. 200)" };
  if (current != null && n === String(current)) {
    return { ok: false, error: "Neues Passwort ist gleich dem alten" };
  }
  return { ok: true, password: n };
}

/**
 * Einzige Freigabe für die Web-Fläche.
 * Das Kennwort-Tor ruft `password`: Tür auf, kein Paket.
 * Später ruft Aufladen serverseitig `aufladen` und schreibt das Paket.
 * Kein HTTP-Feld darf `source` setzen.
 * @param {{ source?: string, packTokens?: number }} input
 * @returns {{ ok: true, access: { source: string, opened: true, packTokens: number, consumed: number } } | { ok: false, error: string }}
 */
export function grantWebAccess(input) {
  const source = input?.source;
  if (source !== "password" && source !== "aufladen") {
    return { ok: false, error: "Unbekannte Freigabe" };
  }
  // Rolle: „owner" (Haupt-Passwort) oder „guest" (Gast-Passwort). Der Gast
  // kommt herein und darf chatten, aber keine Einstellungen ändern — vor allem
  // nicht das Passwort. Vorher gab es nur „drin oder nicht"; deshalb konnte
  // jeder Gast den Zugang übernehmen, indem er das Passwort neu setzte.
  const role = input?.role === "guest" ? "guest" : "owner";
  if (source === "password") {
    return {
      ok: true,
      access: { source, role, opened: true, packTokens: 0, consumed: 0 },
    };
  }
  const raw = Number(input?.packTokens);
  const packTokens = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : PACK_TOKENS;
  return {
    ok: true,
    access: { source, role, opened: true, packTokens, consumed: 0 },
  };
}

/** What the gate may show. Hides a consumed counter. */
export function publicWebAccess(access) {
  if (!access?.opened) {
    return { opened: false, source: null, packTokens: 0, role: null };
  }
  const role = access.role === "guest" ? "guest" : "owner";
  if (access.source === "aufladen") {
    return {
      opened: true,
      source: "aufladen",
      packTokens: Number(access.packTokens) || 0,
      role,
    };
  }
  return { opened: true, source: "password", packTokens: 0, role };
}

function storedAccess(raw) {
  const grant = grantWebAccess({
    source: raw?.source,
    packTokens: raw?.packTokens,
    // Rolle MUSS mit: ohne sie käme jede gespeicherte Sitzung als „owner"
    // zurück und ein Gast wäre nach einem Neustart Hauptnutzer.
    role: raw?.role,
  });
  if (!grant.ok) return null;
  const consumed = Number(raw?.consumed);
  return {
    ...grant.access,
    consumed: Number.isFinite(consumed) && consumed > 0 ? Math.floor(consumed) : 0,
  };
}

export function isWebGateExempt(req) {
  const method = String(req?.method || "GET").toUpperCase();
  const path = normalizeRequestPath(req?.path || req?.url || "");
  if (path === "/api/web-gate") return method === "GET" || method === "POST";
  if (path.startsWith("/api") || path.startsWith("/ws") || path.startsWith("/docs")) {
    return false;
  }
  return true;
}

/**
 * HTTPS origin for the public web hosts (exact hostname, port 443 omitted).
 * Rejects substring tricks like glyph-ui.com.evil.example.
 */
export function isWebOrigin(origin, extra = process.env.GLYPH_WEB_HOSTS) {
  if (!origin) return false;
  try {
    const u = new URL(String(origin));
    if (u.protocol !== "https:") return false;
    if (u.port && u.port !== "443") return false;
    return isWebHostname(u.hostname, extra);
  } catch {
    return false;
  }
}

/** Cookie Max-Age (30 Tage). Sitzungen auf Disk nutzen dasselbe Fenster. */
export const WEB_SESSION_TTL_S = 2592000;
/**
 * Gäste fliegen nach 30 Minuten raus — der Hauptzugang bleibt 30 Tage.
 *
 * Grund: ein Gastpasswort wird weitergegeben (an Kunden, Kollegen, mal per
 * Chat). Es soll nicht Monate später noch gültig sein, nur weil das Gerät
 * offen liegen blieb. Der Eigentümer braucht dagegen eine dauerhafte Sitzung,
 * sonst müsste er sich täglich neu anmelden.
 */
export const WEB_GUEST_SESSION_TTL_S = 1800;
/** Harte Kappe, damit die Datei nicht unbegrenzt wächst. */
export const WEB_SESSIONS_MAX = 40;

/** Sitzungsdauer in Sekunden — abhängig von der Rolle des Zugangs. */
export function sessionTtlS(access) {
  return access?.role === "guest" ? WEB_GUEST_SESSION_TTL_S : WEB_SESSION_TTL_S;
}

/**
 * Lesbare Sitzungsliste aus web-sessions.json.
 * Akzeptiert `{tokens:[{token,iat}]}` oder ein nacktes Array.
 */
export function parseStoredWebSessions(raw, now = Date.now()) {
  let list = [];
  if (Array.isArray(raw?.tokens)) list = raw.tokens;
  else if (Array.isArray(raw)) list = raw;
  const out = [];
  const seen = new Set();
  for (const row of list) {
    const token = typeof row === "string" ? row : String(row?.token || "");
    if (!token || seen.has(token)) continue;
    const iat = typeof row === "string" ? now : Number(row?.iat);
    const issued = Number.isFinite(iat) && iat > 0 ? iat : now;
    const access = typeof row === "object" && row ? storedAccess(row.access) : null;
    // Die Rolle entscheidet über die Dauer — deshalb erst hier prüfen.
    if (now - issued >= sessionTtlS(access) * 1000) continue;
    seen.add(token);
    out.push(access ? { token, iat: issued, access } : { token, iat: issued });
  }
  if (out.length > WEB_SESSIONS_MAX) {
    out.sort((a, b) => b.iat - a.iat);
    return out.slice(0, WEB_SESSIONS_MAX);
  }
  return out;
}

export function serializeWebSessions(entries) {
  const tokens = Array.isArray(entries) ? entries : [];
  return `${JSON.stringify({ tokens }, null, 2)}\n`;
}
