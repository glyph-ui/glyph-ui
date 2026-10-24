/**
 * Unit tests: webScope — serverseitige Freigabe für die Web-Fläche.
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WEB_SCOPE,
  filterHits,
  filterVaults,
  isPathAllowed,
  loadWebScope,
  redact,
} from "../../server/webScope.mjs";

const SCOPE = {
  vaults: ["ASI, BS. UWS, QM, EM", "HSEQ Sync"],
  denyPaths: ["00 Arbeitsfluss/Eingang", "00 Arbeitsfluss/Fertig", "Vorlagen/Jobs"],
  redact: true,
};

describe("webScope: isPathAllowed", () => {
  it("lässt freigegebene Sammlungen und Ordner zu", () => {
    assert.equal(isPathAllowed("/HSEQ Sync/Themen/Gefahrstoffe.md", SCOPE), true);
    assert.equal(isPathAllowed("ASI, BS. UWS, QM, EM/Vorlagen/Audit/x.md", SCOPE), true);
  });

  it("sperrt andere Sammlungen (Privat, memory-wiki, Pfad-Querweg)", () => {
    assert.equal(isPathAllowed("/Privat/Tagebuch.md", SCOPE), false);
    assert.equal(isPathAllowed("/memory-wiki/concepts/x.md", SCOPE), false);
    assert.equal(isPathAllowed("", SCOPE), false);
    assert.equal(isPathAllowed("/../../etc/passwd", SCOPE), false);
    // `..` innerhalb eines erlaubten Vaults darf nicht in einen gesperrten
    // Bereich führen (Präfix-Vergleich sah vorher nur den Vault-Namen).
    assert.equal(
      isPathAllowed("HSEQ Sync/Themen/../../Privat/Tagebuch.md", SCOPE),
      false,
    );
    assert.equal(
      isPathAllowed("HSEQ Sync/00 Arbeitsfluss/Eingang/../Fertig/x.md", SCOPE),
      false,
    );
  });

  it("sperrt die Betriebs-/Mandantenordner auch in erlaubten Sammlungen", () => {
    assert.equal(
      isPathAllowed("/HSEQ Sync/00 Arbeitsfluss/Eingang/2026-09-16 Notiz.md", SCOPE),
      false,
    );
    assert.equal(
      isPathAllowed("/HSEQ Sync/00 Arbeitsfluss/Fertig/2026-09-22 Auditbericht - Musterstadt.md", SCOPE),
      false,
    );
    assert.equal(isPathAllowed("/HSEQ Sync/Vorlagen/Jobs/PROMPT-Merken.md", SCOPE), false);
  });

  it("Default-Anfangsstand ist definiert", () => {
    assert.ok(DEFAULT_WEB_SCOPE.vaults.length > 0);
    assert.equal(DEFAULT_WEB_SCOPE.redact, true);
  });

  it("loadWebScope fällt ohne Datei auf Defaults zurück", () => {
    const s = loadWebScope("/tmp/definitiv-nicht-vorhanden-web-scope");
    assert.deepEqual(s.vaults, [...DEFAULT_WEB_SCOPE.vaults]);
  });
});

describe("webScope: redact", () => {
  it("maskiert Anrede-Namen, Mails und Telefonnummern", () => {
    const s = redact("Berater: Hr. A. Hubert · Firma SCHLIETER IFAS · a.hubert@example.de · +49 541 1234567");
    assert.ok(!s.includes("Hubert"));
    assert.ok(!s.includes("example.de"));
    assert.ok(!s.includes("541 1234567"));
  });

  it("lässt Datumsangaben und Fachtext stehen", () => {
    const s = redact("Bericht vom 2026-09-22 über PSA und Gefahrstoffe");
    assert.ok(s.includes("2026-09-22"));
    assert.ok(s.includes("Gefahrstoffe"));
  });
});

describe("webScope: filterHits/filterVaults", () => {
  const hits = [
    { kind: "web", path: "https://dguv.de", title: "DGUV" },
    { kind: "file", path: "/HSEQ Sync/Themen/Gefahrstoffe.md", excerpt: "Text von Hr. Meier" },
    { kind: "file", path: "/HSEQ Sync/00 Arbeitsfluss/Eingang/2026-09-16 Notiz.md", excerpt: "Namen" },
    { kind: "folder", path: "/Privat", title: "Privat" },
  ];

  it("behält Web-Treffer und freigegebene Pfade, sperrt den Rest", () => {
    const out = filterHits(hits, SCOPE);
    assert.equal(out.length, 2);
    assert.equal(out[0].kind, "web");
    assert.ok(out[1].path.includes("Themen"));
  });

  it("maskiert Auszüge", () => {
    const out = filterHits(hits, SCOPE);
    assert.ok(!out[1].excerpt.includes("Meier"));
  });

  it("filtert die Vault-Liste und entfernt Pfade", () => {
    const out = filterVaults(
      {
        vaults: [
          { name: "HSEQ Sync", path: "/Users/x/ObsidianVaults/HSEQ Sync" },
          { name: "Privat", path: "/Users/x/ObsidianVaults/Privat" },
        ],
      },
      SCOPE,
    );
    assert.equal(out.vaults.length, 1);
    assert.equal(out.vaults[0].name, "HSEQ Sync");
    assert.equal(out.vaults[0].path, undefined);
  });
});
