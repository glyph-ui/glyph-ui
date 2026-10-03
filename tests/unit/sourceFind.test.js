/**
 * Unit tests: Textsuche im Quellen-Fenster.
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findInPages, findMatchOffsets, snippetAround } from "../../client/src/utils/sourceFind.js";

describe("sourceFind", () => {
  it("findet alle Offsets case-insensitive", () => {
    const hits = findMatchOffsets("Grundbetreuung und grundbetreuung", "Grund");
    assert.equal(hits.length, 2);
    assert.equal(hits[0].start, 0);
    assert.equal(hits[1].start, "Grundbetreuung und ".length);
  });

  it("leere Query → keine Treffer", () => {
    assert.deepEqual(findMatchOffsets("abc", "  "), []);
  });

  it("Seitenindex mit Snippet", () => {
    const hits = findInPages(
      [
        { page: 1, text: "Anlage 2 Betreuungsgruppe" },
        { page: 3, text: "Die Grundbetreuung steht in Anlage 2." },
      ],
      "anlage 2",
    );
    assert.equal(hits.length, 2);
    assert.equal(hits[0].page, 1);
    assert.equal(hits[1].page, 3);
    assert.ok(hits[1].snippet.toLowerCase().includes("anlage 2"));
  });

  it("snippetAround setzt Ellipsen", () => {
    const s = snippetAround("abcdefghij", 4, 6, 2);
    assert.equal(s, "…cdefgh…");
  });
});
