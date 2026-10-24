/**
 * Unit tests: Chat / Deep Search / Fork composer actions.
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canFork,
  canSwarm,
  cloneSessionStore,
  composerActionLabel,
  composerModeOptions,
  deepResearchPrompt,
  FORK_HEAD_IDS,
  parseForkResponse,
  resolveComposerAction,
} from "../../shared/composerActions.mjs";

describe("resolveComposerAction", () => {
  it("keeps plain chat", () => {
    assert.deepEqual(resolveComposerAction("chat", "hello"), {
      action: "chat",
      text: "hello",
    });
  });

  it("routes /fork typed in chat to fork + directive", () => {
    assert.deepEqual(resolveComposerAction("chat", "/fork look at auth"), {
      action: "fork",
      text: "look at auth",
    });
  });

  it("bare /fork is a fork with empty directive", () => {
    assert.deepEqual(resolveComposerAction("chat", "/fork"), {
      action: "fork",
      text: "",
    });
  });

  it("routes /deep-research typed in chat", () => {
    assert.deepEqual(
      resolveComposerAction("chat", "/deep-research Postgres 17 vs MySQL 9"),
      { action: "deep-search", text: "Postgres 17 vs MySQL 9" },
    );
  });

  it("fork mode strips a typed /fork prefix", () => {
    assert.deepEqual(resolveComposerAction("fork", "/fork --no-worktree x"), {
      action: "fork",
      text: "--no-worktree x",
    });
  });

  it("deep-search mode strips a typed /deep-research prefix", () => {
    assert.deepEqual(
      resolveComposerAction("deep-search", "/deep-research alpha"),
      { action: "deep-search", text: "alpha" },
    );
  });

  it("routes /swarm typed in chat", () => {
    assert.deepEqual(resolveComposerAction("chat", "/swarm PSA-Normen"), {
      action: "swarm",
      text: "PSA-Normen",
    });
  });

  it("swarm mode strips a typed /swarm prefix", () => {
    assert.deepEqual(resolveComposerAction("swarm", "/swarm alpha"), {
      action: "swarm",
      text: "alpha",
    });
  });
});

describe("canSwarm / labels", () => {
  it("is for °_Agent and ^_Code, not Grok", () => {
    assert.equal(canSwarm("grok"), false);
    assert.equal(canSwarm("glyph-agent"), true);
    assert.equal(canSwarm("_code"), true);
    assert.equal(canSwarm("agent"), true);
  });

  it("labels the composer actions", () => {
    assert.equal(composerActionLabel("swarm"), "Swarm");
    assert.equal(composerActionLabel("deep-search"), "Deep Search");
    assert.equal(composerActionLabel("vault"), "Vault");
    assert.equal(composerActionLabel("chat"), "Chat");
    assert.equal(composerActionLabel("chat", "grok"), "Chat");
    assert.equal(composerActionLabel("chat", "_code"), "Chat");
    assert.equal(composerActionLabel("chat", "glyph-agent"), "Search");
    assert.equal(composerActionLabel("chat", "agent"), "Search");
  });
});

describe("composerModeOptions", () => {
  it("shows Vault and Swarm on °_Agent, not the blocked modes", () => {
    const opts = composerModeOptions("glyph-agent", { deepSearch: false, swarm: true });
    assert.deepEqual(
      opts.map((o) => o.id),
      ["chat", "vault", "swarm"],
    );
    assert.equal(opts[0].label, "Search");
  });

  it("shows Deep Search and Fork on Grok, not Swarm or Vault", () => {
    assert.deepEqual(
      composerModeOptions("grok", { deepSearch: true, swarm: false }).map((o) => o.id),
      ["chat", "deep-search", "fork"],
    );
    assert.equal(
      composerModeOptions("grok", { deepSearch: true, swarm: false })[0].label,
      "Chat",
    );
  });

  it("shows Fork and Swarm on ^_Code", () => {
    assert.deepEqual(
      composerModeOptions("_code", { deepSearch: false, swarm: true }).map((o) => o.id),
      ["chat", "fork", "swarm"],
    );
  });
});

describe("resolveComposerAction vault", () => {
  it("sends chat with the vault flag", () => {
    assert.deepEqual(resolveComposerAction("vault", "Leitern prüfen"), {
      action: "chat",
      text: "Leitern prüfen",
      vaultSearch: true,
    });
  });
});

describe("canFork", () => {
  it("is for ^_Code and Grok Build, not °_Agent", () => {
    assert.equal(canFork("glyph-agent"), false);
    assert.equal(canFork("agent"), false);
    assert.equal(canFork("_code"), true);
    assert.equal(canFork("code"), true);
    assert.equal(canFork("grok"), true);
  });

  it("blocks unknown or missing heads", () => {
    assert.equal(canFork(""), false);
    assert.equal(canFork(null), false);
    assert.equal(canFork(undefined), false);
  });

  it("keeps FORK_HEAD_IDS in sync with canFork", () => {
    for (const id of FORK_HEAD_IDS) {
      assert.equal(canFork(id), true, `${id} fehlt in canFork`);
    }
  });
});

describe("deepResearchPrompt", () => {
  it("prefixes once", () => {
    assert.equal(deepResearchPrompt("alpha"), "/deep-research alpha");
    assert.equal(
      deepResearchPrompt("/deep-research alpha"),
      "/deep-research alpha",
    );
  });

  it("empty stays empty", () => {
    assert.equal(deepResearchPrompt("  "), "");
  });
});

describe("parseForkResponse", () => {
  it("reads ACP sessionId", () => {
    assert.equal(parseForkResponse({ sessionId: "abc" }), "abc");
  });

  it("reads Grok newSessionId", () => {
    assert.equal(parseForkResponse({ newSessionId: "xyz" }), "xyz");
  });

  it("rejects empty", () => {
    assert.equal(parseForkResponse({}), null);
    assert.equal(parseForkResponse(null), null);
  });
});

describe("cloneSessionStore", () => {
  it("copies messages without aliasing", () => {
    const src = {
      messages: [{ role: "user", content: "hi" }],
      allowWriteTools: true,
    };
    const copy = cloneSessionStore(src);
    copy.messages.push({ role: "assistant", content: "yo" });
    copy.messages[0].content = "changed";
    assert.equal(src.messages.length, 1);
    assert.equal(src.messages[0].content, "hi");
    assert.equal(copy.allowWriteTools, true);
  });
});
