/**
 * HSEQ-Knopf (Obsidian) → glyph-agent.
 *
 * Der Knopf steht im Vault und wird auf jedem Gerät gedrückt: Mac, Arbeits-PC,
 * Handy. Am Mac ruft er die Engine direkt (127.0.0.1:18899). Überall sonst
 * geht er über die öffentliche Web-Fläche (glyph-ui.com) — dort ist dieser
 * Endpunkt die einzige Brücke zur Engine.
 *
 * Deshalb bewusst eng:
 * - nur eine feste Job-Liste (kein freier Proxy),
 * - Passwort des Web-Tors im Header (kein Cookie, DataviewJS kann keine
 *   fremden Cookies senden),
 * - CORS nur für Obsidians eigenen Origin,
 * - Drossel gegen Doppelklicks, Fehlversuchs-Bremse gegen Raten.
 */

/** Jobs, die der Knopf starten darf. Bewusst kurz. */
export const HSEQ_BUTTON_JOBS = Object.freeze(["td-eingang", "td-handover"]);

/** Standardjob, wenn der Aufrufer keinen nennt. */
export const HSEQ_BUTTON_DEFAULT_JOB = "td-eingang";

/** Mindestabstand zwischen zwei Läufen desselben Jobs. */
export const HSEQ_BUTTON_MIN_INTERVAL_MS = 20000;

/** Fehlversuche: ab so vielen Sperre. */
export const HSEQ_AUTH_MAX_FAILURES = 8;

/** Sperrfenster für Fehlversuche. */
export const HSEQ_AUTH_WINDOW_MS = 10 * 60 * 1000;

export function hseqJobAllowed(job) {
  return typeof job === "string" && HSEQ_BUTTON_JOBS.includes(job.trim());
}

/**
 * Obsidian rendert Notizen unter einem eigenen Origin. Desktop: `app://obsidian.md`,
 * mobile/ältere Pfade: `null`. Nur diese beiden werden zurückgespiegelt.
 */
const HSEQ_CORS_ORIGINS = Object.freeze(["app://obsidian.md", "null"]);

export function hseqCorsOrigin(origin) {
  const value = String(origin ?? "").trim();
  return HSEQ_CORS_ORIGINS.includes(value) ? value : "";
}

/** Header für Antwort und Preflight. Leer, wenn der Origin nicht erlaubt ist. */
export function hseqCorsHeaders(origin) {
  const allowed = hseqCorsOrigin(origin);
  if (!allowed) return {};
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Glyph-Password",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

/**
 * Logzeile pro Knopf-Aufruf: Status, Job, Origin, Absender. Nie das Passwort.
 * Dient der Beobachtung von `Origin: null` — kommt er wirklich von Obsidian
 * mobil, oder von fremden Seiten (Sandbox-Iframe, file://, data:)?
 */
export function hseqLogLine({ origin, client, job, status }) {
  const raw = origin == null ? "" : String(origin).trim();
  const label = raw ? raw.slice(0, 80) : "(kein)";
  const kind = hseqCorsOrigin(raw) ? "erlaubt" : "fremd";
  return (
    `[hseq] run status=${Number(status) || 0}` +
    ` job=${String(job ?? "?").slice(0, 60)}` +
    ` origin=${label} (${kind})` +
    ` client=${String(client || "?").slice(0, 64)}`
  );
}

/** Drossel für Doppelklicks. */
export function hseqThrottled(lastRunAt, now = Date.now(), minMs = HSEQ_BUTTON_MIN_INTERVAL_MS) {
  const last = Number(lastRunAt) || 0;
  if (!last) return { blocked: false, waitMs: 0 };
  const waitMs = Number(minMs) - (now - last);
  return waitMs > 0 ? { blocked: true, waitMs } : { blocked: false, waitMs: 0 };
}

/**
 * Fehlversuchs-Zähler: gibt den neuen Stand zurück und ob gesperrt wird.
 * `failures` ist ein Zeitstempel-Array je Client.
 */
export function hseqAuthState(failures, now = Date.now(), windowMs = HSEQ_AUTH_WINDOW_MS) {
  const recent = (Array.isArray(failures) ? failures : []).filter(
    (t) => Number.isFinite(Number(t)) && now - Number(t) < windowMs,
  );
  return {
    recent,
    blocked: recent.length >= HSEQ_AUTH_MAX_FAILURES,
    remainingMs: recent.length
      ? Math.max(0, windowMs - (now - recent[0]))
      : 0,
  };
}
