/**
 * Unit tests: context LVL meter math + window map.
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  contextFillRatio,
  estimateTokensFromTexts,
  formatContextTooltip,
  formatLvlBarLabel,
  formatTokenCount,
  PACK_TOKENS,
  TOKENS_PER_CENT,
  packCharge,
  packMeter,
  goldFillRatio,
  resolveContextWindow,
  scrollMetrics,
} from "../../shared/contextMeter.mjs";

describe("resolveContextWindow", () => {
  it("maps gpt-5.6-luna to 1M; Agent stays 256k", () => {
    const r = resolveContextWindow("openai/gpt-5.6-luna", "");
    assert.equal(r.window, 1_000_000);
    assert.equal(r.source, "map");
    assert.equal(
      resolveContextWindow("openai/gpt-5.6-luna", "glyph-agent").window,
      256_000,
    );
  });

  it("maps sonnet-5 style ids to 1M", () => {
    assert.equal(resolveContextWindow("claude-sonnet-5", "claude").window, 1_000_000);
    assert.equal(resolveContextWindow("anthropic/claude-sonnet-5", "claude").window, 1_000_000);
  });

  it("maps deepseek-v4-flash to 1M on ^_Code, 256k on °_Agent", () => {
    assert.equal(
      resolveContextWindow("deepseek-v4-flash-0731", "_code").window,
      1_000_000,
    );
    assert.equal(
      resolveContextWindow("deepseek-v4-flash-0731", "glyph-agent").window,
      256_000,
    );
  });

  it("maps deepseek-v4-flash-vision-exp to 1M on Code, 256k on Agent", () => {
    const agent = resolveContextWindow(
      "deepseek-v4-flash-vision-exp",
      "glyph-agent",
    );
    assert.equal(agent.window, 256_000);
    assert.equal(agent.source, "profile");
    assert.equal(
      resolveContextWindow("deepseek-v4-flash-vision-exp", "_code").window,
      1_000_000,
    );
  });

  it("maps deepseek-reasoner to 1M on Code", () => {
    assert.equal(
      resolveContextWindow("deepseek-reasoner", "_code").window,
      1_000_000,
    );
    assert.equal(
      resolveContextWindow("deepseek/deepseek-reasoner", "_code").window,
      1_000_000,
    );
  });

  it("maps grok-4.5 to 500k", () => {
    assert.equal(resolveContextWindow("grok-4.5", "grok").window, 500_000);
  });

  it("falls back to profile default", () => {
    const r = resolveContextWindow("", "claude");
    assert.equal(r.window, 1_000_000);
    assert.equal(r.source, "profile");
  });

  it("ignores sticky grok model when profile is glyph-agent", () => {
    const r = resolveContextWindow("grok-4.5", "glyph-agent");
    assert.equal(r.window, 256_000);
    assert.equal(r.source, "profile");
    assert.equal(r.matchedKey, "glyph-agent");
  });

  it("ignores sticky grok model when profile is claude", () => {
    const r = resolveContextWindow("grok-4.5", "claude");
    assert.equal(r.window, 1_000_000);
    assert.equal(r.source, "profile");
  });

  it("glyph-agent profile default is 256k with empty model", () => {
    const r = resolveContextWindow("", "glyph-agent");
    assert.equal(r.window, 256_000);
    assert.equal(r.source, "profile");
  });
});

describe("contextFillRatio / goldFillRatio", () => {
  it("computes fill from used/window", () => {
    assert.equal(contextFillRatio(250_000, 500_000), 0.5);
    assert.equal(contextFillRatio(0, 500_000), 0);
    assert.equal(contextFillRatio(600_000, 500_000), 1);
  });

  it("gold = full context without overflow", () => {
    assert.equal(goldFillRatio(0.48, 0.2, false), 0.48);
  });

  it("gold = scroll × context with overflow", () => {
    assert.ok(Math.abs(goldFillRatio(0.5, 0.5, true) - 0.25) < 1e-9);
    assert.equal(goldFillRatio(0.5, 0, true), 0);
    assert.equal(goldFillRatio(0.5, 1, true), 0.5);
  });
});

describe("estimateTokensFromTexts / format", () => {
  it("estimates ~chars/4", () => {
    assert.equal(estimateTokensFromTexts(["abcd"]), 1);
    assert.equal(estimateTokensFromTexts(["a".repeat(40)]), 10);
  });

  it("formats token counts", () => {
    assert.equal(formatTokenCount(500), "500");
    assert.equal(formatTokenCount(241_000), "241k");
    assert.equal(formatTokenCount(1_000_000), "1M");
  });

  it("builds tooltip with optional approx", () => {
    const t = formatContextTooltip({
      used: 500_000,
      window: 1_000_000,
      model: "gpt-5.6-luna",
      estimated: true,
      softCapPercent: 80,
    });
    assert.match(t, /~/);
    assert.match(t, /gpt-5.6-luna/);
    assert.match(t, /50%/);
    assert.match(t, /soft-cap 80%/);
  });
});


describe("formatLvlBarLabel", () => {
  it("empty → LVL 0 · 0%", () => {
    assert.equal(formatLvlBarLabel(0), "LVL 0 · 0%");
    assert.equal(formatLvlBarLabel(0, false), "LVL 0 · 0%");
  });

  it("token scale keeps level and used/window apart", () => {
    const pct = Math.round((21_000 / 256_000) * 100);
    assert.equal(
      formatLvlBarLabel(pct, false, { tokens: true, used: 21_000, window: 256_000 }),
      "LVL 0 · 21k/256k",
    );
  });

  it("level digit = floor(pct/10) clamped 0..10", () => {
    assert.equal(formatLvlBarLabel(1), "LVL 0 · 1%");
    assert.equal(formatLvlBarLabel(9), "LVL 0 · 9%");
    assert.equal(formatLvlBarLabel(10), "LVL 1 · 10%");
    assert.equal(formatLvlBarLabel(45), "LVL 4 · 45%");
    assert.equal(formatLvlBarLabel(99), "LVL 9 · 99%");
    assert.equal(formatLvlBarLabel(100), "LVL 10 · 100%");
  });

  it("~ when estimated and pct > 0; empty estimated has no tilde", () => {
    assert.equal(formatLvlBarLabel(0, true), "LVL 0 · 0%");
    assert.equal(formatLvlBarLabel(48, true), "LVL 4 · ~48%");
    assert.equal(formatLvlBarLabel(48, false), "LVL 4 · 48%");
  });

  it("clamps / coerces non-finite", () => {
    assert.equal(formatLvlBarLabel(-5), "LVL 0 · 0%");
    assert.equal(formatLvlBarLabel(150), "LVL 10 · 100%");
    assert.equal(formatLvlBarLabel(NaN), "LVL 0 · 0%");
  });
});

describe("packMeter", () => {
  it("2560 tokens are one cent, 512k is 200c", () => {
    assert.equal(TOKENS_PER_CENT, 2560);
    assert.equal(PACK_TOKENS, 512_000);
    assert.equal(512_000 / 200, 2560);
  });

  it("full top-up reads 200c · 0/512k", () => {
    const m = packMeter(0);
    assert.equal(m.label, "200c · 0/512k");
    assert.equal(m.centsLeft, 200);
    assert.equal(m.consumed, 0);
    assert.equal(m.fill, 0);
    assert.equal(m.warn, false);
    assert.equal(m.blocked, false);
  });

  it("148k consumed leaves 142c · 148k/512k", () => {
    const m = packMeter(148_000);
    assert.equal(m.label, "142c · 148k/512k");
    assert.equal(m.consumed, 148_000);
    assert.equal(m.centsLeft, 142);
  });

  it("80% used warns at 40c · 410k/512k", () => {
    const m = packMeter(409_600);
    assert.equal(m.label, "40c · 410k/512k");
    assert.equal(m.centsLeft, 40);
    assert.equal(m.warn, true);
    assert.equal(m.blocked, false);
  });

  it("512k consumed reads 0c · 512k/512k and blocks", () => {
    const m = packMeter(512_000);
    assert.equal(m.label, "0c · 512k/512k");
    assert.equal(m.centsLeft, 0);
    assert.equal(m.consumed, 512_000);
    assert.equal(m.warn, true);
    assert.equal(m.blocked, true);
  });

  it("usage past the pack stays at 0c · 512k/512k", () => {
    const m = packMeter(900_000);
    assert.equal(m.label, "0c · 512k/512k");
    assert.equal(m.centsLeft, 0);
    assert.equal(m.consumed, 512_000);
    assert.equal(m.blocked, true);
  });

  it("does not charge a balance that was never topped up", () => {
    assert.equal(packCharge({ source: "password", opened: true }, 26_000), 0);
    assert.equal(packCharge(null, 26_000), 0);
    assert.equal(packMeter(packCharge(null, 26_000)).label, "200c · 0/512k");
  });

  it("charges only after Aufladen", () => {
    const access = { source: "aufladen", opened: true, packTokens: 512_000 };
    assert.equal(packCharge(access, 26_000), 26_000);
    assert.equal(packCharge(access, 0), 0);
  });
});

describe("scrollMetrics", () => {
  it("no overflow → ratio 1", () => {
    assert.deepEqual(
      scrollMetrics({ scrollTop: 0, scrollHeight: 100, clientHeight: 100 }),
      { scrollRatio: 1, hasOverflow: false },
    );
  });

  it("mid scroll", () => {
    const m = scrollMetrics({
      scrollTop: 50,
      scrollHeight: 200,
      clientHeight: 100,
    });
    assert.equal(m.hasOverflow, true);
    assert.equal(m.scrollRatio, 0.5);
  });
});
