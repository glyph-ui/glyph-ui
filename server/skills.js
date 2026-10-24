/**
 * Profile-dependent skill discovery for Glyph Extensions-Modal / Slash-Popup.
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/**
 * @typedef {object} SkillEntry
 * @property {string} name
 * @property {string} description
 * @property {string} [inputHint]
 * @property {"skill"} kind
 * @property {"user"|"bundled"|"plugin"|"project"|"command"} source
 * @property {string} [path]
 */

/**
 * @param {string} raw
 * @returns {{ name?: string, description?: string, argumentHint?: string }}
 */
export function parseSkillFrontmatter(raw) {
  const text = String(raw || "");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const block = m[1];
  /** @type {Record<string, string>} */
  const fields = {};
  let key = null;
  let buf = [];
  const flush = () => {
    if (!key) return;
    fields[key] = buf.join("\n").trim();
    key = null;
    buf = [];
  };
  for (const line of block.split(/\r?\n/)) {
    const km = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (km && !line.startsWith(" ") && !line.startsWith("\t")) {
      flush();
      key = km[1];
      const rest = km[2];
      if (rest === ">" || rest === "|") {
        buf = [];
      } else {
        buf = [rest.replace(/^["']|["']$/g, "")];
      }
      continue;
    }
    if (key != null) {
      buf.push(line.replace(/^\s+/, ""));
    }
  }
  flush();
  return {
    name: fields.name || undefined,
    description: fields.description || undefined,
    argumentHint: fields["argument-hint"] || fields.argumentHint || undefined,
    // customer: true = auch für Kunden (Web-Fläche) freigegeben. Fehlt es,
    // gilt der Skill als Betriebs-Skill (Meldung 2026-10-03: „alle Skills
    // prüfen, ob sie überhaupt einsetzbar sind").
    customer: fields.customer != null
      ? /^(1|true|yes|ja)$/i.test(String(fields.customer).trim())
      : undefined,
  };
}

/**
 * Grok-Build-Bundled-Skills, die der °_Agent zusätzlich bekommt.
 *
 * Grok bleibt unangetastet und behält **alle** Bundled-Skills. Der °_Agent
 * bekommt daraus nur die, die ohne Grok-CLI-Laufzeit funktionieren — reine
 * Wissens-, Bewertungs- und Textarbeit. Bewusst **nicht** dabei:
 * `create-workflow` (Rhai), `statusline` (TUI-Config), `imagine` + `game-*`
 * (Imagine-Tools), `resume-claude|codex|cursor` (session_reader.py),
 * `pr-babysit`/`review`/`implement`/`execute-plan` (git/`gh`/Subagenten-
 * Worktrees), `docx`/`pdf`/`pptx` (python3/pandoc/LibreOffice), `learn`
 * (Grok-Session-Tuning), `create-skill` (schreibt in ~/.grok/skills).
 * `build-with-ai`, `skill-design-principles` und `threejs-frame-conventions`
 * waren zunächst dabei und sind am 2026-10-11 auf Wunsch entfallen.
 * Wirkung: neue Bundled-Skills landen nie versehentlich im Agenten-Katalog.
 *
 * @type {readonly string[]}
 */
export const AGENT_GROK_BUNDLED_SKILLS = ["code-review", "design"];

/**
 * Bundled-Skills, die nur die Web-Fläche (glyph-ui.com) zusätzlich anbietet.
 * Der Schreibtisch-°_Agent bleibt bei `AGENT_GROK_BUNDLED_SKILLS`. Gäste sehen
 * sie, weil der Katalog sie als `customer: true` ausliefert.
 *
 * @type {readonly string[]}
 */
export const WEB_EXTRA_BUNDLED_SKILLS = ["docx", "pdf", "review"];

/**
 * Skills, die dem °_Agent **nicht** angeboten werden (Auswahl 2026-10-11).
 *
 * Diese Namen kommen beim Agenten aus Nutzer-Roots (Shared SoT, `~/.glyph/skills`,
 * `~/.glyph-agent/skills`, `~/.grok/skills`), nicht aus Groks Bundled-Bestand —
 * dort regelt `AGENT_GROK_BUNDLED_SKILLS` die Aufnahme. Es wird nur die Palette
 * gefiltert: die Dateien bleiben auf Disk, Slash-Ausführung per Hand bleibt
 * möglich, und **Grok bleibt unangetastet**.
 *
 * @type {readonly string[]}
 */
export const AGENT_HIDDEN_SKILLS = [
  "build-with-exa",
  "einmal-job",
  "frontend-ux-engineer",
  "hseq-aus-fertig-lernen",
  "hseq-eingang",
  "hseq-handover",
  "tdd-intelligence",
];

/**
 * Roots to scan for a profile (absolute directories that may contain skills).
 *
 * @param {string} profileId
 * @param {{ home?: string, cwd?: string, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {Array<{ dir: string, source: SkillEntry["source"], only?: readonly string[] }>}
 */
export function skillRootsForProfile(profileId, opts = {}) {
  const home = opts.home || os.homedir();
  const cwd = opts.cwd || process.cwd();
  const id = String(profileId || "grok");
  /** @type {Array<{ dir: string, source: SkillEntry["source"] }>} */
  const roots = [];

  // Shared SoT: ~/.glyph/skills — Grok, ^_Code, °_Agent (same skills, no re-tell)
  const sharedGlyphSkills = path.join(home, ".glyph", "skills");
  const agentSkills = path.join(home, ".glyph-agent", "skills");

  if (id === "grok") {
    roots.push(
      { dir: sharedGlyphSkills, source: "user" },
      { dir: path.join(home, ".grok", "skills"), source: "user" },
      { dir: path.join(home, ".grok", "bundled", "skills"), source: "bundled" },
      { dir: path.join(cwd, ".grok", "skills"), source: "project" },
      { dir: path.join(cwd, ".agents", "skills"), source: "project" },
    );
  } else if (id === "claude" || id === "_tick" || id === "tick" || id === "_code" || id === "code") {
    // ^_Code: shared Glyph skills + code-local + optional Claude
    roots.push(
      { dir: sharedGlyphSkills, source: "user" },
      { dir: agentSkills, source: "user" },
      { dir: path.join(home, ".glyph", "code-skills"), source: "user" },
      { dir: path.join(home, ".claude", "skills"), source: "user" },
      { dir: path.join(home, ".claude", "commands"), source: "user" },
      { dir: path.join(cwd, ".claude", "skills"), source: "project" },
      { dir: path.join(cwd, ".agents", "skills"), source: "project" },
    );
  } else if (id === "glyph-agent") {
    // °_Agent: Shared SoT + eigene Skills + Projekt-Roots. Zusätzlich die
    // Skills, die der User in ~/.grok/skills selbst gepflegt hat (das ist eine
    // Nutzer-Bibliothek, keine Grok-CLI-Interna) und aus Groks Bundled-Bestand
    // nur die agententaugliche Allowlist — Grok selbst bleibt unverändert.
    roots.push(
      { dir: sharedGlyphSkills, source: "user" },
      { dir: agentSkills, source: "user" },
      { dir: path.join(home, ".grok", "skills"), source: "user" },
      {
        dir: path.join(home, ".grok", "bundled", "skills"),
        source: "bundled",
        only: AGENT_GROK_BUNDLED_SKILLS,
      },
      { dir: path.join(cwd, ".agents", "skills"), source: "project" },
      { dir: path.join(cwd, ".glyph", "skills"), source: "project" },
    );
  } else {
    roots.push(
      { dir: sharedGlyphSkills, source: "user" },
      { dir: path.join(cwd, ".agents", "skills"), source: "project" },
      { dir: path.join(home, ".grok", "skills"), source: "user" },
    );
  }

  return roots;
}

/**
 * Plugin skill roots under ~/.grok/installed-plugins (grok only).
 * @param {string} home
 * @returns {Promise<Array<{ dir: string, source: SkillEntry["source"] }>>}
 */
async function grokPluginSkillRoots(home) {
  const base = path.join(home, ".grok", "installed-plugins");
  /** @type {Array<{ dir: string, source: SkillEntry["source"] }>} */
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(base, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    // Common layouts: plugin/skills, plugin/grok/skills
    for (const sub of ["skills", path.join("grok", "skills")]) {
      out.push({
        dir: path.join(base, ent.name, sub),
        source: "plugin",
      });
    }
  }
  return out;
}

/**
 * @param {string} skillMdPath
 * @param {SkillEntry["source"]} source
 * @returns {Promise<SkillEntry | null>}
 */
async function readSkillFile(skillMdPath, source) {
  let raw;
  try {
    raw = await fs.readFile(skillMdPath, "utf8");
  } catch {
    return null;
  }
  const fm = parseSkillFrontmatter(raw);
  const dirName = path.basename(path.dirname(skillMdPath));
  const fileStem = path.basename(skillMdPath, path.extname(skillMdPath));
  const name = String(fm.name || (fileStem === "SKILL" ? dirName : fileStem))
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  if (!name) return null;
  const description = String(fm.description || "").trim();
  const inputHint = String(fm.argumentHint || "").trim();
  return {
    name,
    description,
    inputHint,
    customer: fm.customer,
    kind: "skill",
    source,
    path: skillMdPath,
  };
}

/**
 * Entry type with symlinks resolved.
 *
 * Shared SoT: `~/.glyph/skills/<name>` links into a profile's own tree
 * (`~/.glyph-agent/skills/<name>`). A `readdir` Dirent reports such an entry
 * as neither directory nor file, so linked skills silently vanished from every
 * catalog. `stat` (not `lstat`) follows the link.
 *
 * @param {import("node:fs").Dirent} ent
 * @param {string} full
 * @returns {Promise<"dir"|"file"|"other">}
 */
async function entryKind(ent, full) {
  if (ent.isDirectory()) return "dir";
  if (ent.isFile()) return "file";
  if (!ent.isSymbolicLink()) return "other";
  try {
    const st = await fs.stat(full);
    if (st.isDirectory()) return "dir";
    if (st.isFile()) return "file";
  } catch {
    // dangling link — ignore
  }
  return "other";
}

/**
 * Scan one directory for SKILL.md packages or flat *.md command files.
 *
 * @param {string} dir
 * @param {SkillEntry["source"]} source
 * @param {readonly string[]} [only]  allowlist of skill names (undefined = all)
 * @returns {Promise<SkillEntry[]>}
 */
async function scanSkillDir(dir, source, only) {
  /** @type {SkillEntry[]} */
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  const allow = Array.isArray(only) ? new Set(only) : null;

  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    const kind = await entryKind(ent, full);
    if (kind === "dir") {
      const skillMd = path.join(full, "SKILL.md");
      const skill = await readSkillFile(skillMd, source);
      if (skill && (!allow || allow.has(skill.name))) out.push(skill);
      continue;
    }
    if (kind !== "file") continue;
    // Flat command markdown (Claude-style commands/)
    if (/\.md$/i.test(ent.name) && ent.name.toUpperCase() !== "SKILL.MD") {
      const skill = await readSkillFile(full, source);
      if (skill && (!allow || allow.has(skill.name))) out.push(skill);
    }
  }
  return out;
}

/**
 * @param {string} profileId
 * @param {{ home?: string, cwd?: string, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {Promise<{ profile: string, skills: SkillEntry[], roots: string[], hint: string | null }>}
 */
export async function listSkillsForProfile(profileId, opts = {}) {
  const home = opts.home || os.homedir();
  const id = String(profileId || "grok");
  let roots = skillRootsForProfile(id, { ...opts, home });
  if (id === "grok") {
    roots = roots.concat(await grokPluginSkillRoots(home));
  }

  /** @type {Map<string, SkillEntry>} */
  const byName = new Map();
  // Later roots override earlier only if higher priority: project > user > plugin > bundled
  const priority = { project: 4, user: 3, plugin: 2, bundled: 1, command: 1 };
  for (const { dir, source, only } of roots) {
    const found = await scanSkillDir(dir, source, only);
    for (const s of found) {
      const prev = byName.get(s.name);
      if (!prev || (priority[s.source] || 0) >= (priority[prev.source] || 0)) {
        byName.set(s.name, s);
      }
    }
  }

  // Kuratierte Palette: der °_Agent zeigt die als unnötig markierten Skills
  // nicht an (Dateien bleiben liegen, Grok sieht sie weiter).
  const hidden = id === "glyph-agent" ? new Set(AGENT_HIDDEN_SKILLS) : null;
  const skills = [...byName.values()]
    .filter((s) => !hidden?.has(s.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  let hint = null;
  if (skills.length === 0) {
    if (id === "glyph-agent") {
      hint =
        "Keine Skills gefunden. Optional: ~/.glyph/skills/<name>/SKILL.md anlegen.";
    } else if (id === "claude" || id === "_tick" || id === "tick" || id === "_code" || id === "code") {
      hint =
        "Keine ^_Code-Skills gefunden (optional: ~/.glyph/code-skills oder ~/.claude/skills).";
    } else {
      hint = "Keine Skills gefunden unter ~/.grok/skills.";
    }
  }

  return {
    profile: id,
    skills,
    roots: roots.map((r) => r.dir),
    hint,
  };
}

/**
 * Web-Fläche: `docx`, `pdf`, `review` aus dem Grok-Bundled-Bestand an den
 * Profil-Katalog hängen. Schreibtisch-Listen rufen das nicht auf.
 *
 * @param {{ profile: string, skills: SkillEntry[], roots: string[], hint: string | null }} result
 * @param {{ home?: string }} [opts]
 */
export async function withWebExtraSkills(result, opts = {}) {
  const home = opts.home || os.homedir();
  const dir = path.join(home, ".grok", "bundled", "skills");
  const extra = await scanSkillDir(dir, "bundled", WEB_EXTRA_BUNDLED_SKILLS);
  const byName = new Map((result.skills || []).map((s) => [s.name, s]));
  for (const skill of extra) {
    if (byName.has(skill.name)) continue;
    byName.set(skill.name, { ...skill, customer: true });
  }
  return {
    ...result,
    skills: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}
