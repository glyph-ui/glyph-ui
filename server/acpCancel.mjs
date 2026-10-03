/**
 * ACP session/cancel helpers — pending AbortController per session + stopReason.
 * Copyright (c) 2026 Alexander Hubert · SPDX-License-Identifier: MIT
 */

/**
 * Track one AbortController per ACP session so session/cancel can abort the
 * in-flight session/prompt (fetch to glyph-agent, idle timer, etc.).
 * Matches the pattern in @agentclientprotocol/sdk examples/agent.js.
 */
export function createSessionCancelGate() {
  /** @type {Map<string, AbortController>} */
  const pending = new Map();

  return {
    /**
     * Start (or replace) the cancel controller for a prompt turn.
     * @param {string} sessionId
     * @returns {AbortController}
     */
    begin(sessionId) {
      const id = String(sessionId || "");
      const prev = pending.get(id);
      if (prev && !prev.signal.aborted) {
        try {
          prev.abort();
        } catch {
          /* ignore */
        }
      }
      const ac = new AbortController();
      pending.set(id, ac);
      return ac;
    },

    /**
     * Abort the pending prompt for sessionId (session/cancel).
     * @param {string} sessionId
     * @returns {boolean} true if a controller was found and aborted
     */
    cancel(sessionId) {
      const id = String(sessionId || "");
      const ac = pending.get(id);
      if (!ac) return false;
      if (!ac.signal.aborted) {
        try {
          ac.abort();
        } catch {
          /* ignore */
        }
      }
      return true;
    },

    /**
     * Drop the controller when the prompt turn finishes (only if still ours).
     * @param {string} sessionId
     * @param {AbortController} [ac]
     */
    end(sessionId, ac) {
      const id = String(sessionId || "");
      if (!ac || pending.get(id) === ac) {
        pending.delete(id);
      }
    },

    /** @param {string} sessionId */
    isCancelling(sessionId) {
      const ac = pending.get(String(sessionId || ""));
      return Boolean(ac?.signal?.aborted);
    },
  };
}

/**
 * When the user asked to cancel, the turn must end as cancelled — even if the
 * agent finished with end_turn / stop (e.g. cloud HTTP already in flight).
 * @param {boolean} wasCancelling
 * @param {string} stopReason
 * @returns {string}
 */
export function resolveCancelStopReason(wasCancelling, stopReason) {
  const reason = String(stopReason || "end_turn");
  if (wasCancelling && reason !== "cancelled") return "cancelled";
  return reason;
}

/**
 * System line after a cancel attempt. Never claim work "finished safely" when
 * the user clicked Abbrechen.
 * @param {string} stopReason
 * @param {boolean} wasCancelling
 * @returns {string | null}
 */
export function cancelSystemText(stopReason, wasCancelling) {
  if (!wasCancelling && stopReason !== "cancelled") return null;
  if (stopReason === "cancelled" || wasCancelling) {
    return "Antwort abgebrochen.";
  }
  return null;
}

/**
 * True when an assistant_message_chunk should be dropped because cancel is in
 * flight (late answer must not appear as normal completion).
 * Step/draft markers may still pass for live protocol.
 * @param {string} text
 * @param {boolean} cancelling
 * @returns {boolean}
 */
export function shouldDropAssistantChunk(text, cancelling) {
  if (!cancelling) return false;
  const t = String(text || "");
  if (t.startsWith("⏺STEP⏺") || t.startsWith("⏹STEP⏹")) return false;
  if (t.startsWith("⏺DRAFT⏺") || t.startsWith("⏺DRAFT+⏺")) return false;
  return true;
}
