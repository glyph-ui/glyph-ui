/**
 * PII-Maskierung: Adressen, Firmennamen, E-Mails erkennen und schwärzen.
 * Datenschutz 2026-10-31: Schutz vor versehentlicher Offenlegung in
 * Screenshots, Chat-Verlauf und Cloud-Kontext.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  maskPiiText,
  findPiiRegions,
  containsPii,
} from "../../client/src/utils/piiMask.js";

describe("maskPiiText", () => {
  it("maskiert deutsche Adressen (Straße + Hausnummer)", () => {
    const out = maskPiiText("Firma: Hans-Duncker-Straße 17, 21035 Hamburg");
    assert.ok(!out.includes("Hans-Duncker-Straße"), "Straße sollte maskiert sein");
    assert.ok(!out.includes("21035"), "PLZ sollte maskiert sein");
    assert.ok(out.includes("████████"), "Maskierung sollte sichtbar sein");
  });

  it("maskiert Firmennamen mit Rechtsform", () => {
    const out = maskPiiText("IBAU-Hamburg Ingenieurgesellschaft Industriebau mbH");
    assert.ok(!out.includes("IBAU-Hamburg"), "Firmenname sollte maskiert sein");
  });

  it("maskiert E-Mail-Adressen", () => {
    const out = maskPiiText("Kontakt: max.mustermann@example.com");
    assert.ok(!out.includes("max.mustermann"), "E-Mail sollte maskiert sein");
  });

  it("maskiert Telefonnummern", () => {
    const out = maskPiiText("Tel: 040 12345678");
    assert.ok(!out.includes("12345678"), "Telefonnummer sollte maskiert sein");
  });

  it("lässt normalen Text unverändert", () => {
    const text = "Leitern und Tritte nur bei fehlender sicherer Alternative benutzen.";
    assert.equal(maskPiiText(text), text);
  });

  it("maskiert mehrere PII-Stellen gleichzeitig", () => {
    const out = maskPiiText(
      "IBAU-Hamburg GmbH, Hans-Duncker-Straße 17, 21035 Hamburg, Tel 040 12345678",
    );
    assert.ok(!out.includes("IBAU-Hamburg"));
    assert.ok(!out.includes("Hans-Duncker"));
    assert.ok(!out.includes("21035"));
    assert.ok(!out.includes("12345678"));
  });
});

describe("findPiiRegions", () => {
  it("findet PII-Regionen in pdf.js-Textitems", () => {
    const items = [
      { str: "Normale Zeile", transform: [1, 0, 0, 1, 100, 200], width: 80, height: 12 },
      { str: "Hans-Duncker-Straße 17", transform: [1, 0, 0, 1, 100, 180], width: 120, height: 12 },
    ];
    const regions = findPiiRegions(items);
    assert.equal(regions.length, 1);
    assert.equal(regions[0].x, 100);
    assert.equal(regions[0].y, 180);
  });

  it("ignoriert Textitems ohne PII", () => {
    const items = [
      { str: "Anwendungsbereich", transform: [1, 0, 0, 1, 0, 0], width: 100, height: 12 },
    ];
    assert.equal(findPiiRegions(items).length, 0);
  });

  it("geht mit leerer Liste um", () => {
    assert.deepEqual(findPiiRegions([]), []);
    assert.deepEqual(findPiiRegions(null), []);
  });
});

describe("containsPii", () => {
  it("erkennt PII im Text", () => {
    assert.equal(containsPii("IBAU-Hamburg GmbH"), true);
    assert.equal(containsPii("Hans-Duncker-Straße 17"), true);
    assert.equal(containsPii("test@example.com"), true);
  });

  it("erkennt Text ohne PII", () => {
    assert.equal(containsPii("Leitern und Tritte benutzen"), false);
    assert.equal(containsPii(""), false);
    assert.equal(containsPii(null), false);
  });
});
