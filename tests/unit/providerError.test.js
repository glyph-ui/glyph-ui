/**
 * Provider-Fehler: 429/404 aus OpenRouter lesbar machen.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseProviderError,
  providerErrorSummary,
} from "../../client/src/utils/providerError.js";

const RATE = `Fehler: HTTP 429 Too Many Requests von Modell 'openrouter/free': {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"xingchen-agi/xing4.0-29b-a4b:free is temporarily rate-limited upstream.","is_byok":false,"limit_source":"upstream_provider_shared_pool"}},"user_id":"user_3GHW"}`;

const POLICY = `Fehler: HTTP 404 Not Found von Modell 'openrouter/free': {"error":{"message":"0 endpoints out of 9 requested are available matching your guardrail restrictions and data policy. We removed them for the following reasons: ZDR violation (account settings): 9 endpoints excluded; Free model training violation (account settings): 6 endpoints excluded","code":404,"metadata":{"input_endpoint_count":9,"ineligibility_reasons":[{"reason":"zdr-violation-by-account","endpoint_count":9}]}},"user_id":"user_3GHW"}`;

describe("parseProviderError", () => {
  it("erkennt 429 als Auslastung, nicht als kryptischen Fehler", () => {
    const info = parseProviderError(RATE);
    assert.equal(info.kind, "busy");
    assert.equal(info.status, 429);
    assert.equal(info.model, "openrouter/free");
    assert.match(info.title, /ausgelastet/i);
    assert.match(info.message, /kurz warten/i);
    assert.match(info.details, /429/);
  });

  it("erkennt die Datenschutz-Sperre bei 404", () => {
    const info = parseProviderError(POLICY);
    assert.equal(info.kind, "policy");
    assert.match(info.title, /nicht freigegeben/i);
    assert.equal(info.link, "https://openrouter.ai/settings/privacy");
    assert.match(info.hint, /Zero Data Retention/i);
  });

  it("erkennt ein Textmodell bei Bild-Anhängen", () => {
    const info = parseProviderError(
      `Fehler: HTTP 404 Not Found von Modell 'nvidia/nemotron-3-ultra-550b-a55b:free': {"error":{"message":"No endpoints found that support image input","code":404}}`,
    );
    assert.equal(info.kind, "vision");
    assert.match(info.title, /keine Bilder/i);
    assert.match(info.hint, /nemotron-3\.5-super-vl/);
  });

  it("ordnet Auth- und Serverfehler ein", () => {
    assert.equal(
      parseProviderError(`Fehler: HTTP 401 Unauthorized von Modell 'openrouter/free': {"error":{"code":401,"message":"No auth credentials found"}}`)
        .kind,
      "auth",
    );
    assert.equal(
      parseProviderError(`Fehler: HTTP 503 Service Unavailable von Modell 'openrouter/free': {"error":{"code":503,"message":"upstream"}}`)
        .kind,
      "upstream",
    );
  });

  it("lässt normale Texte unangetastet", () => {
    assert.equal(parseProviderError("Alles gut."), null);
    assert.equal(parseProviderError("HTTP 500 im Log einer Datei"), null);
    assert.equal(providerErrorSummary("Kurzer Fehler"), "Kurzer Fehler");
  });

  it("baut eine einzeilige Banner-Fassung", () => {
    const line = providerErrorSummary(RATE);
    assert.match(line, /^Modell gerade ausgelastet — /);
    assert.doesNotMatch(line, /\{"error"/);
  });
});
