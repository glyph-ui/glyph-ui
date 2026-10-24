/**
 * Agent profiles: which ACP agent the bridge spawns and what it can do.
 *
 * Glyph is an ACP client, not a model client — swapping the agent means
 * spawning a different binary, not pointing at a different API. Everything
 * that flows over ACP (chat, thoughts, tools, plans, attachments, fork)
 * works for any profile; grok-only extras are declared per profile so the
 * UI can grey them out instead of failing at runtime.
 *
 * Rollen (C′ 2026-08-07, ^_tick 2026-10-11):
 *   Grok Build   = Build (XAI/Grok-Build Binary, id grok)
 *   ^_tick       = Routine-Kopf (Nachfolger ^_Code: Code + tägliche Routinen,
 *                  DeepSeek V4 Flash via glyph-agent MODE=tick)
 *   °_Agent      = Vault/Tools + Cloud-Antwort (id glyph-agent, MODE=agent, kein Shell)
 *
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */

import { accessSync, constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Absoluter Pfad zur glyph-agent-ACP-Brücke (Tool-/Recherche- und CODE-Schicht).
const GLYPH_AGENT_ACP_FILE = fileURLToPath(new URL("./glyph-agent-acp.mjs", import.meta.url));
// OpenRouter-UI-Profil entfernt (B+ 2026-08-05): Cloud läuft nur noch *innerhalb* von glyph-agent.

export const DEFAULT_AGENT_ID = "grok";

/**
 * First executable match for `name` across PATH.
 * Pure fs lookups — no subprocess, safe to call while spawning.
 *
 * @param {string} name
 * @param {NodeJS.ProcessEnv} env
 * @returns {string | null} absolute path, or null when not found
 */
export function findOnPath(name, env = process.env) {
  if (!name || name.includes(path.sep)) return name || null;
  const dirs = String(env.PATH || "").split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const full = path.join(dir, name);
    try {
      accessSync(full, constants.X_OK);
      return full;
    } catch {
      /* next */
    }
  }
  return null;
}

/**
 * Split a shell-ish arg string. Supports simple quoting; no expansion.
 *
 * @param {string | undefined} raw
 * @returns {string[]}
 */
export function parseArgs(raw) {
  const s = String(raw || "").trim();
  if (!s) return [];
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    out.push(m[1] ?? m[2] ?? m[3]);
  }
  return out;
}

/**
 * @deprecated Claude-Profil entfernt (C′ 2026-08-07). Beibehalten für Tests/Kompat.
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ bin: string, args: string[], via: string }}
 */
export function resolveClaudeCommand(env = process.env) {
  const explicit = String(env.GLYPH_CLAUDE_BIN || "").trim();
  if (explicit) {
    return { bin: explicit, args: parseArgs(env.GLYPH_CLAUDE_ARGS), via: "env" };
  }
  if (findOnPath("claude-agent-acp", env)) {
    return {
      bin: "claude-agent-acp",
      args: parseArgs(env.GLYPH_CLAUDE_ARGS),
      via: "path",
    };
  }
  return {
    bin: "npx",
    args: ["-y", "@agentclientprotocol/claude-agent-acp", ...parseArgs(env.GLYPH_CLAUDE_ARGS)],
    via: "npx",
  };
}

/**
 * @typedef {object} AgentProfile
 * @property {string} id
 * @property {string} label
 * @property {string} bin
 * @property {string[]} args
 * @property {string} [via]
 * @property {string} [hint]
 * @property {NodeJS.ProcessEnv | Record<string, string>} [env]
 * @property {{ deepSearch: boolean, swarm: boolean, activity: boolean, sessionList: boolean, sessionHistory: boolean, routines: boolean }} capabilities
 *   - deepSearch     : Grok-only Multi-Quellen-Recherche
 *   - swarm          : °_Agent / ^_tick — Planer+Suche+Synthese (Engine)
 *   - activity       : Aktivitäts-Kalender (liest ~/.grok/events.jsonl)
 *   - sessionList    : persistente Session-Liste (nur grok, ~/.grok/sessions)
 *   - sessionHistory : aktiver In-Memory-Verlauf der aktuellen Session (über ACP session/history)
 *   - routines       : ^_tick — Routine-Lage im Plan-Tab (Job-Ordner, offene To-dos/Aufgaben)
 */

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {AgentProfile[]}
 */
export function buildAgentProfiles(env = process.env) {
  // Drei Profile: Grok Build, ^_tick (Routine-/Code-Kopf), °_Agent (Vault; id glyph-agent).
  // ^_tick hat ^_Code abgelöst (2026-10-11) — Code-Fähigkeiten + tägliche Routinen.
  return [
    {
      id: "grok",
      label: "Grok Build",
      bin: String(env.GROK_BIN || "grok"),
      // Denkaufwand medium statt Modell-Default high: kuerzere Turns.
      // Messung 2026-09-08: bei high waren 69% der Ausgabe-Token Reasoning
      // (668 Token/Antwort, davon 463 Denken); Modellzeit ~47% der Wanduhr.
      args: ["agent", "--always-approve", "--no-leader", "--reasoning-effort", "medium", "stdio"],
      via: "bin",
      capabilities: { deepSearch: true, swarm: false, activity: true, sessionList: true, sessionHistory: true, routines: false },
    },
    {
      id: "_tick",
      label: "^_tick",
      bin: process.execPath,
      args: [GLYPH_AGENT_ACP_FILE],
      via: "bin",
      // TICK-Modus: DeepSeek V4 Flash 0731, Workspace-Tools + Routine-Ordner,
      // Freigabe in Glyph. Erbt die Code-Fähigkeiten (^_Code ist abgelöst).
      env: {
        GLYPH_AGENT_MODE: "tick",
        GLYPH_AGENT_ACP_NAME: "^_tick",
      },
      hint: "DeepSeek V4 Flash · Routine-Kopf: Daily/Inbox-Batch + Plan & Aktivität (RoutineSet/Run) · Grep/Read/Write/Shell (Whitelist) · Freigabe in Glyph",
      capabilities: { deepSearch: false, swarm: true, activity: false, sessionList: false, sessionHistory: true, routines: true },
    },
    {
      id: "glyph-agent",
      label: "°_Agent",
      bin: process.execPath,
      args: [GLYPH_AGENT_ACP_FILE], // dünne Brücke zu glyph-agent (Tools: Vault, Recherche)
      via: "bin",
      env: {
        GLYPH_AGENT_MODE: "agent",
        GLYPH_AGENT_ACP_NAME: "°_Agent",
      },
      hint: "B+: VaultFind/Wiki + Web/BrowseUrl + ReadPdf/Mail · Cloud-Antwort · kein Shell · Diff+Backup · :18899",
      capabilities: { deepSearch: false, swarm: true, activity: false, sessionList: false, sessionHistory: true, routines: false },
    },
  ];
}

/**
 * @param {AgentProfile[]} profiles
 * @param {string | undefined | null} id
 * @returns {AgentProfile | null}
 */
export function findAgent(profiles, id) {
  if (!Array.isArray(profiles) || !id) return null;
  return profiles.find((p) => p.id === String(id)) || null;
}

/**
 * Resolve a requested id to a usable profile, falling back to the default.
 *
 * @param {AgentProfile[]} profiles
 * @param {string | undefined | null} id
 * @returns {AgentProfile}
 */
export function resolveAgent(profiles, id) {
  // Alias: alte UI-IDs / Anzeige-Labels / Tippfehler
  const raw = id == null ? "" : String(id);
  let normalized = raw;
  if (
    raw === "claude" ||
    raw === "code" ||
    raw === "_code" ||
    raw === "^_Code" ||
    raw === "^_code"
  ) {
    // ^_Code ist abgelöst — alte Sessions/State-Werte zeigen auf ^_tick.
    normalized = "_tick";
  } else if (
    raw === "tick" ||
    raw === "^_tick" ||
    raw === "^_Tick"
  ) {
    normalized = "_tick";
  } else if (
    raw === "°_Agent" ||
    raw === "-_Agent" || // legacy label
    raw === "_agent" ||
    raw === "agent"
  ) {
    normalized = "glyph-agent";
  } else if (raw === "Grok Build" || raw === "grok-build") {
    normalized = "grok";
  }
  return (
    findAgent(profiles, normalized) ||
    findAgent(profiles, DEFAULT_AGENT_ID) ||
    profiles[0]
  );
}

/**
 * Wire shape for the browser: no env leakage beyond the command itself,
 * which the UI shows in the header tooltip for exactly the “which install
 * am I looking at” question.
 *
 * @param {AgentProfile | null} profile
 */
export function publicAgent(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    label: profile.label,
    command: [profile.bin, ...profile.args].join(" ").trim(),
    via: profile.via || "bin",
    hint: profile.hint || null,
    capabilities: { ...profile.capabilities },
  };
}

/**
 * @param {AgentProfile[]} profiles
 */
export function publicAgents(profiles) {
  if (!Array.isArray(profiles)) return [];
  return profiles.map((p) => publicAgent(p)).filter(Boolean);
}


