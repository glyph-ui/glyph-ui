/**
 * Composer actions: Chat / Deep Search / Fork / Swarm (TUI-aligned).
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */

/** Graph-Köpfe, die Swarm verarbeiten (nicht Grok — der hat Deep Search). */
export const SWARM_HEAD_IDS = ["glyph-agent", "_code"];

/**
 * @param {string | null | undefined} agentId
 */
export function canSwarm(agentId) {
  const id = String(agentId || "");
  return (
    id === "glyph-agent" ||
    id === "agent" ||
    id === "_code" ||
    id === "code"
  );
}

/** Graph-Köpfe, die Fork verarbeiten (^_Code, Grok Build — nicht °_Agent). */
export const FORK_HEAD_IDS = ["_code", "code", "grok"];

/**
 * Fork im °_Agent gesperrt: Dort gibt es keine Session-Übersicht
 * (server/agents.js: sessionList false), also keinen Weg zurueck zur
 * Quell-Session. Steuerung bleibt sichtbar, aber gesperrt.
 * @param {string | null | undefined} agentId
 */
export function canFork(agentId) {
  const id = String(agentId || "");
  return FORK_HEAD_IDS.includes(id);
}

/**
 * @param {string | null | undefined} action
 */
export function composerActionLabel(action) {
  if (action === "deep-search") return "Deep Search";
  if (action === "fork") return "Fork";
  if (action === "swarm") return "Swarm";
  return "Chat";
}

/**
 * Map composer mode + typed text onto a wire action.
 * Slash `/fork`, `/deep-research`, `/swarm` in Chat mode become the real actions
 * (insert-only popup still types the command; send must not treat it as chat).
 *
 * @param {string} sendAction  chat | deep-search | fork | swarm
 * @param {string} text
 * @returns {{ action: "chat" | "deep-search" | "fork" | "swarm", text: string }}
 */
export function resolveComposerAction(sendAction, text) {
  const mode =
    sendAction === "deep-search" ||
    sendAction === "fork" ||
    sendAction === "swarm"
      ? sendAction
      : "chat";
  const trimmed = String(text || "").trim();

  if (mode === "fork") {
    const m = trimmed.match(/^\/fork(?:\s+([\s\S]*))?$/i);
    return { action: "fork", text: m ? String(m[1] || "").trim() : trimmed };
  }
  if (mode === "deep-search") {
    const m = trimmed.match(/^\/deep-research(?:\s+([\s\S]*))?$/i);
    return {
      action: "deep-search",
      text: m ? String(m[1] || "").trim() : trimmed,
    };
  }
  if (mode === "swarm") {
    const m = trimmed.match(/^\/swarm(?:\s+([\s\S]*))?$/i);
    return { action: "swarm", text: m ? String(m[1] || "").trim() : trimmed };
  }

  const fork = trimmed.match(/^\/fork(?:\s+([\s\S]*))?$/i);
  if (fork) {
    return { action: "fork", text: String(fork[1] || "").trim() };
  }
  const deep = trimmed.match(/^\/deep-research(?:\s+([\s\S]*))?$/i);
  if (deep) {
    return { action: "deep-search", text: String(deep[1] || "").trim() };
  }
  const swarm = trimmed.match(/^\/swarm(?:\s+([\s\S]*))?$/i);
  if (swarm) {
    return { action: "swarm", text: String(swarm[1] || "").trim() };
  }
  return { action: "chat", text: trimmed };
}

/**
 * Prompt Grok's ACP slash interceptor understands for /deep-research.
 * @param {string} query
 */
export function deepResearchPrompt(query) {
  const q = String(query || "").trim();
  if (!q) return "";
  return /^\/deep-research\b/i.test(q) ? q : `/deep-research ${q}`;
}

/**
 * New session id from ACP session/fork or Grok x.ai/session/fork.
 * @param {unknown} result
 * @returns {string | null}
 */
export function parseForkResponse(result) {
  if (!result || typeof result !== "object") return null;
  const rec = /** @type {Record<string, unknown>} */ (result);
  const id = rec.sessionId || rec.newSessionId;
  if (id == null) return null;
  const s = String(id).trim();
  return s || null;
}

/**
 * Independent copy of an in-memory adapter session (messages + write grant).
 * @param {unknown} store
 */
export function cloneSessionStore(store) {
  const src = store && typeof store === "object"
    ? /** @type {Record<string, unknown>} */ (store)
    : {};
  const messages = Array.isArray(src.messages)
    ? src.messages.map((m) =>
        m && typeof m === "object" ? { ...m } : m,
      )
    : [];
  return {
    messages,
    allowWriteTools: Boolean(src.allowWriteTools),
  };
}
