/**
 * HSEQ-Funkauslöser über Obsidian Sync.
 *
 * Der Knopf in „00 ▶ HSEQ verarbeiten“ schreibt am Arbeits-PC keine HTTP-Anfrage
 * (dort gibt es weder glyph-agent noch eine erreichbare glyph-ui.com-Brücke),
 * sondern eine kleine Markdown-Notiz im Vault. Obsidian Sync trägt sie zum Mac.
 * Dort liest dieser Wächter die Notiz und startet denselben recurring-Job, den
 * sonst der 18:00-Scheduler fährt.
 *
 * Rollen strikt getrennt, damit Obsidian Sync keine Schreibkonflikte sieht:
 * - Trigger-Notiz: schreibt nur der Knopf (Arbeits-PC), liest nur der Mac.
 * - Status-Notiz:  schreibt nur der Mac, liest der Knopf (alle Geräte).
 *
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */

import os from "node:os";
import path from "node:path";

/** Marke der Auslöse-Zeile: `RUN <job> <token>`. */
export const HSEQ_TRIGGER_MARK = "RUN";
/** Marke der Status-Zeile: `STATUS OK|FEHLER <job> <iso> — <detail>`. */
export const HSEQ_STATUS_MARK = "STATUS";

export const HSEQ_TRIGGER_FILE_NAME = "_hseq-trigger.md";
export const HSEQ_STATUS_FILE_NAME = "_hseq-status.md";
/** Ordner im HSEQ-Vault, in dem Trigger/Status liegen. */
export const HSEQ_TRIGGER_DIR = "00 Arbeitsfluss";
/** Abstand, in dem der Mac die Trigger-Notiz liest. */
export const HSEQ_TRIGGER_POLL_MS = 5000;

function expandHome(value, home) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw === "~") return home;
  if (raw.startsWith("~/")) return path.join(home, raw.slice(2));
  return raw;
}

/**
 * Absoluter Pfad zur Trigger-Notiz.
 * `GLYPH_HSEQ_TRIGGER_FILE` gewinnt, sonst `GLYPH_HSEQ_VAULT` + Standardordner.
 * Leer = Wächter bleibt aus (Repo-Default, kein persönlicher Pfad).
 */
export function hseqTriggerFile(env = process.env, home = os.homedir()) {
  const explicit = expandHome(env.GLYPH_HSEQ_TRIGGER_FILE, home);
  if (explicit) return path.resolve(home, explicit);
  const vault = expandHome(env.GLYPH_HSEQ_VAULT, home);
  if (!vault) return "";
  return path.join(path.resolve(home, vault), HSEQ_TRIGGER_DIR, HSEQ_TRIGGER_FILE_NAME);
}

/** Status-Notiz liegt neben der Trigger-Notiz. */
export function hseqStatusFile(triggerFile) {
  const file = String(triggerFile || "").trim();
  if (!file) return "";
  return path.join(path.dirname(file), HSEQ_STATUS_FILE_NAME);
}

/**
 * Liest die letzte gültige `RUN <job> <token>`-Zeile.
 * Robust gegen Frontmatter, Prosa und halb synchronisierte Dateien.
 */
export function parseHseqTrigger(text) {
  let found = null;
  for (const line of String(text || "").split(/\r?\n/)) {
    const m = line.match(/^\s*RUN[ \t]+([A-Za-z0-9._-]+)[ \t]+([A-Za-z0-9._:-]+)\s*$/);
    if (m) found = { job: m[1], token: m[2] };
  }
  return found;
}

/** Frisch = gültig und nicht der zuletzt verarbeitete Token. */
export function hseqTriggerFresh(trigger, lastToken) {
  if (!trigger || !trigger.job || !trigger.token) return false;
  return String(trigger.token) !== String(lastToken || "");
}

/** Eindeutiger Token: Zeitstempel + Zufall, kollidiert auch im selben ms nicht. */
export function newHseqToken(now = Date.now(), rand = Math.random) {
  const iso = new Date(now).toISOString();
  const nonce = Math.floor(rand() * 0xffffff)
    .toString(16)
    .padStart(6, "0");
  return `${iso}-${nonce}`;
}

/** Inhalt der Trigger-Notiz (Referenz/Test; der Knopf schreibt dasselbe Muster). */
export function formatHseqTrigger({ job, token, created } = {}) {
  const stamp = String(created || new Date().toISOString());
  return [
    "# HSEQ Trigger",
    "",
    "Nicht von Hand bearbeiten. Der Knopf in „00 ▶ HSEQ verarbeiten“ schreibt hier.",
    "Der Mac liest diese Zeile und startet den Job.",
    "",
    `${HSEQ_TRIGGER_MARK} ${String(job || "").trim()} ${String(token || "").trim()}`,
    "",
    `_geschrieben: ${stamp}_`,
    "",
  ].join("\n");
}

function oneLine(value, max = 240) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Inhalt der Status-Notiz (Mac → Sync → Knopf). */
export function formatHseqStatus({ ok, job, at, detail } = {}) {
  const mark = ok ? "OK" : "FEHLER";
  const tail = oneLine(detail);
  return [
    "# HSEQ Status",
    "",
    `${HSEQ_STATUS_MARK} ${mark} ${String(job || "").trim()} ${String(at || "").trim()}${
      tail ? ` — ${tail}` : ""
    }`,
    "",
  ].join("\n");
}

/** Liest die Status-Zeile zurück; `null`, wenn keine da ist. */
export function parseHseqStatus(text) {
  const line = String(text || "")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${HSEQ_STATUS_MARK} `));
  if (!line) return null;
  const rest = line.slice(HSEQ_STATUS_MARK.length + 1).trim();
  const sep = rest.indexOf(" — ");
  const head = (sep >= 0 ? rest.slice(0, sep) : rest).split(/\s+/);
  return {
    ok: head[0] === "OK",
    job: head[1] || "",
    at: head[2] || "",
    detail: sep >= 0 ? rest.slice(sep + 3).trim() : "",
  };
}
