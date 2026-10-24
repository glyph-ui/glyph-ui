/**
 * activityStrip.test.js — Unit-Tests für den Haiku-artigen Aktivitäts-Streifen
 * (client/src/utils/activityStrip.js).
 *
 * Copyright (c) 2026 Alexander Hubert · SPDX-License-Identifier: MIT
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  activityCounts,
  formatElapsed,
  friendlyActivityLine,
  latestActivity,
  latestActivityLine,
} from "../../client/src/utils/activityStrip.js";

test("latestActivity", async (t) => {
  await t.test("offene Stufe → running, abgeschlossene nicht", () => {
    const open = [
      { id: "a", start: "SearchWeb · suche im Internet", result: "" },
    ];
    assert.deepEqual(latestActivity(open, ""), {
      line: "SearchWeb · suche im Internet",
      running: true,
    });
    const done = [
      { id: "a", start: "SearchWeb · suche im Internet", result: "SearchWeb · 5 Treffer" },
    ];
    assert.deepEqual(latestActivity(done, ""), {
      line: "SearchWeb · 5 Treffer",
      running: false,
    });
  });

  await t.test("Banner und Fallback", () => {
    assert.deepEqual(latestActivity([], "Think · fertig"), {
      line: "Think · fertig",
      running: false,
    });
    assert.deepEqual(latestActivity([], "", "Agent arbeitet …"), {
      line: "Agent arbeitet …",
      running: true,
    });
  });
});

test("friendlyActivityLine", async (t) => {
  await t.test("laufende Stufe → Präsens-Statuszeile", () => {
    assert.equal(
      friendlyActivityLine("SearchWeb · suche im Internet (Exa, grob) — Web (Exa/TinyFish): q", true),
      "Websuche läuft …",
    );
    assert.equal(
      friendlyActivityLine("Think · Cloud-Denker denkt (claude-haiku-5-5)", true),
      "Antwort wird formuliert …",
    );
    assert.equal(
      friendlyActivityLine("SearchVault · hybrid", true),
      "Suche im Vault läuft …",
    );
  });

  await t.test("abgeschlossene Stufe → Ergebnis-Statuszeile mit Kurz-Detail", () => {
    assert.equal(
      friendlyActivityLine("SearchWeb · 5 Treffer (Exa/TinyFish)", false),
      "Web durchsucht · 5 Treffer",
    );
    assert.equal(
      friendlyActivityLine("Think · formuliert finale Antwort (Single-Call mit Belegpflicht)", false),
      "Antwort formuliert",
    );
    assert.equal(friendlyActivityLine("SearchVault · nichts gefunden", false), "Im Vault gesucht · nichts gefunden");
  });

  await t.test("unbekannte Verben und Leer-Eingaben bleiben unverändert", () => {
    assert.equal(friendlyActivityLine("Router · Router / openai/gpt-5", true), "Router · Router / openai/gpt-5");
    assert.equal(friendlyActivityLine("", true), "");
    assert.equal(friendlyActivityLine(undefined, false), "");
  });
});

test("latestActivityLine", async (t) => {
  await t.test("bevorzugt das Ergebnis der letzten Stufe (jüngstes Ereignis)", () => {
    const steps = [
      { id: "a", start: "SearchWeb · suche im Internet", result: "SearchWeb · 5 Treffer" },
      { id: "b", start: "Think · Cloud-Denker denkt", result: "Think · formuliert Antwort" },
    ];
    assert.equal(latestActivityLine(steps, ""), "Think · formuliert Antwort");
  });

  await t.test("offene Stufe ohne Ergebnis zeigt ihren Start", () => {
    const steps = [
      { id: "a", start: "SearchWeb · suche im Internet", result: "SearchWeb · 5 Treffer" },
      { id: "b", start: "Think · Cloud-Denker denkt", result: "" },
    ];
    assert.equal(latestActivityLine(steps, ""), "Think · Cloud-Denker denkt");
  });

  await t.test("nur-Ergebnis-Stufe und Mehrzeiler werden auf die erste Zeile reduziert", () => {
    const steps = [{ id: "a", start: "", result: "SearchVault · 3 Treffer\n(mehr Detail)" }];
    assert.equal(latestActivityLine(steps, ""), "SearchVault · 3 Treffer");
  });

  await t.test("ohne Live-Stufen zählt die letzte Banner-Zeile (Alt-Responses)", () => {
    const banner = "SearchWeb · suche im Internet\nThink · formuliert finale Antwort";
    assert.equal(latestActivityLine([], banner), "Think · formuliert finale Antwort");
    assert.equal(latestActivityLine(undefined, banner), "Think · formuliert finale Antwort");
  });

  await t.test("Fallback bei leerem Protokoll", () => {
    assert.equal(latestActivityLine([], ""), "Agent arbeitet …");
    assert.equal(latestActivityLine([], "", "Protokoll"), "Protokoll");
    assert.equal(latestActivityLine([{ start: "  ", result: "" }], ""), "Agent arbeitet …");
  });
});

test("activityCounts", async (t) => {
  await t.test("Schritte und Entwürfe deutsch und flektiert", () => {
    assert.equal(activityCounts(3, 0), "3 Schritte");
    assert.equal(activityCounts(1, 1), "1 Schritt · 1 Entwurf");
    assert.equal(activityCounts(2, 3), "2 Schritte · 3 Entwürfe");
  });

  await t.test("leere Zähler → leerer String", () => {
    assert.equal(activityCounts(0, 0), "");
  });
});

test("formatElapsed", async (t) => {
  await t.test("unter einer Minute in Sekunden", () => {
    assert.equal(formatElapsed(0), "0s");
    assert.equal(formatElapsed(12), "12s");
    assert.equal(formatElapsed(59), "59s");
  });

  await t.test("ab einer Minute m:ss", () => {
    assert.equal(formatElapsed(60), "1:00");
    assert.equal(formatElapsed(125), "2:05");
    assert.equal(formatElapsed(600), "10:00");
  });

  await t.test("unbekannte Laufzeit → leer", () => {
    assert.equal(formatElapsed(null), "");
    assert.equal(formatElapsed(undefined), "");
    assert.equal(formatElapsed(NaN), "");
    assert.equal(formatElapsed(-3), "");
  });
});
