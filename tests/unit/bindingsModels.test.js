/**
 * Model/Host-Patch für Graph-Anbindung (°_Agent / ^_Code).
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyLiveStatus,
  buildModelsPatch,
  hopFromModelId,
  hopPill,
  hopRow,
  hostShort,
  isCloudModelProfile,
  modelHudFromBindings,
  modelsForHead,
  providerLabel,
  routerKind,
} from "../../client/src/utils/bindingsModels.js";

describe("modelsForHead", () => {
  const bindings = {
    models: {
      shared: { primary: "deepseek-v4-pro", fallback: "deepseek/deepseek-v4-flash-0731" },
      code: { primary: "google/gemini-3.7-flash", fallback: "" },
    },
  };

  it("agent uses shared pair", () => {
    const m = modelsForHead(bindings, "agent");
    assert.equal(m.primary, "deepseek-v4-pro");
    assert.equal(m.fallback, "deepseek/deepseek-v4-flash-0731");
    assert.equal(m.source, "shared");
  });

  it("code uses override when set", () => {
    const m = modelsForHead(bindings, "code");
    assert.equal(m.primary, "google/gemini-3.7-flash");
    assert.equal(m.source, "code");
  });

  it("code falls back to shared when no override", () => {
    const m = modelsForHead(
      { models: { shared: { primary: "deepseek-v4-flash", fallback: "" }, code: null } },
      "code",
    );
    assert.equal(m.primary, "deepseek-v4-flash");
    assert.equal(m.source, "shared");
  });
});

describe("buildModelsPatch", () => {
  it("agent writes shared only", () => {
    assert.deepEqual(
      buildModelsPatch({
        absorb: "agent",
        primary: " deepseek-v4-flash ",
        fallback: "deepseek/deepseek-v4-flash-0731",
      }),
      {
        models: {
          shared: {
            primary: "deepseek-v4-flash",
            fallback: "deepseek/deepseek-v4-flash-0731",
          },
        },
      },
    );
  });

  it("agent rejects empty primary", () => {
    assert.equal(buildModelsPatch({ absorb: "agent", primary: "  ", fallback: "" }), null);
  });

  it("code override is a slash Router slug", () => {
    assert.deepEqual(
      buildModelsPatch({
        absorb: "code",
        primary: "google/gemini-3.7-flash",
        fallback: "",
      }),
      {
        models: {
          code: { primary: "google/gemini-3.7-flash", fallback: "" },
        },
      },
    );
  });

  it("empty code primary clears override (teilt Agent)", () => {
    assert.deepEqual(buildModelsPatch({ absorb: "code", primary: "", fallback: "x" }), {
      models: { code: null },
    });
  });
});

describe("hopFromModelId", () => {
  it("no slash is Direct", () => {
    assert.equal(hopFromModelId("deepseek-v4-flash-vision-exp"), "direct");
  });
  it("slash is Router", () => {
    assert.equal(hopFromModelId("z-ai/glm-5.3-flash"), "openrouter");
    assert.equal(hopFromModelId("deepseek/deepseek-v4-flash-0731"), "openrouter");
  });
});

describe("hostShort", () => {
  it("strips protocol and path", () => {
    assert.equal(hostShort("https://api.deepseek.com"), "api.deepseek.com");
    assert.equal(hostShort("https://openrouter.ai/api/v1"), "openrouter.ai");
    assert.equal(hostShort("https://api.orcarouter.ai/v1"), "api.orcarouter.ai");
  });
  it("empty is empty", () => {
    assert.equal(hostShort(""), "");
    assert.equal(hostShort(null), "");
  });
  it("tolerates missing protocol", () => {
    assert.equal(hostShort("api.deepseek.com"), "api.deepseek.com");
  });
});

describe("routerKind", () => {
  it("names OpenRouter and Orca hosts", () => {
    assert.equal(routerKind("https://openrouter.ai/api/v1"), "openrouter");
    assert.equal(routerKind("https://api.orcarouter.ai/v1"), "orca");
    assert.equal(routerKind("https://gateway.example/v1"), "custom");
  });
});

describe("hopPill", () => {
  it("Direct without slash, Router with slash", () => {
    assert.equal(hopPill("deepseek-v4-flash-vision-exp"), "Direct");
    assert.equal(hopPill("z-ai/glm-5.3-flash"), "Router");
  });
});

describe("hopRow", () => {
  it("Direct is live when key is set", () => {
    const row = hopRow(
      {
        keys: { DIRECT_API_KEY: { set: true, masked: "…abcd" } },
        settings: {
          DIRECT_API_URL: { value: "https://api.deepseek.com", source: "store" },
        },
      },
      "direct",
    );
    assert.equal(row.id, "direct");
    assert.equal(row.label, "Direct");
    assert.equal(row.live, true);
    assert.equal(row.state, "live");
    assert.equal(row.hostShort, "api.deepseek.com");
    assert.equal(row.source, "store");
    assert.equal(row.masked, "…abcd");
  });

  it("Router is cut without key and defaults OpenRouter host", () => {
    const row = hopRow({ keys: {}, settings: {} }, "router");
    assert.equal(row.id, "router");
    assert.equal(row.label, "Router");
    assert.equal(row.live, false);
    assert.equal(row.state, "cut");
    assert.equal(row.kind, "openrouter");
    assert.equal(row.hostShort, "openrouter.ai");
  });

  it("Router kind follows Orca host", () => {
    const row = hopRow(
      {
        keys: { OPENROUTER_API_KEY: { set: true, masked: "…orca" } },
        settings: {
          OPENROUTER_URL: {
            value: "https://api.orcarouter.ai/v1",
            source: "store",
          },
        },
      },
      "router",
    );
    assert.equal(row.kind, "orca");
    assert.equal(row.live, true);
    assert.equal(row.hostShort, "api.orcarouter.ai");
  });
});

describe("providerLabel", () => {
  it("names the slash-hop Router, not OpenRouter", () => {
    assert.equal(providerLabel("openrouter"), "Router");
    assert.equal(providerLabel("hybrid", { isPeak: true }), "Hybrid · Peak → Router");
    assert.equal(providerLabel("direct"), "Direkt");
  });
});

describe("applyLiveStatus", () => {
  it("success is live am Agent", () => {
    assert.deepEqual(applyLiveStatus({ ok: true, applied: true }), {
      ok: true,
      text: "Gespeichert · live am Agent.",
    });
  });

  it("failed apply is an error, not silent save", () => {
    const s = applyLiveStatus({ ok: false, applied: false, error: "offline" });
    assert.equal(s.ok, false);
    assert.match(s.text, /offline/);
  });

  it("missing apply is an error", () => {
    const s = applyLiveStatus(null);
    assert.equal(s.ok, false);
  });
});

describe("isCloudModelProfile", () => {
  it("is true for °_Agent and ^_Code, not Grok", () => {
    assert.equal(isCloudModelProfile("glyph-agent"), true);
    assert.equal(isCloudModelProfile("_code"), true);
    assert.equal(isCloudModelProfile("grok"), false);
  });
});

describe("modelHudFromBindings", () => {
  const payload = {
    modelsMismatch: true,
    models: {
      shared: { primary: "deepseek-v4-flash-vision-exp", fallback: "deepseek/deepseek-v4-flash-0731" },
      code: { primary: "deepseek-v4-flash-vision-exp", fallback: "" },
    },
    modelsActive: {
      shared: { primary: "old-shared", fallback: "old-fb" },
      code: { primary: "old-code", fallback: "" },
      active: { primary: "live-shared", fallback: "live-fb", label: "live-shared" },
    },
  };

  it("uses live shared models for °_Agent", () => {
    const hud = modelHudFromBindings(payload, "glyph-agent");
    assert.equal(hud.kind, "openrouter");
    assert.equal(hud.primary, "live-shared");
    assert.equal(hud.fallback, "live-fb");
    assert.equal(hud.liveLabel, "live-shared");
    assert.equal(hud.mismatch, true);
    assert.match(hud.label, /live-shared/);
  });

  it("uses code override for ^_Code when present", () => {
    const hud = modelHudFromBindings(payload, "_code");
    assert.equal(hud.primary, "old-code");
    assert.equal(hud.fallback, "");
  });
});
