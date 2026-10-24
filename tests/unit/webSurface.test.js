/**
 * Public web surface: host, origin, seat lock, gate exempt.
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  agentAllowedOnSeat,
  defaultAgentIdForSeat,
  extraWebHosts,
  grantWebAccess,
  isWebAdminApi,
  isWebGateExempt,
  isWebHostname,
  isWebOrigin,
  normalizeHostname,
  normalizeRequestPath,
  parseCookie,
  publicWebAccess,
  sessionTtlS,
  WEB_SESSION_TTL_S,
  validateNewWebPassword,
  parseStoredWebSessions,
  serializeWebSessions,
  WEB_SESSIONS_MAX,
} from "../../server/webSurface.mjs";
import {
  isWebSurfaceHost,
  surfaceHeaderControls,
} from "../../client/src/utils/webSurface.js";

describe("grantWebAccess", () => {
  it("opens the door from the password and does not credit a pack", () => {
    const got = grantWebAccess({ source: "password", packTokens: 512000 });
    assert.equal(got.ok, true);
    assert.deepEqual(got.access, {
      source: "password",
      role: "owner",
      opened: true,
      packTokens: 0,
      consumed: 0,
    });
  });

  it("gives a guest the guest role, not owner", () => {
    const got = grantWebAccess({ source: "password", role: "guest" });
    assert.equal(got.ok, true);
    assert.equal(got.access.role, "guest");
    // Ein Gast öffnet die Tür genauso — die Rolle entscheidet über Rechte.
    assert.equal(got.access.opened, true);
    assert.equal(publicWebAccess(got.access).role, "guest");
  });

  it("gives guests a 30-minute session, owners 30 days", () => {
    const now = 1_800_000_000_000;
    const ttlGuest = sessionTtlS({ role: "guest" });
    const ttlOwner = sessionTtlS({ role: "owner" });
    assert.equal(ttlGuest, 1800);
    assert.equal(ttlOwner, WEB_SESSION_TTL_S);

    const rows = {
      tokens: [
        { token: "gast31", iat: now - 31 * 60 * 1000, access: { source: "password", role: "guest" } },
        { token: "gast29", iat: now - 29 * 60 * 1000, access: { source: "password", role: "guest" } },
        { token: "chef", iat: now - 29 * 60 * 1000, access: { source: "password", role: "owner" } },
        { token: "alt", iat: now - 40 * 24 * 3600 * 1000, access: { source: "password", role: "owner" } },
      ],
    };
    const kept = parseStoredWebSessions(rows, now).map((r) => r.token);
    assert.deepEqual(kept.sort(), ["chef", "gast29"]);
  });

  it("defaults to owner when no role is given", () => {
    assert.equal(grantWebAccess({ source: "password" }).access.role, "owner");
    assert.equal(grantWebAccess({ source: "aufladen" }).access.role, "owner");
  });

  it("opens the door from a top-up and credits the pack", () => {
    const got = grantWebAccess({ source: "aufladen" });
    assert.equal(got.ok, true);
    assert.equal(got.access.opened, true);
    assert.equal(got.access.source, "aufladen");
    assert.equal(got.access.packTokens, 512000);
    assert.equal(got.access.consumed, 0);
  });

  it("keeps an explicit paid pack size", () => {
    const got = grantWebAccess({ source: "aufladen", packTokens: 256000 });
    assert.equal(got.access.packTokens, 256000);
  });

  it("rejects an unknown source", () => {
    const got = grantWebAccess({ source: "coupon" });
    assert.equal(got.ok, false);
    assert.equal(got.access, undefined);
  });
});

describe("isWebHostname", () => {
  it("allows the public domain exactly", () => {
    assert.equal(isWebHostname("glyph-ui.com"), true);
    assert.equal(isWebHostname("www.glyph-ui.com"), true);
    assert.equal(isWebHostname("GLYPH-UI.COM:443"), true);
  });

  it("rejects substring lookalikes", () => {
    assert.equal(isWebHostname("glyph-ui.com.evil.example"), false);
    assert.equal(isWebHostname("not-glyph-ui.com"), false);
    assert.equal(isWebHostname("trycloudflare.com"), false);
    assert.equal(isWebHostname("127.0.0.1"), false);
  });

  it("accepts extra hosts from env list", () => {
    assert.equal(isWebHostname("chat.example.test", "chat.example.test"), true);
    assert.deepEqual(extraWebHosts(" a.test , b.test "), ["a.test", "b.test"]);
  });
});

describe("isWebOrigin", () => {
  it("requires https and default port", () => {
    assert.equal(isWebOrigin("https://glyph-ui.com"), true);
    assert.equal(isWebOrigin("https://glyph-ui.com/"), true);
    assert.equal(isWebOrigin("http://glyph-ui.com"), false);
    assert.equal(isWebOrigin("https://glyph-ui.com:8443"), false);
    assert.equal(isWebOrigin("https://evil.example/?x=glyph-ui.com"), false);
  });
});

describe("seat agent lock", () => {
  it("web defaults to °_Agent", () => {
    assert.equal(defaultAgentIdForSeat("web", "grok"), "glyph-agent");
    assert.equal(defaultAgentIdForSeat("desk", "grok"), "grok");
  });

  it("web rejects Grok and Code", () => {
    assert.equal(agentAllowedOnSeat("web", "glyph-agent"), true);
    assert.equal(agentAllowedOnSeat("web", "grok"), false);
    assert.equal(agentAllowedOnSeat("web", "_code"), false);
    assert.equal(agentAllowedOnSeat("desk", "grok"), true);
  });
});

describe("gate helpers", () => {
  it("parses cookies", () => {
    assert.equal(parseCookie("glyph_web=abc; other=1", "glyph_web"), "abc");
    assert.equal(parseCookie("", "glyph_web"), "");
  });

  it("blocks admin APIs on the web surface", () => {
    assert.equal(isWebAdminApi("/api/bindings"), true);
    assert.equal(isWebAdminApi("/api/sessions"), true);
    assert.equal(isWebAdminApi("/api/sessions/abc"), true);
    assert.equal(isWebAdminApi("/api/sessions/abc/open"), true);
    assert.equal(isWebAdminApi("/api/recurring"), true);
    assert.equal(isWebAdminApi("/api/sessions/abc/history"), false);
    assert.equal(isWebAdminApi("/api/health"), false);
    assert.equal(isWebAdminApi("/api/vault/find"), false);
    assert.equal(isWebAdminApi("/api/web-gate/password"), false);
  });

  it("ist unabhängig von Groß-/Kleinschreibung, Slashes und Kodierung", () => {
    // Express routet case-insensitiv ohne Strict-Slashes — die Sperre muss
    // dieselbe Sicht haben, sonst ist /API/sessions ein Bypass.
    assert.equal(isWebAdminApi("/API/sessions"), true);
    assert.equal(isWebAdminApi("/Api/Bindings/"), true);
    assert.equal(isWebAdminApi("/%61pi/sessions"), true);
    assert.equal(isWebAdminApi("//api//sessions//"), true);
    assert.equal(normalizeRequestPath("/API/Sessions/"), "/api/sessions");
  });

  it("exempts only the gate endpoint among APIs", () => {
    assert.equal(isWebGateExempt({ method: "GET", path: "/api/web-gate" }), true);
    assert.equal(isWebGateExempt({ method: "POST", path: "/api/web-gate" }), true);
    assert.equal(isWebGateExempt({ method: "GET", path: "/api/health" }), false);
    assert.equal(isWebGateExempt({ method: "GET", path: "/api/ws-token" }), false);
    assert.equal(isWebGateExempt({ method: "GET", path: "/docs/adr/0001.md" }), false);
    assert.equal(isWebGateExempt({ method: "GET", path: "/" }), true);
    assert.equal(isWebGateExempt({ method: "GET", path: "/assets/x.js" }), true);
    // Kein Schlupfloch über Schreibweise/Slashes/Encoding.
    assert.equal(isWebGateExempt({ method: "GET", path: "/API/health" }), false);
    assert.equal(isWebGateExempt({ method: "GET", path: "/api//health/" }), false);
    assert.equal(isWebGateExempt({ method: "GET", path: "/%61pi/health" }), false);
    // Express trifft auch /API/web-gate → das Login-Ziel bleibt exempt.
    assert.equal(isWebGateExempt({ method: "POST", path: "/API/web-gate" }), true);
  });
});

describe("client host helper", () => {
  it("matches the server default hosts", () => {
    assert.equal(isWebSurfaceHost("glyph-ui.com"), true);
    assert.equal(isWebSurfaceHost("www.glyph-ui.com"), true);
    assert.equal(isWebSurfaceHost("evil.glyph-ui.com"), false);
    assert.equal(isWebSurfaceHost("glyph-ui.com.evil.example"), false);
  });
});

describe("surfaceHeaderControls", () => {
  it("puts Neu Laden on the web header, not Beenden", () => {
    assert.deepEqual(surfaceHeaderControls("web"), { reload: true, quit: false });
    assert.deepEqual(surfaceHeaderControls("desk"), { reload: false, quit: true });
    assert.deepEqual(surfaceHeaderControls("phone"), { reload: false, quit: true });
  });
});

describe("validateNewWebPassword", () => {
  it("requires 4–200 chars, not equal to current", () => {
    // Mindestlänge 4: absichtlich niedrig, keine Zeichenklassen-Regeln.
    assert.equal(validateNewWebPassword("abc").ok, false);
    assert.equal(validateNewWebPassword("abcd").ok, true);
    assert.equal(validateNewWebPassword("sameword", "sameword").ok, false);
    assert.equal(validateNewWebPassword("  padded1").ok, false);
    const ok = validateNewWebPassword("new-secret", "old-secret");
    assert.equal(ok.ok, true);
    assert.equal(ok.password, "new-secret");
  });

  it("accepts any mix of letters, digits and symbols", () => {
    for (const pw of ["1234", "abcd", "!!!!", "a1!b", "ßßßß"]) {
      assert.equal(validateNewWebPassword(pw).ok, true, pw);
    }
  });
});

describe("normalizeHostname", () => {
  it("strips port and forwarded list", () => {
    assert.equal(normalizeHostname("glyph-ui.com:443"), "glyph-ui.com");
    assert.equal(normalizeHostname("glyph-ui.com, other"), "glyph-ui.com");
  });
});

describe("web session persistence", () => {
  it("keeps a fresh token and drops an expired one", () => {
    const now = 1_800_000_000_000;
    const fresh = { token: "aaa", iat: now - 60_000 };
    const old = { token: "bbb", iat: now - 31 * 24 * 60 * 60 * 1000 };
    const got = parseStoredWebSessions({ tokens: [fresh, old] }, now);
    assert.deepEqual(got, [fresh]);
  });

  it("accepts a bare token list and de-dupes", () => {
    const now = 1_800_000_000_000;
    const got = parseStoredWebSessions(["same", "same"], now);
    assert.equal(got.length, 1);
    assert.equal(got[0].token, "same");
    assert.equal(got[0].iat, now);
  });

  it("caps the stored set", () => {
    const now = 1_800_000_000_000;
    const tokens = [];
    for (let i = 0; i < WEB_SESSIONS_MAX + 5; i += 1) {
      tokens.push({ token: `t${i}`, iat: now - i });
    }
    const got = parseStoredWebSessions({ tokens }, now);
    assert.equal(got.length, WEB_SESSIONS_MAX);
    assert.equal(got[0].token, "t0");
  });

  it("round-trips JSON", () => {
    const entries = [{ token: "abc", iat: 42 }];
    const parsed = JSON.parse(serializeWebSessions(entries));
    assert.deepEqual(parsed.tokens, entries);
  });

  it("keeps a payment grant and leaves an old password row unchanged", () => {
    const now = 1_800_000_000_000;
    const paid = grantWebAccess({ source: "aufladen", packTokens: 512000 }).access;
    const got = parseStoredWebSessions(
      {
        tokens: [
          { token: "paid", iat: now - 1000, access: { ...paid, consumed: 12 } },
          { token: "old", iat: now - 2000 },
        ],
      },
      now,
    );
    assert.deepEqual(got[0], {
      token: "paid",
      iat: now - 1000,
      access: { ...paid, consumed: 12 },
    });
    assert.deepEqual(got[1], { token: "old", iat: now - 2000 });
  });
});
