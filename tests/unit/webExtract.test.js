/**
 * WebExtract: Einbettbarkeit (X-Frame-Options/frame-ancestors), Text-Auszug,
 * URL-Sperre für den Seitenabruf.
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  capText,
  decodeEntities,
  extractReadable,
  isEmbeddable,
  isPrivateHost,
  parsePageUrl,
} from "../../server/webExtract.mjs";

describe("webExtract: isEmbeddable", () => {
  it("lässt Seiten ohne Sperre durch", () => {
    assert.equal(isEmbeddable({}), true);
    assert.equal(isEmbeddable(new Headers({ "content-type": "text/html" })), true);
  });

  it("blockt X-Frame-Options (deny/sameorigin)", () => {
    assert.equal(isEmbeddable({ "x-frame-options": "DENY" }), false);
    assert.equal(isEmbeddable({ "X-Frame-Options": "sameorigin" }), false);
    assert.equal(isEmbeddable(new Headers({ "x-frame-options": "SAMEORIGIN" })), false);
  });

  it("allowall bleibt offen", () => {
    assert.equal(isEmbeddable({ "x-frame-options": "allowall" }), true);
  });

  it("blockt CSP frame-ancestors ohne Stern", () => {
    assert.equal(isEmbeddable({ "content-security-policy": "frame-ancestors 'none'" }), false);
    assert.equal(isEmbeddable({ "content-security-policy": "frame-ancestors 'self'" }), false);
    assert.equal(
      isEmbeddable({ "content-security-policy": "default-src 'self'; frame-ancestors https://eigen.de" }),
      false,
    );
    assert.equal(isEmbeddable({ "content-security-policy": "frame-ancestors *" }), true);
  });
});

describe("webExtract: extractReadable", () => {
  const html = `<!doctype html><html><head><title>  Prüfbericht &amp; Co </title>
<style>.x{color:red}</style></head>
<body><!-- Kommentar --><script>evil()</script>
<h1>Überschrift</h1>
<p>Erster Absatz mit&nbsp;Leerzeichen.</p>
<p>Zweiter<br>Absatz</p>
<ul><li>Punkt 1</li><li>Punkt 2</li></ul>
<svg><circle/></svg>
</body></html>`;

  it("liest Titel und Absätze, ohne Skripte/Styles", () => {
    const { title, text } = extractReadable(html);
    assert.equal(title, "Prüfbericht & Co");
    assert.ok(text.includes("Überschrift"));
    assert.ok(text.includes("Erster Absatz mit Leerzeichen."));
    assert.ok(text.includes("Punkt 1"));
    assert.ok(!text.includes("evil()"));
    assert.ok(!text.includes("color:red"));
    assert.ok(!text.includes("circle"));
  });

  it("wandelt Entities zurück und trennt Absätze mit Leerzeile", () => {
    assert.equal(decodeEntities("a &amp; b &#228; &#x20ac;"), "a & b ä €");
    const { text } = extractReadable("<p>eins</p><p>zwei</p>");
    assert.ok(/\nzwei/.test(text));
  });

  it("kapt lange Texte mit ehrlichem Hinweis", () => {
    const short = capText("abc", 10);
    assert.equal(short, "abc");
    const long = capText("x".repeat(50), 10);
    assert.ok(long.startsWith("xxxxxxxxxx"));
    assert.ok(long.includes("Auszug"));
  });
});

describe("webExtract: parsePageUrl / isPrivateHost", () => {
  it("akzeptiert http/https", () => {
    assert.equal(parsePageUrl("https://example.com/a?b=1").ok, true);
    assert.equal(parsePageUrl("http://example.com").ok, true);
  });

  it("lehnt kaputt, anderes Protokoll und lokale Ziele ab", () => {
    assert.equal(parsePageUrl("").ok, false);
    assert.equal(parsePageUrl("ftp://example.com").ok, false);
    assert.equal(parsePageUrl("http://localhost:5174/x").ok, false);
    assert.equal(parsePageUrl("http://127.0.0.1/").ok, false);
    assert.equal(parsePageUrl("http://192.168.1.10/").ok, false);
    assert.equal(parsePageUrl("http://10.0.0.7/").ok, false);
    assert.equal(parsePageUrl("http://172.20.1.1/").ok, false);
    assert.equal(parsePageUrl("http://169.254.169.254/").ok, false);
  });

  it("isPrivateHost deckt Namen und IPs ab", () => {
    assert.equal(isPrivateHost("example.com"), false);
    assert.equal(isPrivateHost("nas.local"), true);
    assert.equal(isPrivateHost("::1"), true);
    assert.equal(isPrivateHost("10.1.2.3"), true);
    // IPv4-mapped IPv6, Ganzzahl-IPv4, CGNAT, ULA/Link-Local
    assert.equal(isPrivateHost("::ffff:127.0.0.1"), true);
    assert.equal(isPrivateHost("[::ffff:7f00:1]"), true);
    assert.equal(isPrivateHost("2130706433"), true);
    assert.equal(isPrivateHost("100.64.0.1"), true);
    assert.equal(isPrivateHost("fd00::1"), true);
    assert.equal(isPrivateHost("fe80::1"), true);
    assert.equal(isPrivateHost("8.8.8.8"), false);
  });
});
