/**
 * Suchtreffer-Aufteilung — Regressionstest gegen den DOM-Umbau, der beim
 * Schliessen des Quellen-Fensters die Seite weiss machte (2026-10-30).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { splitByQuery } from "../../client/src/utils/highlight.js";

describe("splitByQuery", () => {
  it("markiert alle Treffer und behält den Rest", () => {
    const parts = splitByQuery("Leiter und Tritte, Leiter prüfen", "Leiter");
    assert.equal(parts.filter((p) => p.hit).length, 2);
    assert.equal(
      parts.map((p) => p.text).join(""),
      "Leiter und Tritte, Leiter prüfen",
    );
  });

  it("ignoriert Gross-/Kleinschreibung im Query, nicht im Text", () => {
    const parts = splitByQuery("BETRIEBSANWEISUNG", "betriebsanweisung");
    assert.equal(parts.length, 1);
    assert.equal(parts[0].hit, true);
  });

  it("liefert bei leerer Suche den Text unveraendert", () => {
    assert.deepEqual(splitByQuery("Hallo", ""), [
      { text: "Hallo", hit: false },
    ]);
    assert.deepEqual(splitByQuery("Hallo", "   "), [
      { text: "Hallo", hit: false },
    ]);
  });

  it("zerlegt auch Zeichenketten ohne Treffer", () => {
    assert.deepEqual(splitByQuery("abc", "xyz"), [
      { text: "abc", hit: false },
    ]);
  });
});
