/**
 * stepBanner.test.js — Unit-Tests für die Grok-artige Stufen-Anzeige (stepBanner.mjs).
 *
 * Copyright (c) 2026 Alexander Hubert · SPDX-License-Identifier: MIT
 */
import test from "node:test";
import assert from "node:assert/strict";

import { buildStepBanner, formatThinkStep } from "../../server/stepBanner.mjs";

test("buildStepBanner", async (t) => {
  await t.test("leerer Banner ohne Schritte", () => {
    assert.equal(buildStepBanner({}), "");
    assert.equal(buildStepBanner({ trace: {} }), "");
    assert.equal(buildStepBanner({ trace: { steps: [] } }), "");
    assert.equal(buildStepBanner(null), "");
    assert.equal(buildStepBanner(undefined), "");
  });

  await t.test("Routine-Stufen haben deutsche Labels (Pflicht: beide Mappings)", () => {
    const banner = buildStepBanner({
      answer: "ok",
      trace: {
        steps: [
          { step: "RoutineOverview", status: "success", detail: "3 Jobs" },
          { step: "RoutineRun", status: "success", detail: "daily" },
        ],
      },
    });
    assert.match(banner, /Routine — sieht die Lage/);
    assert.match(banner, /Routine — löst ein To-do jetzt aus/);
    assert.doesNotMatch(banner, /Tool · RoutineRun/);
  });

  await t.test("VaultFind leer (nichts gefunden) + WebSearch + Router-Zeile", () => {
    const data = {
      answer: "Antworttext",
      trace: {
        provider: "openrouter",
        model: "openai/gpt-5.6-luna",
        fallback_used: false,
        steps: [
          { step: "VaultFind", status: "empty", detail: "0 Treffer (hybrid)" },
          { step: "WebSearch", status: "success", detail: "grob/exa · 3 Treffer" },
          { step: "LLM", status: "success", detail: "openrouter/openai/gpt-5.6-luna" },
          { step: "answer", status: "success", detail: "123 Zeichen" },
        ],
      },
    };
    const banner = buildStepBanner(data);
    // Tool-Stufen enthalten; LLM/answer nicht als Tool-Zeile.
    // hybrid → Arbeits-Vault (nicht Obsidian-/HSEQ-Phrase)
    assert.match(banner, /Vault — suche im Arbeits-Vault/);
    assert.doesNotMatch(banner, /Obsidian-Vault/);
    assert.match(banner, /nichts gefunden/);
    assert.match(banner, /SearchWeb.*suche im Internet/);
    assert.doesNotMatch(banner, /Tool · LLM/);
    assert.doesNotMatch(banner, /Tool · answer/);
    // Router-Zeile mit Modell.
    assert.match(banner, /Router · Router \/ openai\/gpt-5\.6-luna/);
    // Endet mit Sentinel (für UI-Split), KEIN Querstrich mehr.
    assert.ok(banner.includes("<!-- glyph-steps-end -->"));
    assert.ok(banner.endsWith("\n\n"));
    assert.doesNotMatch(banner, /─/);
  });


  await t.test("VaultFind memory-wiki → Wiki, kein Obsidian-Vault", () => {
    const banner = buildStepBanner({
      trace: {
        steps: [{ step: "VaultFind", status: "success", detail: "memory-wiki" }],
        provider: "openrouter",
        model: "m",
      },
    });
    assert.match(banner, /Wiki — suche im Wiki/);
    assert.match(banner, /memory-wiki/);
    assert.doesNotMatch(banner, /Obsidian-Vault/);
    assert.doesNotMatch(banner, /Arbeitssicherheit|HSEQ/);
  });

  await t.test("VaultFind Wiki-Detail → Wiki-Wording", () => {
    const banner = buildStepBanner({
      trace: {
        steps: [{ step: "VaultFind", status: "success", detail: "3 Treffer (Wiki)" }],
        provider: "openrouter",
        model: "m",
      },
    });
    assert.match(banner, /Wiki — suche im Wiki — 3 Treffer \(Wiki\)/);
    assert.doesNotMatch(banner, /Obsidian-Vault/);
  });

  await t.test("VaultFind ohne Detail → neutrales suche Notizen", () => {
    const banner = buildStepBanner({
      trace: {
        steps: [{ step: "VaultFind", status: "success", detail: "" }],
        provider: "openrouter",
        model: "m",
      },
    });
    assert.match(banner, /SearchVault — suche Notizen/);
    assert.doesNotMatch(banner, /Obsidian-Vault/);
  });

  await t.test("Fehler-Status wird als fehlgeschlagen übersetzt", () => {
    const banner = buildStepBanner({
      trace: {
        steps: [{ step: "ExtractUrl", status: "error", detail: "timeout" }],
        provider: "openrouter",
        model: "m",
      },
    });
    assert.match(banner, /Fetch — rufe konkrete URL ab.*fehlgeschlagen/);
  });

  await t.test("unbekannter Schritt roh übernommen", () => {
    const banner = buildStepBanner({
      trace: {
        steps: [{ step: "CustomTool", status: "success", detail: "ok" }],
        provider: "p",
        model: "m",
      },
    });
    assert.match(banner, /CustomTool.*ok/);
  });

  await t.test("Detail-Ausgabe bei Erfolg übernommen", () => {
    const banner = buildStepBanner({
      trace: {
        steps: [{ step: "WebSearch", status: "success", detail: "grob/exa · 5 Treffer" }],
        provider: "openrouter",
        model: "m",
      },
    });
    assert.match(banner, /grob\/exa · 5 Treffer/);
  });

  await t.test("Suchbrücke steht als Query-Zeile vor den Suchen", () => {
    const banner = buildStepBanner({
      trace: {
        provider: "direct",
        model: "claude-haiku-5-5",
        steps: [
          { step: "SearchBridge", status: "success",
            detail: "„Ersatzstoffprüfung Gefahrstoffe Frist“" },
          { step: "WebSearch", status: "success", detail: "Exa+TinyFish · 5 Treffer" },
          { step: "WebSearch", status: "success", detail: "Exa+TinyFish · 3 Treffer" },
        ],
      },
    });
    assert.match(banner, /Tool · Query — formuliert Suchbegriffe aus dem Verlauf/);
    assert.match(banner, /Ersatzstoffprüfung Gefahrstoffe Frist/);
    // Brücke zuerst, dann die beiden Suchläufe (Think → Search → Search).
    assert.ok(banner.indexOf("Tool · Query") < banner.indexOf("Tool · SearchWeb"));
    assert.equal((banner.match(/Tool · SearchWeb/g) || []).length, 2);
  });
});

test("formatThinkStep", async (t) => {
  await t.test("Code mit Live-Detail, kein DeepSeek-Hardcode", () => {
    const line = formatThinkStep("^_Code denkt (Gemini 3.7 flash)", { isCode: true });
    assert.equal(line, "Think · ^_Code denkt (Gemini 3.7 flash)");
    assert.doesNotMatch(line, /DeepSeek CODE/);
  });

  await t.test("ohne Detail: Profilname, nicht Provider-Marke", () => {
    assert.equal(formatThinkStep("", { isCode: true }), "Think · ^_Code");
    assert.equal(formatThinkStep(null, { isCode: false }), "Think · Cloud-Denker");
  });
});
