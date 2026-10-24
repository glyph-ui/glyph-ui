/**
 * Unit tests: Spenden-Konfiguration (fest im Code, kein Env).
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DONATE_LABEL,
  DONATE_TOOLTIP,
  DONATE_URL,
} from "../../client/src/utils/donate.js";

describe("Spenden-Konfiguration", () => {
  it("DONATE_URL ist die Ko-fi-Seite über https", () => {
    assert.equal(DONATE_URL, "https://ko-fi.com/glyphui");
  });

  it("ohne Tracking-Parameter", () => {
    assert.ok(!DONATE_URL.includes("utm_"));
    assert.ok(!DONATE_URL.includes("?"));
  });

  it("Label und Tooltip sind gesetzt (Tooltip länger als Label)", () => {
    assert.ok(DONATE_LABEL.length > 0);
    assert.ok(DONATE_TOOLTIP.length > DONATE_LABEL.length);
  });
});
