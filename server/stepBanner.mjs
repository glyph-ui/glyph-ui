/**
 * stepBanner.mjs — Reine (pure) Funktion: Grok-artiger Stufen-Banner für den
 * glyph-agent-Chattext (Ausgabe).
 *
 * Holt die Stufen NICHT aus der UI-Config, sondern aus dem ECHTEN Server-Trace
 * (steps[] + provider/model). Wird von glyph-agent-acp.mjs vor dem eigentlichen
 * Antworttext eingefügt, damit die Tool-/Denk-Stufen textlich sichtbar im Chat
 * stehen (analog zu Groks „Tool“/„Think“-Blöcken).
 *
 * Bewusst ohne React/JSX/Seiteneffekte, damit sie direkt aus Node-Tests
 * importiert werden kann. Keine API-Keys/interne Prompts in der Ausgabe.
 *
 * Copyright (c) 2026 Alexander Hubert · SPDX-License-Identifier: MIT
 */

// Sprach-Mapping: Tool-Schrittname → [sichtbares Label, verständliche Aktion].
// VaultFind-Defaults sind bewusst neutral („suche Notizen“); buildStepBanner /
// resolveStepDisplay wählen Wiki vs. Arbeits-Vault anhand des step.detail.
const STEP_LABELS = {
  VaultFind: ["SearchVault", "suche Notizen"],
  VaultRecall: ["SearchVault", "suche Notizen (alias)"],
  VaultSearch: ["SearchVault", "suche Notizen (alias)"],
  WikiSearch: ["Wiki", "suche im Wiki (alias)"],
  WikiGet: ["ReadNote", "liest Wiki-Notiz (alias)"],
  WikiApply: ["WriteNote", "wendet Wiki-Änderung an (alias)"],
  WikiStatus: ["WikiStatus", "Wiki-Status (agent-digest)"],
  WebSearch: ["SearchWeb", "suche im Internet (Exa, grob)"],
  ExtractUrl: ["Fetch", "rufe konkrete URL ab (TinyFish, fein)"],
  FetchUrl: ["Fetch", "rufe konkrete URL ab (TinyFish, fein)"],
  BrowseUrl: ["Browse", "URL-Zusammenfassung (TinyFish)"],
  ReadPdf: ["ReadPdf", "liest PDF aus dem Vault"],
  MailList: ["Mail", "listet E-Mails (himalaya)"],
  MailRead: ["Mail", "liest E-Mail (himalaya)"],
  MessageSend: ["MessageSend", "sendet Nachricht (openclaw)"],
  OpenRouter: ["Think", "Cloud-Denker"],
  ReadNote: ["ReadNote", "liest Notiz aus dem Vault"],
  Summarize: ["Summarize", "fasst Notiz zusammen"],
  CreateNote: ["WriteNote", "erstellt Notiz"],
  EditNote: ["WriteNote", "ändert Notiz"],
  ApplyEdit: ["WriteNote", "wendet Vault-Änderung an"],
  ListDir: ["ListDir", "listet Workspace-Verzeichnis"],
  ReadFile: ["ReadFile", "liest Datei im Workspace"],
  Grep: ["Grep", "sucht in Workspace-Dateien"],
  SearchReplace: ["SearchReplace", "ersetzt Text in Datei (1 Treffer)"],
  WriteFile: ["WriteFile", "schreibt Datei (Diff+Backup)"],
  RunCommand: ["RunCommand", "Shell (Whitelist)"],
};


/** Vault-/Wiki-Suchen: Aktion aus detail wählen (nie Obsidian-Arbeits-Vault behaupten, wenn es Wiki ist). */
const VAULT_FIND_STEPS = new Set(["VaultFind", "VaultRecall", "VaultSearch", "WikiSearch"]);

/**
 * @param {string} name Tool-/Stufenname
 * @param {string} [detail] step.detail aus dem Trace
 * @returns {[string, string]} [label, action]
 */
export function resolveStepDisplay(name, detail = "") {
  const base = STEP_LABELS[name] || [name, name];
  if (!VAULT_FIND_STEPS.has(name)) return base;

  const d = String(detail || "").toLowerCase();
  const raw = String(detail || "").trim();

  // Wiki / memory-wiki (Apfel aus) — kein Obsidian-/HSEQ-Wording.
  if (/memory-wiki|\bwiki\b/.test(d)) {
    return ["Wiki", "suche im Wiki"];
  }
  // Arbeits-Vault / HSEQ / ASI / hybrid / Obsidian.
  if (/arbeits|hseq|\basi\b|hybrid|obsidian/.test(d)) {
    return ["Vault", "suche im Arbeits-Vault"];
  }
  // Kein Detail → neutral (kann Wiki-only oder Vault sein).
  if (!raw) {
    return ["SearchVault", "suche Notizen"];
  }
  // Detail vorhanden, aber kein Wiki-Signal (z. B. „3 Treffer“) → Arbeits-Vault.
  return ["Vault", "suche im Arbeits-Vault"];
}

/**
 * Live-Think-Zeile. Kein hartes „DeepSeek CODE“ — der Detailtext trägt das Modell.
 *
 * @param {string} [detail]
 * @param {{ isCode?: boolean }} [opts]
 * @returns {string}
 */
export function formatThinkStep(detail, { isCode = false } = {}) {
  const d = String(detail || "").trim();
  if (d) return `Think · ${d}`;
  return isCode ? "Think · ^_Code" : "Think · Cloud-Denker";
}

/**
 * Baut den Grok-artigen Stufen-Banner aus dem Server-Trace.
 *
 * Format (eine Zeile je Stufe):
 *   Tool · <Label> — <Aktion><Ergebnis-Zusatz>
 * Dann eine Modell-Zeile + Trennlinie; der eigentliche Antworttext folgt danach.
 *
 * steps[] (aus core/tool_loop.py) enthalten {step, status, detail}. Bekannte
 * Namen werden übersetzt, unbekannte roh übernommen. Die Schritte „LLM“ und
 * „answer“ sind keine Werkzeuge und werden NICHT als Tool-Block ausgegeben;
 * stattdessen fließt das Modell in die OpenRouter-Zeile ein.
 *
 * @param {object} data Antwort des glyph-agent-Servers ({answer, trace:{steps, provider, model, ...}}).
 * @returns {string} Banner-Text; leer, wenn keine Schritte vorliegen.
 */
export function buildStepBanner(data) {
  const trace = data && typeof data.trace === "object" ? data.trace : null;
  const steps = trace && Array.isArray(trace.steps) ? trace.steps : [];
  if (!steps.length) return "";

  const lines = [];
  for (const s of steps) {
    const name = (s && s.step) || "";
    if (!name || name === "LLM" || name === "answer") continue; // keine Tool-Stufe
    const status = (s && s.status) || "";
    const detail = (s && s.detail && String(s.detail)) || "";
    const [label, action] = resolveStepDisplay(name, detail);

    // Ergebnis-Zusatz menschenlesbar: leer → „nichts gefunden“, Fehler → „fehlgeschlagen“,
    // sonst Detailtext (z.B. „grob/exa · 3 Treffer“) anhängen.
    let resultTxt = "";
    if (status === "empty") resultTxt = " — nichts gefunden";
    else if (status === "error") resultTxt = " — fehlgeschlagen";
    else if (detail) resultTxt = ` — ${detail}`;

    lines.push(`Tool · ${label} — ${action}${resultTxt}`);
  }

  if (!lines.length) return "";

  // Modell-/Router-Zeile aus dem echten Trace (OpenRouter oder Orca).
  const provider = trace.provider || "Router";
  const model = trace.model || "unbekannt";
  const hop = provider === "openrouter" || provider === "OpenRouter" ? "Router" : provider;
  const openrouter = `Router · ${hop} / ${model}`;

  // Endet mit einem Markierer, damit die UI den Tool-Block sauber vom
  // eigentlichen Antworttext trennen und separat stylen kann (dunkler/kleiner).
  return `${lines.join("\n")}\n${openrouter}\n<!-- glyph-steps-end -->\n\n`;
}
