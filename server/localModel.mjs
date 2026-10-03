/**
 * localModel.mjs — Lebensdauer des lokalen Modells (Ternary Bonsai 2 27B).
 *
 * Das Modell belegt ~8 GB RAM. Es soll nur laufen, wenn es gebraucht wird.
 * Deshalb verwaltet Glyph den Prozess selbst:
 *
 *   GET  /api/local/status   → Zustand (sleeping | starting | ready | error)
 *   POST /api/local/start    → starten (dauert ~16 s)
 *   POST /api/local/stop     → schlafen legen (gibt die 8 GB frei)
 *   POST /api/local/touch    → Aktivität melden (UI, optional)
 *
 * SCHUTZ (der lokale Modus ist bewusst auch auf glyph-ui.com erreichbar):
 *   1. Passwort-Tor der Web-Fläche gilt auch hier (Standard-Middleware).
 *   2. Single-Flight: nur ein Start/Stop gleichzeitig.
 *   3. Cooldown zwischen Starts (Standard 30 s) gegen Start/Stop-Spam.
 *   4. Auto-Schlafen nach Leerlauf (Standard 20 min) — erkannt über den
 *      Metrik-Zähler des Servers (`llamacpp:prompt_tokens_total` +
 *      `llamacpp:tokens_predicted_total`). Läuft der Zähler, arbeitet das
 *      Modell; steht er still, wird geschlafen.
 *   5. Notbremse: maximale Laufzeit (Standard 3 h), danach wird geschlafen.
 *
 * Ist /metrics nicht verfügbar (älterer Server), wird NUR die Notbremse
 * benutzt — lieber zu lange wach als mitten in einem Job einschlafen.
 *
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");

/** Modell-ID, die glyph-agent im lokalen Modus anspricht. */
export function localModelId() {
  return String(process.env.LOCAL_MODEL || "bonsai-2-27b-uncensored");
}

/** Basis-URL des lokalen Servers (ohne Schrägstrich am Ende). */
export function localBaseUrl() {
  const raw = String(
    process.env.GLYPH_LOCAL_URL ||
      process.env.LOCAL_API_URL ||
      "http://127.0.0.1:8080/v1",
  );
  return raw.replace(/\/+$/, "");
}

function stateDir() {
  return (
    process.env.GLYPH_UI_STATE_DIR || path.join(os.homedir(), ".glyph-ui")
  );
}
function pidPath() {
  return path.join(stateDir(), "local-model.pid");
}
function logPath() {
  return path.join(stateDir(), "local-model.log");
}

/**
 * Startbefehl. Reihenfolge: explizit gesetzt → ~/.local → im Projekt.
 * @returns {string}
 */
export function localCommand() {
  const explicit = String(process.env.GLYPH_LOCAL_MODEL_CMD || "").trim();
  if (explicit) return explicit;
  const candidates = [
    path.join(os.homedir(), ".local", "bonsai2", "bonsai-server"),
    path.join(REPO_ROOT, ".local", "bonsai2", "bonsai-server"),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return candidates[0];
}

function num(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const CFG = {
  idleMs: num(process.env.GLYPH_LOCAL_IDLE_MS, 20 * 60 * 1000),
  maxRuntimeMs: num(process.env.GLYPH_LOCAL_MAX_RUNTIME_MS, 3 * 60 * 60 * 1000),
  cooldownMs: num(process.env.GLYPH_LOCAL_COOLDOWN_MS, 30 * 1000),
  startTimeoutMs: num(process.env.GLYPH_LOCAL_START_TIMEOUT_MS, 120 * 1000),
  tickMs: num(process.env.GLYPH_LOCAL_TICK_MS, 30 * 1000),
};

/** @type {"sleeping"|"starting"|"ready"|"error"} */
let state = "sleeping";
let child = null;
let adoptedPid = 0;
let startedAt = 0;
let lastActivity = 0;
let lastStartAt = 0;
let lastError = "";
let counter = null;
let metricsSeen = false;
let startPromise = null;
let ticking = false;
/** Aufeinanderfolgende fehlgeschlagene Gesundheitsprüfungen im Zustand ready. */
let healthMisses = 0;
/** Grund des letzten unerwarteten Prozess-Endes (für die Fehlermeldung). */
let lastExitHint = "";

function now() {
  return Date.now();
}

function readPid() {
  try {
    const raw = JSON.parse(fs.readFileSync(pidPath(), "utf8"));
    const pid = Number(raw?.pid);
    if (!Number.isFinite(pid) || pid <= 0) return null;
    process.kill(pid, 0); // wirft, wenn der Prozess nicht existiert
    return { pid, startedAt: Number(raw?.startedAt) || 0 };
  } catch {
    return null;
  }
}

function writePid(pid) {
  try {
    fs.mkdirSync(stateDir(), { recursive: true });
    fs.writeFileSync(
      pidPath(),
      `${JSON.stringify({ pid, startedAt: startedAt || now() }, null, 2)}\n`,
      { mode: 0o600 },
    );
  } catch {
    /* Diagnose, kein harter Fehler */
  }
}

function clearPid() {
  try {
    fs.unlinkSync(pidPath());
  } catch {
    /* war schon weg */
  }
}

async function fetchText(url, ms = 2500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** true, wenn der lokale Server antwortet. */
export async function localHealthy() {
  const txt = await fetchText(`${localBaseUrl()}/health`, 2500);
  return Boolean(txt && txt.includes("ok"));
}

/**
 * Aktivitätszähler des Servers (monoton). null = /metrics fehlt.
 * @returns {Promise<number|null>}
 */
async function readCounter() {
  const txt = await fetchText(`${localBaseUrl()}/metrics`, 2500);
  if (!txt || !txt.includes("llamacpp:")) return null;
  let sum = 0;
  for (const line of txt.split("\n")) {
    const m = /^llamacpp:(prompt_tokens_total|tokens_predicted_total)\s+(\d+)/.exec(
      line.trim(),
    );
    if (m) sum += Number(m[2]);
  }
  return sum;
}

/** Zustand für die UI. */
export function localStatus() {
  return {
    state,
    ready: state === "ready",
    starting: state === "starting",
    canStart: state === "sleeping" || state === "error",
    url: localBaseUrl(),
    model: localModelId(),
    command: localCommand(),
    pid: child?.pid || adoptedPid || 0,
    startedAt: startedAt || null,
    uptimeMs: startedAt ? now() - startedAt : 0,
    lastActivity: lastActivity || null,
    idleMs: lastActivity ? now() - lastActivity : null,
    idleTimeoutMs: CFG.idleMs,
    maxRuntimeMs: CFG.maxRuntimeMs,
    cooldownMs: CFG.cooldownMs,
    metrics: metricsSeen,
    lastError,
    updatedAt: now(),
  };
}

/** Aktivität von außen melden (UI). */
export function localTouch() {
  lastActivity = now();
  return localStatus();
}

function waitExit(proc, ms) {
  return new Promise((resolve) => {
    if (!proc || proc.exitCode !== null || proc.signalCode) return resolve(true);
    const t = setTimeout(() => resolve(false), ms);
    proc.once("exit", () => {
      clearTimeout(t);
      resolve(true);
    });
  });
}

/**
 * Modell starten. Idempotent; parallele Aufrufe teilen sich einen Vorgang.
 * @param {{ reason?: string, force?: boolean }} [opts]
 */
export async function localStart(opts = {}) {
  if (state === "ready") return { ok: true, ...localStatus() };
  if (startPromise) return startPromise;

  const since = now() - lastStartAt;
  if (!opts.force && lastStartAt && since < CFG.cooldownMs) {
    const waitS = Math.ceil((CFG.cooldownMs - since) / 1000);
    lastError = `Zu schnell hintereinander — noch ${waitS}s warten`;
    return {
      ok: false,
      error: lastError,
      ...localStatus(),
    };
  }

  startPromise = (async () => {
    state = "starting";
    lastError = "";
    lastStartAt = now();

    // Schon jemand da? (z. B. von Hand gestartet)
    if (await localHealthy()) {
      state = "ready";
      startedAt = startedAt || now();
      lastActivity = now();
      const p = readPid();
      if (p) adoptedPid = p.pid;
      ensureTicker();
      return { ok: true, adopted: true, ...localStatus() };
    }

    const cmd = localCommand();
    if (!fs.existsSync(cmd)) {
      state = "error";
      lastError = `Startbefehl fehlt: ${cmd}`;
      return { ok: false, error: lastError, ...localStatus() };
    }

    let fd;
    try {
      fs.mkdirSync(stateDir(), { recursive: true });
      // Log bei jedem Start begrenzen (Diagnose, kein Wachstum über Monate).
      try {
        const st = fs.statSync(logPath());
        if (st.size > 2 * 1024 * 1024) fs.unlinkSync(logPath());
      } catch {
        /* keine Datei = nichts zu tun */
      }
      fd = fs.openSync(logPath(), "a");
      child = spawn(cmd, [], {
        cwd: path.dirname(cmd),
        env: process.env,
        stdio: ["ignore", fd, fd],
      });
    } catch (err) {
      state = "error";
      lastError = err instanceof Error ? err.message : String(err);
      return { ok: false, error: lastError, ...localStatus() };
    } finally {
      if (fd !== undefined) {
        try {
          fs.closeSync(fd);
        } catch {
          /* ignore */
        }
      }
    }

    const pid = child?.pid || 0;
    adoptedPid = pid;
    startedAt = now();
    writePid(pid);

    child.once("exit", (code, signal) => {
      child = null;
      if (state === "ready" || state === "starting") {
        state = "sleeping";
        startedAt = 0;
        lastActivity = 0;
        counter = null;
        clearPid();
        if (signal) {
          // Von aussen beendet — auf einem 16-GB-Mac fast immer Speichermangel
          // (z. B. ein zweites Modell parallel in Ollama).
          lastExitHint =
            `Modell wurde beendet (${signal}) — vermutlich Speichermangel. ` +
            "Andere Modelle/Apps schliessen, dann neu starten.";
          lastError = lastExitHint;
          state = "error";
        } else if (code && code !== 0) {
          lastError = `Modell beendet (Code ${code})`;
          state = "error";
        } else {
          lastExitHint = "Modell wurde beendet — neu starten.";
        }
      }
    });

    // Auf /health warten.
    const deadline = now() + CFG.startTimeoutMs;
    while (now() < deadline) {
      if (await localHealthy()) {
        state = "ready";
        lastActivity = now();
        counter = await readCounter();
        ensureTicker();
        return { ok: true, started: true, pid, ...localStatus() };
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    state = "error";
    lastError = `Zeitüberschreitung nach ${Math.round(
      CFG.startTimeoutMs / 1000,
    )}s — siehe ${logPath()}`;
    return { ok: false, error: lastError, ...localStatus() };
  })();

  try {
    return await startPromise;
  } finally {
    startPromise = null;
  }
}

/**
 * Modell schlafen legen (Gibt ~8 GB frei).
 * @param {{ reason?: string }} [opts]
 */
export async function localStop(opts = {}) {
  const pid = child?.pid || adoptedPid || 0;
  if (!pid) {
    state = "sleeping";
    startedAt = 0;
    lastActivity = 0;
    counter = null;
    clearPid();
    return { ok: true, alreadyAsleep: true, ...localStatus() };
  }

  const proc = child;
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* schon weg */
  }
  const gone = proc ? await waitExit(proc, 12000) : await waitForPort(12000);
  if (!gone) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  child = null;
  adoptedPid = 0;
  state = "sleeping";
  startedAt = 0;
  lastActivity = 0;
  counter = null;
  clearPid();
  return { ok: true, stopped: true, reason: opts.reason || "manual", ...localStatus() };
}

/** Warten, bis /health nicht mehr antwortet (für adoptierte Prozesse). */
async function waitForPort(ms) {
  const deadline = now() + ms;
  while (now() < deadline) {
    if (!(await localHealthy())) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/**
 * Ein Tick: Adoption, Aktivität, Auto-Schlafen, Notbremse.
 * Exportiert für Tests.
 */
export async function localTick() {
  if (ticking) return localStatus();
  ticking = true;
  try {
    if (state !== "ready") {
      // Nach einem Glyph-Neustart: laufenden Prozess adoptieren.
      const p = readPid();
      if (p && (await localHealthy())) {
        adoptedPid = p.pid;
        startedAt = p.startedAt || now();
        lastActivity = now();
        state = "ready";
        counter = await readCounter();
      }
      return localStatus();
    }

    // AUCH im Zustand "ready" muss die Gesundheit geprueft werden: wird der
    // Modellprozess von aussen beendet (Speichermangel/OOM), blieb der Zustand
    // bisher faelschlich auf "ready" — die UI schickte Anfragen an einen toten
    // Port und zeigte "lost in space". Zwei Fehlschlaege in Folge, damit ein
    // kurzer Aussetzer waehrend einer Anfrage nicht sofort umschaltet.
    if (!(await localHealthy())) {
      healthMisses += 1;
      if (healthMisses >= 2) {
        state = "error";
        startedAt = 0;
        lastActivity = 0;
        counter = null;
        lastError = lastExitHint
          || "Modell antwortet nicht mehr — abgestuerzt? Neu starten.";
        adoptedPid = 0;
        child = null;
        clearPid();
      }
      return localStatus();
    }
    healthMisses = 0;
    lastExitHint = "";

    const c = await readCounter();
    if (c === null) {
      // Keine Metriken: Aktivität unbekannt → nur die Notbremse greift.
      metricsSeen = false;
      if (startedAt && now() - startedAt > CFG.maxRuntimeMs) {
        await localStop({ reason: "max-runtime" });
      }
      return localStatus();
    }
    metricsSeen = true;
    if (counter === null || c !== counter) {
      lastActivity = now();
      counter = c;
    }
    if (now() - lastActivity > CFG.idleMs) {
      await localStop({ reason: "idle" });
      return localStatus();
    }
    if (startedAt && now() - startedAt > CFG.maxRuntimeMs) {
      await localStop({ reason: "max-runtime" });
    }
    return localStatus();
  } finally {
    ticking = false;
  }
}

let ticker = null;
function ensureTicker() {
  if (ticker) return;
  ticker = setInterval(() => {
    void localTick();
  }, CFG.tickMs);
  if (typeof ticker.unref === "function") ticker.unref();
  // Erster Lauf kurz nach dem Start (Adoption nach Neustart).
  void localTick();
}

// Bei Glyph-Ende den Modellprozess mitnehmen — sonst bleiben 8 GB belegt.
process.once("exit", () => {
  const pid = child?.pid || adoptedPid || 0;
  if (pid) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* ignore */
    }
  }
});

// Ticker sofort aufsetzen, damit ein laufendes Modell adoptiert wird.
ensureTicker();

/** Für Tests: Zustand zurücksetzen. */
export function resetLocalModelState() {
  child = null;
  adoptedPid = 0;
  state = "sleeping";
  startedAt = 0;
  lastActivity = 0;
  lastStartAt = 0;
  lastError = "";
  counter = null;
  metricsSeen = false;
  startPromise = null;
  healthMisses = 0;
  lastExitHint = "";
}
