/**
 * HSEQ-Knopf: Job-Allow-List, CORS für Obsidian, Drossel, Fehlversuchs-Bremse.
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HSEQ_AUTH_MAX_FAILURES,
  HSEQ_AUTH_WINDOW_MS,
  HSEQ_BUTTON_DEFAULT_JOB,
  HSEQ_BUTTON_JOBS,
  HSEQ_BUTTON_MIN_INTERVAL_MS,
  hseqAuthState,
  hseqCorsHeaders,
  hseqCorsOrigin,
  hseqJobAllowed,
  hseqThrottled,
} from "../../server/hseqButton.mjs";

describe("hseqButton: Jobs", () => {
  it("erlaubt genau die HSEQ-Jobs", () => {
    for (const job of HSEQ_BUTTON_JOBS) {
      assert.equal(hseqJobAllowed(job), true);
    }
    assert.equal(hseqJobAllowed(HSEQ_BUTTON_DEFAULT_JOB), true);
  });

  it("blockt fremde und getarnte Job-Namen", () => {
    for (const job of [
      "",
      " ",
      "td-cleanup",
      "td-eingang/../..",
      "td-eingang;rm -rf /",
      "TD-EINGANG",
      null,
      undefined,
      { toString: () => "td-eingang" },
    ]) {
      assert.equal(hseqJobAllowed(job), false, `erwartet false für ${String(job)}`);
    }
  });
});

describe("hseqButton: CORS", () => {
  it("spiegelt Obsidians Origin", () => {
    assert.equal(hseqCorsOrigin("app://obsidian.md"), "app://obsidian.md");
    assert.equal(hseqCorsOrigin("null"), "null");
  });

  it("lehnt fremde Origins ab", () => {
    for (const origin of [
      "",
      "https://glyph-ui.com",
      "https://boese.example",
      "app://obsidian.md.boese.example",
      "file://",
    ]) {
      assert.equal(hseqCorsOrigin(origin), "", `erwartet leer für ${origin}`);
    }
  });

  it("liefert Header nur für erlaubte Origins", () => {
    const ok = hseqCorsHeaders("app://obsidian.md");
    assert.equal(ok["Access-Control-Allow-Origin"], "app://obsidian.md");
    assert.match(ok["Access-Control-Allow-Headers"], /X-Glyph-Password/i);
    assert.match(ok["Access-Control-Allow-Methods"], /POST/);
    assert.equal(ok.Vary, "Origin");
    assert.deepEqual(hseqCorsHeaders("https://boese.example"), {});
  });
});

describe("hseqButton: Drossel", () => {
  it("lässt den ersten Lauf durch", () => {
    assert.deepEqual(hseqThrottled(0, 1_000_000), { blocked: false, waitMs: 0 });
  });

  it("sperrt den zweiten Lauf im Fenster", () => {
    const start = 1_000_000;
    const gate = hseqThrottled(start, start + 5_000);
    assert.equal(gate.blocked, true);
    assert.equal(gate.waitMs, HSEQ_BUTTON_MIN_INTERVAL_MS - 5_000);
  });

  it("gibt nach dem Fenster wieder frei", () => {
    const start = 1_000_000;
    assert.equal(
      hseqThrottled(start, start + HSEQ_BUTTON_MIN_INTERVAL_MS).blocked,
      false,
    );
  });
});

describe("hseqButton: Fehlversuche", () => {
  it("blockt erst ab der Kappe", () => {
    const now = 5_000_000;
    const few = Array.from({ length: HSEQ_AUTH_MAX_FAILURES - 1 }, () => now);
    assert.equal(hseqAuthState(few, now).blocked, false);
    const many = Array.from({ length: HSEQ_AUTH_MAX_FAILURES }, () => now);
    assert.equal(hseqAuthState(many, now).blocked, true);
  });

  it("vergisst alte Versuche", () => {
    const now = 9_000_000;
    const old = Array.from({ length: HSEQ_AUTH_MAX_FAILURES }, () => 0);
    const state = hseqAuthState(old, now);
    assert.equal(state.blocked, false);
    assert.deepEqual(state.recent, []);
  });

  it("bleibt mit Müll-Eingabe stabil", () => {
    assert.deepEqual(hseqAuthState(null, 1000).recent, []);
    assert.deepEqual(hseqAuthState(["x", NaN], 1000).recent, []);
    assert.equal(hseqAuthState(undefined, 1000).blocked, false);
    assert.equal(HSEQ_AUTH_WINDOW_MS, 600000);
  });
});
