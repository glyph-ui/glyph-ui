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
  tickMs: num(process.env.GLYPH_LOCAL_TICK_MS, 15 * 1000),
  // Speicher-Bremse: unter diesem Wert (MB, verfügbar ohne Auslagern) wird das
  // Modell schlafen gelegt, BEVOR macOS anfängt zu schaufeln. Genau das hat den
  // Rechner eingefroren — bei 16,7 GB belegtem Swap wartete alles auf Platte,
  // bis die Modellantwort fertig war. 0 schaltet die Bremse ab.
  minFreeMb: num(process.env.GLYPH_LOCAL_MIN_FREE_MB, 1200),
  // Nur bremsen, wenn seit dieser Zeit keine Anfrage mehr lief — sonst würde
  // die Bremse eine laufende Antwort abschneiden.
  memQuietMs: num(process.env.GLYPH_LOCAL_MEM_QUIET_MS, 90 * 1000),
};

/** @type {"sleeping"|"starting"|"ready"|"error"} */
let state = "sleeping";
let child = null;
let adoptedPid = 0;
let startedAt = 0;
let lastActivity = 0;
let lastStartAt = 0;
let lastError = "";
/** Grund des letzten automatischen Schlafens (idle | max-runtime | memory). */
let lastStopReason = "";
let counter = null;
let metricsSeen = false;
/** Aufeinanderfolgende Ticks unter der Speicherschwelle (Entprellung). */
let memLowSamples = 0;
/** Zuletzt gemessener verfügbarer Speicher in MB (null = nicht messbar). */
let lastAvailMb = null;
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

/**
 * Port des lokalen Modells aus `localBaseUrl()` (z. B. 8080).
 */
function localPort() {
  const m = localBaseUrl().match(/:([0-9]+)/);
  return m ? Number(m[1]) : 8080;
}

/**
 * PID des Prozesses, der auf dem Modellport lauscht.
 *
 * Warum zusätzlich zur PID-Datei: wer den Server von Hand startet
 * (`./bonsai-server`), schreibt keine PID-Datei. Die Brücke adoptierte ihn
 * dann zwar (der Port antwortet ja), hatte aber `pid: 0` — sie konnte ihn
 * weder überwachen noch schlafen legen, und er lief als Waise weiter, bis der
 * Speicher ausging. Über `lsof` bekommen wir die PID auch ohne Datei.
 *
 * @returns {Promise<number>} PID oder 0.
 */
function findPidOnPort() {
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn("/usr/sbin/lsof", ["-ti", `:${localPort()}`, "-sTCP:LISTEN"], {
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      resolve(0);
      return;
    }
    let out = "";
    proc.stdout.on("data", (d) => {
      out += String(d);
    });
    proc.on("error", () => resolve(0));
    proc.on("close", () => {
      const pid = Number(out.trim().split("\n")[0]);
      resolve(Number.isFinite(pid) && pid > 0 ? pid : 0);
    });
  });
}

/**
 * Echte Startzeit eines Prozesses (ms). Nötig für adoptierte Modelle, die von
 * Hand gestartet wurden: sonst würde `maxRuntime` bei jedem Bridge-Neustart
 * wieder bei null beginnen und das Modell liefe unbegrenzt weiter.
 *
 * @param {number} pid
 * @returns {Promise<number>} ms oder 0, wenn nicht lesbar.
 */
function readProcessStartMs(pid) {
  return new Promise((resolve) => {
    if (!pid) {
      resolve(0);
      return;
    }
    let proc;
    try {
      proc = spawn("/bin/ps", ["-p", String(pid), "-o", "lstart="], {
        // LC_ALL=C erzwingt das parsebare Format "Thu Oct 22 19:47:30 2026".
        env: { ...process.env, LC_ALL: "C" },
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      resolve(0);
      return;
    }
    let out = "";
    proc.stdout.on("data", (d) => {
      out += String(d);
    });
    proc.on("error", () => resolve(0));
    proc.on("close", () => {
      const t = Date.parse(out.trim());
      resolve(Number.isFinite(t) ? t : 0);
    });
  });
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
    minFreeMb: CFG.minFreeMb,
    memoryBrake:
      CFG.minFreeMb <= 0
        ? "off"
        : lastAvailMb === null
          ? "unavailable"
          : "on",
    availableMb: lastAvailMb,
    metrics: metricsSeen,
    lastStopReason,
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
      lastActivity = now();
      const p = readPid();
      if (p) {
        adoptedPid = p.pid;
        startedAt = p.startedAt || startedAt;
      } else {
        // Von Hand gestartet: keine PID-Datei. Dann über den Port holen —
        // sonst bleibt `pid: 0` und die Brücke kann das Modell nie beenden.
        adoptedPid = await findPidOnPort();
        // Echte Startzeit übernehmen, damit maxRuntime nicht neu beginnt.
        startedAt = (await readProcessStartMs(adoptedPid)) || now();
        // PID-Datei nachziehen: nächster Bridge-Neustart kennt den Prozess.
        if (adoptedPid) writePid(adoptedPid);
      }
      startedAt = startedAt || now();
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

    const proc = child;
    const pid = proc?.pid || 0;
    adoptedPid = pid;
    startedAt = now();
    if (pid) writePid(pid);

    /**
     * spawn-Fehler (ENOENT, EACCES, EAGAIN) kommen als Event, nicht als
     * Exception — ohne Listener würde Node hier mit einem Uncaught Exception
     * beenden. `_glyphStopping` markiert unser eigenes SIGTERM, damit ein
     * gewolltes Schlafen nicht als Absturz gemeldet wird.
     */
    proc.on("error", (err) => {
      if (child === proc) child = null;
      if (proc._glyphStopping) return;
      state = "error";
      startedAt = 0;
      lastActivity = 0;
      counter = null;
      clearPid();
      lastError = `Modellprozess: ${err.message}`;
      lastExitHint = lastError;
    });

    proc.once("exit", (code, signal) => {
      if (child === proc) child = null;
      clearPid();
      // Gewolltes Schlafen (localStop / Start-Timeout): kein Absturz.
      if (proc._glyphStopping) return;
      if (state === "ready" || state === "starting") {
        state = "sleeping";
        startedAt = 0;
        lastActivity = 0;
        counter = null;
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
      // Der error-Handler kann den Start vorzeitig beenden (z. B. EACCES).
      if (state === "error") {
        return { ok: false, error: lastError, ...localStatus() };
      }
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
    // Kein Waisenprozess zurücklassen: ein hängender 27B hielte sonst ~8 GB,
    // während die UI „Zeitüberschreitung“ zeigt.
    if (proc) {
      proc._glyphStopping = true;
      try {
        proc.kill("SIGTERM");
      } catch {
        /* schon weg */
      }
    }
    adoptedPid = 0;
    startedAt = 0;
    lastActivity = 0;
    counter = null;
    clearPid();
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
    memLowSamples = 0;
    clearPid();
    lastError = "";
    lastExitHint = "";
    lastStopReason = opts.reason || "no-pid";
    return { ok: true, alreadyAsleep: true, ...localStatus() };
  }

  const proc = child;
  // Eigenes SIGTERM markieren — der exit-Handler darf daraus keinen Absturz
  // machen (sonst stand nach normalem Schlafen „vermutlich Speichermangel“).
  if (proc) proc._glyphStopping = true;
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
  memLowSamples = 0;
  lastAvailMb = null;
  clearPid();
  // Ein gewolltes Schlafen ist kein Fehler: alte Absturz-Hinweise verwerfen.
  lastError = "";
  lastExitHint = "";
  // Grund IMMER festhalten — vorher setzte ihn nur die Speicher-Bremse, und ein
  // automatisches Schlafen war im Status nicht von einem Absturz zu trennen.
  lastStopReason = opts.reason || "manual";
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
      // Nur ein Health-Check — zweimal hintereinander kostete bis zu 5 s.
      if (await localHealthy()) {
        const p = readPid();
        adoptedPid = p ? p.pid : await findPidOnPort();
        if (adoptedPid) {
          startedAt = p?.startedAt || (await readProcessStartMs(adoptedPid)) || now();
          // PID-Datei nachziehen, damit der nächste Neustart die Startzeit kennt.
          writePid(adoptedPid);
        } else {
          startedAt = now();
        }
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

    /**
     * SPEICHER-BREMSE.
     *
     * Warum: auf 16 GB reicht der Platz für Modell (4 GB resident) plus
     * Browser/Editor/andere Apps nicht. Sobald macOS auszulagern beginnt,
     * steht der ganze Rechner — gemessen wurden 16,7 GB belegter Swap und
     * 11,3 Mio. Swapouts. Der Rechner reagierte erst wieder, als die
     * Modellantwort fertig war.
     *
     * Deshalb: fällt der verfügbare Speicher unter die Schwelle UND läuft
     * gerade keine Anfrage (memQuietMs), legen wir das Modell schlafen. Der
     * Auto-Rückfall der Brücke schaltet dann auf die Cloud — der Nutzer merkt
     * es an der Quelle, nicht an einem eingefrorenen Rechner.
     *
     * Entprellung: Zwei Ticks in Folge unter der Schwelle. Ohne `--metrics`
     * kennt die Brücke keine laufende Anfrage (lastActivity bleibt stehen) —
     * dann verhindert die Entprellung, dass eine einzelne Messung mitten in
     * einer langen Antwort zuschlägt.
     */
    if (CFG.minFreeMb > 0) {
      const availMb = await readAvailableMb();
      lastAvailMb = availMb;
      const quiet = !lastActivity || now() - lastActivity >= CFG.memQuietMs;
      if (availMb !== null && availMb < CFG.minFreeMb && quiet) {
        memLowSamples += 1;
        // Mit Metriken ist die Aktivität bekannt → sofort bremsen. Ohne
        // Metriken erst nach zwei Messungen (Schutz vor laufender Antwort).
        if (memLowSamples >= (metricsSeen ? 1 : 2)) {
          lastStopReason = `Speicher knapp (${availMb} MB verfügbar)`;
          await localStop({ reason: "memory" });
          return localStatus();
        }
      } else {
        memLowSamples = 0;
      }
    } else {
      lastAvailMb = null;
      memLowSamples = 0;
    }

    /**
     * Nur selbst gestartete Modelle werden automatisch schlafen gelegt.
     * Ein adoptierter (von Hand gestarteter) Prozess gehört dem Nutzer —
     * Idle-/Max-Runtime-Bremse würden ihn sonst hinter seinem Rücken beenden.
     * Die Speicher-Bremse oben bleibt für beide aktiv: sie verhindert das
     * Einfrieren des Rechners und ist damit Sicherheit, keine Bequemlichkeit.
     */
    const owned = Boolean(child);

    const c = await readCounter();
    if (c === null) {
      // Keine Metriken: Aktivität unbekannt → nur die Notbremse greift.
      metricsSeen = false;
      if (owned && startedAt && now() - startedAt > CFG.maxRuntimeMs) {
        await localStop({ reason: "max-runtime" });
      }
      return localStatus();
    }
    metricsSeen = true;
    if (counter === null || c !== counter) {
      lastActivity = now();
      counter = c;
    }
    if (owned && now() - lastActivity > CFG.idleMs) {
      await localStop({ reason: "idle" });
      return localStatus();
    }
    if (owned && startedAt && now() - startedAt > CFG.maxRuntimeMs) {
      await localStop({ reason: "max-runtime" });
    }
    return localStatus();
  } finally {
    ticking = false;
  }
}

/**
 * Verfügbarer Speicher in MB: frei + inaktiv + spekulativ — also das, was macOS
 * ohne Auslagern zurückholen kann.
 *
 * `os.freemem()` taugt auf macOS nicht: es zählt nur komplett freie Seiten und
 * steht meist nahe null, obwohl genug zurückholbar wäre. `vm_stat` liefert die
 * Kategorien einzeln.
 *
 * @returns {Promise<number|null>} MB oder null, wenn nicht messbar.
 */
export function readAvailableMb() {
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn("/usr/bin/vm_stat", [], {
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      resolve(null);
      return;
    }
    let out = "";
    proc.stdout.on("data", (d) => {
      out += String(d);
    });
    proc.on("error", () => resolve(null));
    proc.on("close", () => {
      const size =
        Number((out.match(/page size of (\d+) bytes/) || [])[1]) || 4096;
      const pages = (label) => {
        const m = out.match(new RegExp(String.raw`${label}:\s+(\d+)`));
        return m ? Number(m[1]) : 0;
      };
      const total =
        pages("Pages free") +
        pages("Pages inactive") +
        pages("Pages speculative") +
        pages("Pages purgeable");
      resolve(total > 0 ? Math.round((total * size) / (1024 * 1024)) : null);
    });
  });
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

// Bei Glyph-Ende nur den SELBST gestarteten Modellprozess mitnehmen.
// Ein adoptierter (von Hand gestarteter) Prozess gehört dem Nutzer — sonst
// würde jeder Dev-Neustart, Smoke-Test oder Testserver den 27B abschießen.
process.once("exit", () => {
  const pid = child?.pid || 0;
  if (pid) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* ignore */
    }
  }
});

/**
 * Ticker starten: Adoption nach Neustart + Auto-Schlafen/Speicher-Bremse.
 * Wird von der Bridge beim Start aufgerufen — nicht beim Import, sonst
 * laufen Tests in die Hintergrundarbeit und Node beendet sich nicht.
 */
export function startLocalModelTicker() {
  ensureTicker();
}

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
  memLowSamples = 0;
  lastAvailMb = null;
  startPromise = null;
  healthMisses = 0;
  lastExitHint = "";
}
