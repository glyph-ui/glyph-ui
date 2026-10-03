/**
 * Unit tests: sourceLinks — Quellen-Chips und Quelldatei-Fenster.
 * Prüft Normalisierung der Trace-Quellen (files/items), Anzeige-URLs und den
 * obsidian://-Link (Vault-Präfix muss abgetrennt werden).
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSourceList,
  buildWebList,
  classifyLink,
  linkifyAnswer,
  linkifyVaultPaths,
  looksLikeVaultFile,
  obsidianUrl,
  setKnownVaults,
  shortLinkLabel,
  siteLabel,
  sourceFileUrl,
  sourceKind,
  sourceRelPath,
  sourceTitle,
  sourceVault,
} from "../../client/src/utils/sourceLinks.js";

const PDF = {
  path: "/ASI, BS. UWS, QM, EM/Umweltmanagement/Lagerung/Scheel_Sicherheitsschränke.pdf",
  title: "Scheel_Sicherheitsschränke.pdf",
  kind: "pdf",
  vault: "ASI, BS. UWS, QM, EM",
  full_text: true,
};

describe("sourceLinks", () => {
  it("kind aus Feld oder Endung", () => {
    assert.equal(sourceKind(PDF), "pdf");
    assert.equal(sourceKind({ path: "/V/notiz.md" }), "md");
    assert.equal(sourceKind({ path: "/V/scan.PDF" }), "pdf");
    assert.equal(sourceKind({ path: "/V/x", kind: "md" }), "md");
  });

  it("linkifiziert blanke Web-Domains (ohne Pfad) — Meldung Schwarmsuche", () => {
    const out = linkifyAnswer("Quelle: (WEB berliner-feuerwehr.de)");
    assert.ok(out.includes("]("), "Domain soll zum Link werden");
    assert.ok(/berliner-feuerwehr\.de/i.test(out));
  });

  it("hält Dateinamen von der Domain-Erkennung frei", () => {
    const out = linkifyAnswer("Siehe Verarbeitungslog.md und Bericht.pdf");
    assert.ok(!out.includes("]("), "Dateinamen dürfen keine Links werden");
  });

  it("räumt Zitier-Ballast weg (Klammern, Semikolon, WEB-Wort)", () => {
    const out = linkifyAnswer(
      "( WEB https://verbraucherzentrale.de ; WEB https://utopia.de )",
    );
    assert.ok(!out.includes("( ") && !out.includes(" )"), "Zitat-Klammern sollen weg");
    assert.ok(!out.includes(";"), "Semikolon soll weg");
    assert.ok(!/\bWEB\b/.test(out), "das WEB-Wort soll weg");
    assert.ok(out.includes(" · "), "Trenner bleibt");
  });

  it("lässt normale Klammerzusätze stehen", () => {
    const out = linkifyAnswer("Siehe (Kapitel 7) dazu — Werte (ca. 40 %) beachten");
    assert.ok(out.includes("(Kapitel 7)"));
    assert.ok(out.includes("(ca. 40 %)"));
  });

  it("title bevorzugt Feld, sonst Dateiname", () => {
    assert.equal(sourceTitle(PDF), "Scheel_Sicherheitsschränke.pdf");
    assert.equal(sourceTitle({ path: "/V/Ordner/notiz.md" }), "notiz.md");
  });

  it("vault und rel-Pfad", () => {
    assert.equal(sourceVault(PDF), "ASI, BS. UWS, QM, EM");
    assert.equal(sourceRelPath(PDF), "Umweltmanagement/Lagerung/Scheel_Sicherheitsschränke.pdf");
    assert.equal(sourceVault({ path: "/HSEQ Sync/Themen/PSA.md" }), "HSEQ Sync");
    assert.equal(sourceRelPath({ path: "/HSEQ Sync/Themen/PSA.md" }), "Themen/PSA.md");
  });

  it("buildSourceList: strukturierte files zuerst", () => {
    const list = buildSourceList({ files: [PDF], items: ["/andere.md"] });
    assert.equal(list.length, 1);
    assert.equal(list[0].kind, "pdf");
    assert.equal(list[0].title, "Scheel_Sicherheitsschränke.pdf");
  });

  it("buildSourceList: Fallback auf items (alte Antworten)", () => {
    const list = buildSourceList({ items: ["/HSEQ Sync/Themen/PSA.md", "/V/a.pdf"] });
    assert.equal(list.length, 2);
    assert.equal(list[0].title, "PSA.md");
    assert.equal(list[0].kind, "md");
    assert.equal(list[1].kind, "pdf");
  });

  it("buildSourceList: leer und begrenzt", () => {
    assert.deepEqual(buildSourceList(null), []);
    assert.deepEqual(buildSourceList({ items: [] }), []);
    const many = { items: Array.from({ length: 20 }, (_, i) => `/V/f${i}.md`) };
    assert.equal(buildSourceList(many).length, 6);
    assert.equal(buildSourceList(many, 2).length, 2);
  });

  it("sourceFileUrl kodiert den Pfad", () => {
    const u = sourceFileUrl(PDF.path);
    assert.ok(u.startsWith("/api/vault/file?path="));
    assert.ok(!u.includes(" "), u);
    assert.ok(u.includes("%2C"), u); // Komma kodiert
  });

  it("obsidianUrl trennt das Vault-Präfix ab", () => {
    const u = obsidianUrl(PDF);
    assert.ok(u.startsWith("obsidian://open?vault=ASI%2C%20BS.%20UWS%2C%20QM%2C%20EM&file="), u);
    assert.ok(u.includes("Scheel_Sicherheitsschr%C3%A4nke.pdf"), u);
    assert.ok(!u.includes("vault=ASI%2C%20BS.%20UWS%2C%20QM%2C%20EM&file=ASI"), u);
  });

  it("obsidianUrl leer ohne Vault/Pfad", () => {
    assert.equal(obsidianUrl(null), "");
    assert.equal(obsidianUrl({ path: "" }), "");
    // Ohne Vault-Präfix ist kein verlässlicher Vault ableitbar → kein Link.
    assert.equal(obsidianUrl({ path: "/nurdatei.md", vault: "" }), "");
    // Mit explizitem Vault geht es auch ohne Präfix im Pfad.
    assert.equal(
      obsidianUrl({ path: "/nurdatei.md", vault: "Mein Vault" }),
      "obsidian://open?vault=Mein%20Vault&file=nurdatei.md",
    );
  });
});

describe("linkifyVaultPaths", () => {
  it("verlinkt Pfade mit Leerzeichen im Vault-Namen vollständig", () => {
    setKnownVaults(["ASI, BS. UWS, QM, EM", "HSEQ Sync"]);
    const out = linkifyVaultPaths(
      "Belegt in ASI, BS. UWS, QM, EM/Gesetzte und Verordnungen/DGUV_V_2.pdf hier.",
    );
    assert.ok(
      out.includes(
        "[DGUV_V_2.pdf](/api/vault/file?path=",
      ),
      out,
    );
    const href = out.match(/\]\((\/api\/vault\/file\?path=[^)]+)\)/)[1];
    assert.equal(
      classifyLink(href, "http://127.0.0.1:3847").path,
      "ASI, BS. UWS, QM, EM/Gesetzte und Verordnungen/DGUV_V_2.pdf",
    );
  });

  it("verlinkt mit führendem Slash und lässt URLs in Ruhe", () => {
    setKnownVaults(["HSEQ Sync"]);
    const out = linkifyVaultPaths(
      "Siehe /HSEQ Sync/Themen/PSA.md und https://example.com/a.pdf und foo/bar.md",
    );
    assert.ok(out.includes("[PSA.md](/api/vault/file?path="), out);
    assert.ok(out.includes("https://example.com/a.pdf"), out);
    assert.ok(!out.includes("(vaultopen:foo"), out);
  });

  it("verlinkt nicht ohne bekannte Vault-Namen (kein falscher Pfad)", () => {
    setKnownVaults([]);
    const text = "In ASI, BS. UWS, QM, EM/Umweltmanagement/AVV.pdf steht es.";
    assert.equal(linkifyVaultPaths(text), text);
  });

  it("lässt Code-Blöcke unangetastet", () => {
    setKnownVaults(["HSEQ Sync"]);
    const out = linkifyVaultPaths("```\n/HSEQ Sync/Themen/PSA.md\n```");
    assert.equal(out, "```\n/HSEQ Sync/Themen/PSA.md\n```");
  });
});

describe("linkifyAnswer", () => {
  it("macht URLs in Backticks klickbar, lässt gekürzte (…) in Ruhe", () => {
    const out = linkifyAnswer(
      "A: `vorschriften.bgn-branchenwissen.de/daten/dguv/2/anl2.htm` · B: `bghm.de/…/anlage-2`",
    );
    assert.ok(out.includes("](https://vorschriften.bgn-branchenwissen.de/daten/dguv/2/anl2.htm)"), out);
    // Sichtbar nur die Domain — der Pfad steckt im Link-Ziel, nicht im Text.
    assert.ok(out.includes("[vorschriften.bgn-branchenwissen.de](https://"), out);
    assert.ok(!out.includes("anl2.htm]"), out);
    assert.ok(out.includes("`bghm.de/…/anlage-2`"), out);
  });

  it("macht nackte Domains und http-URLs klickbar", () => {
    const out = linkifyAnswer("Siehe bghm.de/abc.html und https://example.com/x.pdf");
    assert.ok(out.includes("[bghm.de](https://bghm.de/abc.html)"), out);
    assert.ok(out.includes("[example.com](https://example.com/x.pdf)"), out);
  });

  it("verlinkt nicht doppelt (kein verschachteltes Link-Ziel)", () => {
    const out = linkifyAnswer("X: https://a.de/b.html");
    assert.equal((out.match(/\]\(https:/g) || []).length, 1, out);
  });

  it("verlinkt den FAQ-Pfad mit Komma im Vault-Namen", () => {
    setKnownVaults(["ASI, BS. UWS, QM, EM"]);
    const out = linkifyAnswer(
      "Quelle: /ASI, BS. UWS, QM, EM/Arbeitssicherheit/faq_vorschr_2.pdf",
    );
    assert.ok(out.includes("[faq_vorschr_2.pdf](/api/vault/file?path="), out);
    const href = out.match(/\]\((\/api\/vault\/file\?path=[^)]+)\)/)[1];
    assert.equal(
      classifyLink(href, "http://127.0.0.1:3847").kind,
      "vault",
    );
  });
});

describe("classifyLink", () => {
  const origin = "http://127.0.0.1:3847";

  it("vaultopen und nackte Vault-Pfade", () => {
    const href = `vaultopen:${encodeURIComponent("/HSEQ Sync/Themen/PSA.md")}`;
    assert.deepEqual(classifyLink(href, origin), {
      kind: "vault",
      path: "/HSEQ Sync/Themen/PSA.md",
    });
    assert.equal(classifyLink("/HSEQ Sync/Themen/PSA.md", origin).kind, "vault");
    assert.equal(classifyLink("ASI, BS. UWS, QM, EM/a.pdf", origin).kind, "vault");
  });

  it("same-origin /api/vault/file und .pdf-Pfad → vault, nicht neues Glyph-Fenster", () => {
    const api = `${origin}/api/vault/file?path=${encodeURIComponent("/HSEQ Sync/a.pdf")}`;
    assert.deepEqual(classifyLink(api, origin), { kind: "vault", path: "/HSEQ Sync/a.pdf" });
    assert.equal(
      classifyLink(`${origin}/HSEQ%20Sync/Themen/PSA.md`, origin).kind,
      "vault",
    );
    assert.equal(classifyLink(`${origin}/docs/x.html`, origin).kind, "internal");
  });

  it("externe http(s) → web; obsidian bleibt", () => {
    assert.deepEqual(classifyLink("https://www.dguv.de/de/index.jsp", origin), {
      kind: "web",
      url: "https://www.dguv.de/de/index.jsp",
    });
    assert.equal(classifyLink("http://127.0.0.1:3847/chat", origin).kind, "internal");
    assert.equal(classifyLink("obsidian://open?vault=HSEQ%20Sync", origin).kind, "obsidian");
  });

  it("looksLikeVaultFile", () => {
    assert.equal(looksLikeVaultFile("/V/a.pdf"), true);
    assert.equal(looksLikeVaultFile("x.md#foo"), true);
    assert.equal(looksLikeVaultFile("https://a.de/b.html"), false);
  });

  it("Vault-Datei-href überlebt react-markdown (vaultopen: wird gestrichen)", async () => {
    const { defaultUrlTransform } = await import("react-markdown");
    const href = sourceFileUrl("/ASI, BS. UWS, QM, EM/Arbeitssicherheit/faq_vorschr_2.pdf");
    assert.equal(defaultUrlTransform(href), href);
    assert.equal(defaultUrlTransform("vaultopen:%2Fa.pdf"), "");
  });
});

describe("extractPdfPages query", () => {
  it("hängt format=pages an die File-URL", async () => {
    const { extractPdfPages } = await import("../../client/src/utils/pdfText.js");
    const seen = [];
    const orig = globalThis.fetch;
    globalThis.fetch = async (url) => {
      seen.push(String(url));
      return {
        ok: true,
        json: async () => ({ ok: true, pages: [{ page: 1, text: "Grundbetreuung" }] }),
      };
    };
    try {
      const pages = await extractPdfPages("/api/vault/file?path=%2FASI%2Ffaq.pdf");
      assert.equal(pages[0].text, "Grundbetreuung");
      assert.match(seen[0], /format=pages/);
      assert.match(seen[0], /\/api\/vault\/file\?/);
    } finally {
      globalThis.fetch = orig;
    }
  });
});

describe("shortLinkLabel", () => {
  it("kürzt Vault-Pfad auf Dateiname und URL auf host/…/last", () => {
    assert.equal(
      shortLinkLabel("/ASI, BS. UWS, QM, EM/Arbeitssicherheit/faq_vorschr_2.pdf"),
      "faq_vorschr_2.pdf",
    );
    assert.equal(shortLinkLabel("https://example.com/x.pdf"), "example.com/x.pdf");
    assert.equal(
      shortLinkLabel("https://www.dguv.de/de/praevention/vorschriften/index.jsp"),
      "dguv.de/…/index.jsp",
    );
  });
});

describe("buildWebList", () => {
  it("nimmt http-URLs, dedupliziert, begrenzt", () => {
    const list = buildWebList({
      items: [
        "https://dguv.de/a",
        { url: "https://dguv.de/a" },
        { link: "https://komnet.nrw.de/b" },
        "kein-url",
      ],
    });
    assert.equal(list.length, 2);
    assert.equal(list[0].kind, "web");
    assert.equal(list[0].url, "https://dguv.de/a");
    assert.equal(list[1].url, "https://komnet.nrw.de/b");
  });

  it("nimmt den Seitentitel aus files, wenn die Engine ihn liefert", () => {
    const list = buildWebList({
      files: [
        { url: "https://github.com/Knowledgator/GLiFormer", title: "GitHub - Knowledgator/GLiFormer" },
        { url: "https://exa.ai/docs", title: "Exa Docs" },
      ],
      items: ["https://github.com/Knowledgator/GLiFormer", "https://exa.ai/docs"],
    });
    assert.deepEqual(
      list.map((x) => x.title),
      ["GitHub - Knowledgator/GLiFormer", "Exa Docs"],
    );
  });

  it("faellt auf die Domain zurueck, wenn der Titel fehlt oder eine URL ist", () => {
    const list = buildWebList({
      files: [
        { url: "https://dguv.de/a", title: "" },
        { url: "https://exa.ai/docs", title: "https://exa.ai/docs" },
        { url: "https://komnet.nrw.de/b", title: "   " },
      ],
    });
    assert.deepEqual(
      list.map((x) => x.title),
      ["dguv.de", "exa.ai", "komnet.nrw.de"],
    );
  });

  it("kuerzt einen ueberlangen Titel", () => {
    const lang = "T".repeat(120);
    const list = buildWebList({ files: [{ url: "https://exa.ai/x", title: lang }] });
    assert.ok(list[0].title.length <= 60, String(list[0].title.length));
    assert.ok(list[0].title.endsWith("…"));
  });

  it("beschriftet Chips mit der Domain, nicht mit dem Pfad", () => {
    const list = buildWebList({
      items: [
        "https://www.dguv.de/de/praevention/vorschriften/index.jsp",
        "https://komnet.nrw.de/themen/laerm",
      ],
    });
    assert.deepEqual(
      list.map((x) => x.title),
      ["dguv.de", "komnet.nrw.de"],
    );
  });

  it("unterscheidet gleiche Domains nur dann mit kurzem Zusatz", () => {
    const list = buildWebList({
      items: [
        "https://github.com/Knowledgator/GLiFormer",
        "https://github.com/AbdelStark/awesome-typesafe",
        "https://exa.ai/docs",
      ],
    });
    assert.deepEqual(
      list.map((x) => x.title),
      ["github.com/GLiFormer", "github.com/awesome-typesafe", "exa.ai"],
    );
  });

  it("haelt den Zusatz kurz genug fuer einen Chip", () => {
    const list = buildWebList({
      items: [
        "https://example.com/ein-sehr-langer-dateiname-mit-viel-text.pdf",
        "https://example.com/zweiter-auch-langer-name-hier.pdf",
      ],
    });
    for (const x of list) assert.ok(x.title.length <= 30, x.title);
  });
});

describe("siteLabel", () => {
  it("gibt nur die Domain zurueck, ohne www", () => {
    assert.equal(siteLabel("https://www.dguv.de/de/praevention/index.jsp"), "dguv.de");
    assert.equal(siteLabel("https://example.com/x.pdf"), "example.com");
    assert.equal(siteLabel("http://sub.example.co.uk/a/b/c"), "sub.example.co.uk");
  });

  it("faellt bei Nicht-URLs auf den Dateinamen zurueck", () => {
    assert.equal(siteLabel("/ASI, BS. UWS/Arbeitssicherheit/faq_vorschr_2.pdf"), "faq_vorschr_2.pdf");
    assert.equal(siteLabel(""), "");
  });
});
