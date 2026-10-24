/**
 * Unit tests: skill discovery + frontmatter.
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  AGENT_GROK_BUNDLED_SKILLS,
  AGENT_HIDDEN_SKILLS,
  listSkillsForProfile,
  parseSkillFrontmatter,
  skillRootsForProfile,
  WEB_EXTRA_BUNDLED_SKILLS,
  withWebExtraSkills,
} from "../../server/skills.js";

describe("parseSkillFrontmatter", () => {
  it("reads name and folded description", () => {
    const raw = `---
name: grill-with-docs
description: >
  Relentless interview about a plan.
argument-hint: "<topic>"
---

# Body
`;
    const fm = parseSkillFrontmatter(raw);
    assert.equal(fm.name, "grill-with-docs");
    assert.match(fm.description || "", /Relentless interview/);
    assert.equal(fm.argumentHint, "<topic>");
  });

  it("returns empty without frontmatter", () => {
    assert.deepEqual(parseSkillFrontmatter("# hi"), {});
  });
});

describe("skillRootsForProfile", () => {
  it("grok roots include ~/.grok/skills", () => {
    const roots = skillRootsForProfile("grok", {
      home: "/Users/x",
      cwd: "/proj",
    });
    assert.ok(roots.some((r) => r.dir.endsWith("/.grok/skills")));
    assert.ok(roots.some((r) => r.source === "bundled"));
  });

  it("claude roots include ~/.claude/skills", () => {
    const roots = skillRootsForProfile("claude", {
      home: "/Users/x",
      cwd: "/proj",
    });
    assert.ok(roots.some((r) => r.dir.includes(".claude/skills")));
  });

  it("all heads scan ~/.glyph/skills (merken)", () => {
    for (const id of ["grok", "_code", "glyph-agent"]) {
      const roots = skillRootsForProfile(id, { home: "/Users/x", cwd: "/proj" });
      assert.ok(
        roots.some((r) => r.dir.endsWith("/.glyph/skills")),
        `${id}: ~/.glyph/skills fehlt`,
      );
    }
  });

  it("grok roots stay unfiltered — every bundled skill is offered", () => {
    const roots = skillRootsForProfile("grok", { home: "/Users/x", cwd: "/proj" });
    const bundled = roots.find((r) => r.dir.endsWith("/.grok/bundled/skills"));
    assert.ok(bundled, "bundled root fehlt");
    assert.equal(bundled.only, undefined);
  });

  it("glyph-agent gets grok user skills + a bundled allowlist", () => {
    const roots = skillRootsForProfile("glyph-agent", {
      home: "/Users/x",
      cwd: "/proj",
    });
    assert.ok(roots.some((r) => r.dir.endsWith("/.grok/skills")));
    const bundled = roots.find((r) => r.dir.endsWith("/.grok/bundled/skills"));
    assert.ok(bundled, "bundled root fehlt");
    assert.deepEqual(bundled.only, AGENT_GROK_BUNDLED_SKILLS);
    // Grok-interne Bundled-Skills dürfen nicht im Agenten-Katalog landen
    assert.ok(!AGENT_GROK_BUNDLED_SKILLS.includes("create-workflow"));
    assert.ok(!AGENT_GROK_BUNDLED_SKILLS.includes("statusline"));
  });
});

/** Write a minimal skill package `<root>/<dir>/SKILL.md`. */
async function writeSkill(root, dir, name, description = "test") {
  const target = path.join(root, dir);
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(
    path.join(target, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n# ${name}\n`,
    "utf8",
  );
}

describe("listSkillsForProfile", () => {
  it("discovers SKILL.md packages under user dir", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "glyph-skills-"));
    const skillDir = path.join(tmp, ".grok", "skills", "demo-skill");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: demo-skill
description: A test skill
---
# Demo
`,
      "utf8",
    );
    const result = await listSkillsForProfile("grok", {
      home: tmp,
      cwd: path.join(tmp, "empty-cwd"),
    });
    assert.ok(result.skills.some((s) => s.name === "demo-skill"));
    const hit = result.skills.find((s) => s.name === "demo-skill");
    assert.equal(hit.kind, "skill");
    assert.match(hit.description, /test skill/i);
  });

  it("lists merken from shared ~/.glyph/skills", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "glyph-merken-"));
    const skillDir = path.join(tmp, ".glyph", "skills", "merken");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: merken
description: "Eine Erkenntnis in die richtige Schicht. Wiki nur nach Vorlage."
user-invocable: true
---
# merken
`,
      "utf8",
    );
    const result = await listSkillsForProfile("glyph-agent", {
      home: tmp,
      cwd: path.join(tmp, "empty-cwd"),
    });
    const hit = result.skills.find((s) => s.name === "merken");
    assert.ok(hit, "merken nicht im Katalog");
    assert.equal(hit.kind, "skill");
    assert.match(hit.description, /Vorlage/);
  });

  it("follows symlinked skill dirs (Shared SoT)", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "glyph-link-"));
    // Real package in the profile tree, linked into the shared SoT.
    await writeSkill(
      path.join(tmp, ".glyph-agent", "skills"),
      "linked-target",
      "linked-skill",
    );
    await fs.mkdir(path.join(tmp, ".glyph", "skills"), { recursive: true });
    await fs.symlink(
      path.join(tmp, ".glyph-agent", "skills", "linked-target"),
      path.join(tmp, ".glyph", "skills", "linked-skill"),
    );
    const result = await listSkillsForProfile("glyph-agent", {
      home: tmp,
      cwd: path.join(tmp, "empty-cwd"),
    });
    assert.ok(
      result.skills.some((s) => s.name === "linked-skill"),
      "Symlink-Skill fehlt im Katalog",
    );
  });

  it("drops dangling symlinks instead of failing", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "glyph-dangling-"));
    await fs.mkdir(path.join(tmp, ".glyph", "skills"), { recursive: true });
    await fs.symlink(
      path.join(tmp, "does-not-exist"),
      path.join(tmp, ".glyph", "skills", "broken"),
    );
    const result = await listSkillsForProfile("glyph-agent", {
      home: tmp,
      cwd: path.join(tmp, "empty-cwd"),
    });
    assert.deepEqual(result.skills, []);
  });

  it("°_Agent offers only allowlisted bundled skills, Grok offers all", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "glyph-bundled-"));
    const bundled = path.join(tmp, ".grok", "bundled", "skills");
    await writeSkill(bundled, "code-review", "code-review");
    await writeSkill(bundled, "statusline", "statusline");
    const opts = { home: tmp, cwd: path.join(tmp, "empty-cwd") };

    const agent = await listSkillsForProfile("glyph-agent", opts);
    assert.ok(agent.skills.some((s) => s.name === "code-review"));
    assert.ok(
      !agent.skills.some((s) => s.name === "statusline"),
      "Grok-interner Skill im Agenten-Katalog",
    );

    const grok = await listSkillsForProfile("grok", opts);
    assert.ok(grok.skills.some((s) => s.name === "code-review"));
    assert.ok(
      grok.skills.some((s) => s.name === "statusline"),
      "Grok verliert Bundled-Skills",
    );
  });

  it("°_Agent sees the user's own ~/.grok/skills", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "glyph-userskills-"));
    await writeSkill(
      path.join(tmp, ".grok", "skills"),
      "grilling",
      "grilling",
      "Grill den User zu Plan/Entscheidung",
    );
    const result = await listSkillsForProfile("glyph-agent", {
      home: tmp,
      cwd: path.join(tmp, "empty-cwd"),
    });
    const hit = result.skills.find((s) => s.name === "grilling");
    assert.ok(hit, "Nutzer-Skill fehlt beim Agenten");
    assert.equal(hit.source, "user");
  });

  it("hides the curated-unnecessary skills from °_Agent only", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "glyph-hidden-"));
    await writeSkill(
      path.join(tmp, ".glyph", "skills"),
      "einmal-job",
      "einmal-job",
    );
    await writeSkill(
      path.join(tmp, ".grok", "skills"),
      "hseq-eingang",
      "hseq-eingang",
    );
    await writeSkill(path.join(tmp, ".grok", "skills"), "stop-slop", "stop-slop");
    const opts = { home: tmp, cwd: path.join(tmp, "empty-cwd") };

    const agent = await listSkillsForProfile("glyph-agent", opts);
    assert.deepEqual(agent.skills.map((s) => s.name), ["stop-slop"]);
    assert.ok(AGENT_HIDDEN_SKILLS.includes("einmal-job"));
    assert.ok(AGENT_HIDDEN_SKILLS.includes("hseq-eingang"));

    // Grok bleibt unangetastet — dieselben Skills bleiben im Katalog
    const grok = await listSkillsForProfile("grok", opts);
    assert.deepEqual(
      grok.skills.map((s) => s.name).sort(),
      ["einmal-job", "hseq-eingang", "stop-slop"],
    );
  });

  it("web extras add docx, pdf, review and leave the desk catalog alone", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "glyph-web-extra-"));
    const bundled = path.join(tmp, ".grok", "bundled", "skills");
    await writeSkill(bundled, "docx", "docx");
    await writeSkill(bundled, "pdf", "pdf");
    await writeSkill(bundled, "review", "review");
    await writeSkill(bundled, "statusline", "statusline");
    const opts = { home: tmp, cwd: path.join(tmp, "empty-cwd") };

    const agent = await listSkillsForProfile("glyph-agent", opts);
    assert.ok(!agent.skills.some((s) => s.name === "docx"));
    assert.deepEqual(WEB_EXTRA_BUNDLED_SKILLS, ["docx", "pdf", "review"]);

    const web = await withWebExtraSkills(agent, opts);
    assert.deepEqual(
      web.skills.map((s) => s.name),
      ["docx", "pdf", "review"],
    );
    assert.equal(web.skills.every((s) => s.customer === true), true);
    assert.ok(!web.skills.some((s) => s.name === "statusline"));
  });
});
