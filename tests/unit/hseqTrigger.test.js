/**
 * HSEQ-Sync-Auslöser: Pfad-Auflösung, Trigger-Zeile, Status-Roundtrip.
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HSEQ_STATUS_FILE_NAME,
  HSEQ_TRIGGER_FILE_NAME,
  formatHseqStatus,
  formatHseqTrigger,
  hseqStatusFile,
  hseqTriggerFile,
  hseqTriggerFresh,
  newHseqToken,
  parseHseqStatus,
  parseHseqTrigger,
} from "../../server/hseqTrigger.mjs";

const HOME = "/Users/beispiel";

describe("hseqTrigger: Pfade", () => {
  it("bleibt ohne Konfiguration aus", () => {
    assert.equal(hseqTriggerFile({}, HOME), "");
    assert.equal(hseqStatusFile(""), "");
  });

  it("baut den Standardpfad aus GLYPH_HSEQ_VAULT", () => {
    const file = hseqTriggerFile(
      { GLYPH_HSEQ_VAULT: "/Vaults/HSEQ Sync" },
      HOME,
    );
    assert.equal(file, `/Vaults/HSEQ Sync/00 Arbeitsfluss/${HSEQ_TRIGGER_FILE_NAME}`);
    assert.equal(
      hseqStatusFile(file),
      `/Vaults/HSEQ Sync/00 Arbeitsfluss/${HSEQ_STATUS_FILE_NAME}`,
    );
  });

  it("expandiert ~ und lässt expliziten Dateipfad gewinnen", () => {
    assert.equal(
      hseqTriggerFile({ GLYPH_HSEQ_VAULT: "~/Vaults/HSEQ Sync" }, HOME),
      `${HOME}/Vaults/HSEQ Sync/00 Arbeitsfluss/${HSEQ_TRIGGER_FILE_NAME}`,
    );
    assert.equal(
      hseqTriggerFile(
        {
          GLYPH_HSEQ_VAULT: "/Vaults/HSEQ Sync",
          GLYPH_HSEQ_TRIGGER_FILE: "/tmp/eigen.md",
        },
        HOME,
      ),
      "/tmp/eigen.md",
    );
  });
});

describe("hseqTrigger: Trigger-Zeile", () => {
  it("liest die letzte gültige RUN-Zeile", () => {
    const text = [
      "---",
      "tags: [hseq]",
      "---",
      "# HSEQ Trigger",
      "",
      "RUN td-eingang 2026-09-17T19:22:00.000Z-abc123",
      "",
      "RUN td-handover 2026-09-17T19:25:00.000Z-def456",
    ].join("\n");
    assert.deepEqual(parseHseqTrigger(text), {
      job: "td-handover",
      token: "2026-09-17T19:25:00.000Z-def456",
    });
  });

  it("ignoriert Prosa, Müll und getarnte Zeilen", () => {
    for (const text of [
      "",
      "# nur Text",
      "run td-eingang token",
      "RUN td-eingang",
      "RUN td-eingang;rm -rf / token",
      "XRUN td-eingang 2026-01-01T00:00:00Z",
    ]) {
      assert.equal(parseHseqTrigger(text), null, `erwartet null für ${text}`);
    }
  });

  it("ist nur für einen neuen Token frisch", () => {
    const trigger = { job: "td-eingang", token: "t1" };
    assert.equal(hseqTriggerFresh(trigger, ""), true);
    assert.equal(hseqTriggerFresh(trigger, "t1"), false);
    assert.equal(hseqTriggerFresh(trigger, "t0"), true);
    assert.equal(hseqTriggerFresh(null, "t1"), false);
    assert.equal(hseqTriggerFresh({ job: "", token: "t1" }, ""), false);
  });

  it("formatiert einen erneut lesbaren Trigger", () => {
    const text = formatHseqTrigger({
      job: "td-eingang",
      token: "tok-1",
      created: "2026-09-17T19:22:00.000Z",
    });
    assert.deepEqual(parseHseqTrigger(text), { job: "td-eingang", token: "tok-1" });
  });

  it("erzeugt eindeutige Token", () => {
    const a = newHseqToken(1_700_000_000_000, () => 0.5);
    const b = newHseqToken(1_700_000_000_000, () => 0.25);
    assert.notEqual(a, b);
    assert.match(a, /^2023-11-14T22:13:20\.000Z-[0-9a-f]{6}$/);
  });
});

describe("hseqTrigger: Status-Notiz", () => {
  it("schreibt und liest OK", () => {
    const text = formatHseqStatus({
      ok: true,
      job: "td-eingang",
      at: "2026-09-17T19:23:00.000Z",
      detail: "HSEQ: keine Änderungen",
    });
    assert.deepEqual(parseHseqStatus(text), {
      ok: true,
      job: "td-eingang",
      at: "2026-09-17T19:23:00.000Z",
      detail: "HSEQ: keine Änderungen",
    });
  });

  it("schreibt und liest FEHLER ohne Detail", () => {
    const text = formatHseqStatus({
      ok: false,
      job: "td-eingang",
      at: "2026-09-17T19:23:00.000Z",
    });
    assert.deepEqual(parseHseqStatus(text), {
      ok: false,
      job: "td-eingang",
      at: "2026-09-17T19:23:00.000Z",
      detail: "",
    });
  });

  it("bleibt mit leerem oder fremdem Text stabil", () => {
    assert.equal(parseHseqStatus(""), null);
    assert.equal(parseHseqStatus("# nichts"), null);
  });
});
