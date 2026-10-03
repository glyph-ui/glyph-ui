/**
 * ACP session/cancel helpers — Abbrechen must stop the turn.
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cancelSystemText,
  createSessionCancelGate,
  resolveCancelStopReason,
  shouldDropAssistantChunk,
} from "../../server/acpCancel.mjs";

describe("createSessionCancelGate", () => {
  it("cancel aborts the pending controller for that session", () => {
    const gate = createSessionCancelGate();
    const ac = gate.begin("sess-1");
    assert.equal(ac.signal.aborted, false);
    assert.equal(gate.cancel("sess-1"), true);
    assert.equal(ac.signal.aborted, true);
    assert.equal(gate.isCancelling("sess-1"), true);
  });

  it("cancel on unknown session returns false", () => {
    const gate = createSessionCancelGate();
    assert.equal(gate.cancel("missing"), false);
  });

  it("begin replaces previous controller and aborts it", () => {
    const gate = createSessionCancelGate();
    const first = gate.begin("s");
    const second = gate.begin("s");
    assert.equal(first.signal.aborted, true);
    assert.equal(second.signal.aborted, false);
    gate.cancel("s");
    assert.equal(second.signal.aborted, true);
  });

  it("end clears only the matching controller", () => {
    const gate = createSessionCancelGate();
    const ac = gate.begin("s");
    gate.end("s", ac);
    assert.equal(gate.cancel("s"), false);
  });
});

describe("resolveCancelStopReason", () => {
  it("forces cancelled when user was cancelling", () => {
    assert.equal(resolveCancelStopReason(true, "end_turn"), "cancelled");
    assert.equal(resolveCancelStopReason(true, "stop"), "cancelled");
    assert.equal(resolveCancelStopReason(true, "cancelled"), "cancelled");
  });

  it("leaves stopReason alone when not cancelling", () => {
    assert.equal(resolveCancelStopReason(false, "end_turn"), "end_turn");
    assert.equal(resolveCancelStopReason(false, "cancelled"), "cancelled");
  });
});

describe("cancelSystemText", () => {
  it("never claims work finished safely after Abbrechen", () => {
    const a = cancelSystemText("cancelled", true);
    const b = cancelSystemText("end_turn", true);
    const c = cancelSystemText("cancelled", false);
    assert.equal(a, "Antwort abgebrochen.");
    assert.equal(b, "Antwort abgebrochen.");
    assert.equal(c, "Antwort abgebrochen.");
    assert.equal(cancelSystemText("end_turn", false), null);
    assert.ok(!String(a).includes("sicher zu Ende"));
    assert.ok(!String(b).includes("sicher zu Ende"));
  });
});

describe("shouldDropAssistantChunk", () => {
  it("drops primary answer chunks while cancelling", () => {
    assert.equal(shouldDropAssistantChunk("Hello world", true), true);
    assert.equal(shouldDropAssistantChunk("Hello world", false), false);
  });

  it("keeps step/draft protocol chunks while cancelling", () => {
    assert.equal(shouldDropAssistantChunk("⏺STEP⏺SearchWeb", true), false);
    assert.equal(shouldDropAssistantChunk("⏹STEP⏹SearchWeb — erledigt", true), false);
    assert.equal(shouldDropAssistantChunk("⏺DRAFT⏺Zwischen", true), false);
    assert.equal(shouldDropAssistantChunk("⏺DRAFT+⏺mehr", true), false);
  });
});
