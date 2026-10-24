/**
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  applyBindingsToEnv,
  bindingsPath,
  buildBindingsStatus,
  maskSecret,
  modelsMismatch,
  modelsToAgentPayload,
  normalizeBindingsFile,
  normalizeModels,
  hopFromModelId,
  probeModelOnAgent,
  pushModelsToAgent,
  readBindingsFile,
  resolveKeySource,
  updateBindings,
  writeBindingsFile,
  buildAgentPush,
  isLoopbackAgentUrl,
  syncModelsIfMismatch,
} from "../../server/bindings.js";

test("maskSecret", () => {
  assert.equal(maskSecret(""), null);
  assert.equal(maskSecret("ab"), "…");
  assert.equal(maskSecret("sk-or-abcdefgh"), "…efgh");
});

test("normalizeBindingsFile accepts nested and flat shapes", () => {
  const nested = normalizeBindingsFile({
    keys: { OPENROUTER_API_KEY: " sk-a ", DIRECT_API_KEY: " sk-ds " },
    settings: { GLYPH_AGENT_URL: "http://127.0.0.1:9", DIRECT_API_URL: "https://api.deepseek.com" },
  });
  assert.equal(nested.keys.OPENROUTER_API_KEY, "sk-a");
  assert.equal(nested.keys.DIRECT_API_KEY, "sk-ds");
  assert.equal(nested.settings.GLYPH_AGENT_URL, "http://127.0.0.1:9");
  assert.equal(nested.settings.DIRECT_API_URL, "https://api.deepseek.com");
  assert.equal(nested.models.shared, null);

  const flat = normalizeBindingsFile({
    XAI_API_KEY: "xai-1",
    GLYPH_AGENT_URL: "http://x",
  });
  assert.equal(flat.keys.XAI_API_KEY, "xai-1");
  assert.equal(flat.settings.GLYPH_AGENT_URL, "http://x");
});

test("normalizeModels nested shared/code", () => {
  const m = normalizeModels({
    models: {
      shared: {
        primary: " deepseek/deepseek-v4-flash-0731 ",
        fallback: "inclusionai/ling-3.0-tiny:free",
        contextWindow: 1048576,
      },
      code: { primary: "x/y", fallback: "" },
    },
  });
  assert.equal(m.shared.primary, "deepseek/deepseek-v4-flash-0731");
  assert.equal(m.shared.fallback, "inclusionai/ling-3.0-tiny:free");
  assert.equal(m.shared.contextWindow, 1048576);
  assert.equal(m.code.primary, "x/y");
  assert.equal(m.code.fallback, "");
});

test("modelsToAgentPayload and modelsMismatch", () => {
  const models = {
    shared: { primary: "a/b", fallback: "c/d" },
    code: null,
  };
  const payload = modelsToAgentPayload(models);
  assert.deepEqual(payload.shared, { primary: "a/b", fallback: "c/d" });
  assert.equal(payload.code, undefined);

  assert.equal(
    modelsMismatch(models, {
      shared: { primary: "a/b", fallback: "c/d" },
      code: { primary: "a/b", fallback: "c/d", override: false },
    }),
    false,
  );
  assert.equal(
    modelsMismatch(models, {
      shared: { primary: "a/b", fallback: "" },
      code: { override: false },
    }),
    true,
  );
});

test("write/read models roundtrip", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "glyph-bind-m-"));
  const file = path.join(dir, "bindings.json");
  const env = {};
  await updateBindings(
    {
      models: {
        shared: {
          primary: "deepseek/deepseek-v4-flash-0731",
          fallback: "inclusionai/ling-3.0-tiny:free",
        },
        code: null,
      },
    },
    { stateDir: dir, bindingsFile: file, env },
  );
  const read = await readBindingsFile(file);
  assert.equal(read.models.shared.primary, "deepseek/deepseek-v4-flash-0731");
  assert.equal(read.models.shared.fallback, "inclusionai/ling-3.0-tiny:free");
  assert.equal(read.models.code, null);
});

test("bindingsPath default under state dir", () => {
  assert.ok(bindingsPath("/tmp/glyph-test").endsWith("bindings.json"));
  assert.equal(
    bindingsPath("/tmp/glyph-test"),
    path.join("/tmp/glyph-test", "bindings.json"),
  );
});

test("write/read/updateBindings roundtrip", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "glyph-bind-"));
  const file = path.join(dir, "bindings.json");
  const env = {};

  await writeBindingsFile(
    { keys: { OPENROUTER_API_KEY: "sk-secret-9999" }, settings: {} },
    file,
  );
  const read = await readBindingsFile(file);
  assert.equal(read.keys.OPENROUTER_API_KEY, "sk-secret-9999");

  applyBindingsToEnv(read, { overwrite: false, env });
  assert.equal(env.OPENROUTER_API_KEY, "sk-secret-9999");

  // env already set → load does not overwrite
  env.OPENROUTER_API_KEY = "from-env";
  applyBindingsToEnv(read, { overwrite: false, env });
  assert.equal(env.OPENROUTER_API_KEY, "from-env");

  await updateBindings(
    { OPENROUTER_API_KEY: "sk-new-1111", XAI_API_KEY: "xai-abc" },
    { stateDir: dir, bindingsFile: file, env },
  );
  assert.equal(env.OPENROUTER_API_KEY, "sk-new-1111");
  assert.equal(env.XAI_API_KEY, "xai-abc");

  await updateBindings(
    { OPENROUTER_API_KEY: "" },
    { stateDir: dir, bindingsFile: file, env },
  );
  assert.equal(env.OPENROUTER_API_KEY, undefined);
  assert.equal(env.XAI_API_KEY, "xai-abc");

  const after = await readBindingsFile(file);
  assert.equal(after.keys.OPENROUTER_API_KEY, undefined);
  assert.equal(after.keys.XAI_API_KEY, "xai-abc");
});

test("resolveKeySource prefers env when values differ", () => {
  const a = resolveKeySource(
    "OPENROUTER_API_KEY",
    { OPENROUTER_API_KEY: "from-file-val" },
    { OPENROUTER_API_KEY: "from-env-zzzz" },
  );
  assert.equal(a.source, "env");
  assert.equal(a.masked, "…zzzz");

  const b = resolveKeySource(
    "OPENROUTER_API_KEY",
    { OPENROUTER_API_KEY: "same-value-here" },
    { OPENROUTER_API_KEY: "same-value-here" },
  );
  assert.equal(b.source, "bindings");
});

test("buildBindingsStatus never leaks raw secrets", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "glyph-bind-"));
  const file = path.join(dir, "bindings.json");
  await writeBindingsFile(
    {
      keys: { OPENROUTER_API_KEY: "sk-super-secret-value", XAI_API_KEY: "xai-zzzz" },
      settings: { GLYPH_AGENT_URL: "http://127.0.0.1:18899" },
    },
    file,
  );
  const env = {
    OPENROUTER_API_KEY: "sk-super-secret-value",
    XAI_API_KEY: "xai-zzzz",
    PATH: process.env.PATH,
    HOME: process.env.HOME,
  };
  const status = await buildBindingsStatus({
    stateDir: dir,
    bindingsFile: file,
    env,
    home: dir,
    agentHealth: { ok: true, url: "http://127.0.0.1:18899/health", detail: "ok" },
  });
  const json = JSON.stringify(status);
  assert.ok(!json.includes("sk-super-secret-value"));
  assert.ok(!json.includes("xai-zzzz"));
  assert.equal(status.keys.OPENROUTER_API_KEY.set, true);
  assert.ok(status.keys.OPENROUTER_API_KEY.masked.startsWith("…"));
  assert.equal(status.profiles._tick.checks.find((c) => c.id === "openrouter").ok, true);
  assert.equal(status.profiles._tick.label, "^_tick");
  assert.equal(status.profiles["glyph-agent"].checks.find((c) => c.id === "agent_service").ok, true);
  assert.equal(status.voice.ok, true);
  assert.equal(status.voice.provider, "xai");
  assert.ok(status.profiles.voice);
  assert.equal(status.profiles.voice.kind, "capability");
  assert.equal(status.profiles.voice.ok, true);
});

test("buildBindingsStatus: OpenRouter alone enables Voice profile", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "glyph-bind-or-"));
  const file = path.join(dir, "bindings.json");
  await writeBindingsFile(
    {
      keys: { OPENROUTER_API_KEY: "sk-or-only-voice" },
      settings: {},
    },
    file,
  );
  const env = {
    OPENROUTER_API_KEY: "sk-or-only-voice",
    PATH: process.env.PATH,
    HOME: dir,
  };
  const status = await buildBindingsStatus({
    stateDir: dir,
    bindingsFile: file,
    env,
    home: dir,
    agentHealth: { ok: false, url: "http://127.0.0.1:18899/health", detail: "offline" },
  });
  assert.equal(status.voice.ok, true);
  assert.equal(status.voice.provider, "openrouter");
  assert.equal(status.profiles.voice.ok, true);
  assert.equal(status.profiles.voice.auth, "openrouter");
  assert.equal(status.keys.XAI_API_KEY.set, false);
});

test("normalizeBindingsFile keeps OPENROUTER_URL as Router-Host", () => {
  const nested = normalizeBindingsFile({
    keys: { OPENROUTER_API_KEY: "sk-orca-abc" },
    settings: { OPENROUTER_URL: "https://api.orcarouter.ai/v1" },
  });
  assert.equal(nested.settings.OPENROUTER_URL, "https://api.orcarouter.ai/v1");
});

test("buildAgentPush: OPENROUTER_URL goes to live openrouter_url", () => {
  const saved = {
    keys: { OPENROUTER_API_KEY: "sk-orca-abc" },
    settings: {
      DIRECT_API_URL: "https://api.deepseek.com",
      OPENROUTER_URL: "https://api.orcarouter.ai/v1",
    },
    models: {
      shared: {
        primary: "deepseek-v4-flash-vision-exp",
        fallback: "z-ai/glm-5.3-flash",
      },
    },
  };
  const plan = buildAgentPush(saved, {
    OPENROUTER_URL: "https://api.orcarouter.ai/v1",
  });
  assert.equal(plan.push, true);
  assert.equal(plan.direct.openrouter_url, "https://api.orcarouter.ai/v1");
  assert.equal(plan.direct.openrouter_key, "sk-orca-abc");
});

test("buildAgentPush: Direct-Key Schreiben sends live api_key", () => {
  const saved = {
    keys: { DIRECT_API_KEY: "sk-new-3e4e" },
    settings: { DIRECT_API_URL: "https://api.deepseek.com" },
    models: {
      shared: {
        primary: "deepseek-v4-flash-vision-exp",
        fallback: "deepseek/deepseek-v4-flash-0731",
      },
    },
  };
  const plan = buildAgentPush(saved, { DIRECT_API_KEY: "sk-new-3e4e" });
  assert.equal(plan.push, true);
  assert.equal(plan.direct.api_key, "sk-new-3e4e");
  assert.equal(plan.direct.url, "https://api.deepseek.com");
  assert.equal(plan.models.shared.primary, "deepseek-v4-flash-vision-exp");
});

test("buildAgentPush: clearing Direct-Key still notifies the agent", () => {
  const plan = buildAgentPush(
    {
      keys: {},
      settings: { DIRECT_API_URL: "https://api.deepseek.com" },
      models: { shared: { primary: "deepseek-v4-flash-vision-exp", fallback: "" } },
    },
    { DIRECT_API_KEY: "" },
  );
  assert.equal(plan.push, true);
  assert.equal(plan.direct.api_key, "");
});

test("updateBindings persists OPENROUTER_URL and applies env", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "glyph-bind-orurl-"));
  const file = path.join(dir, "bindings.json");
  const env = {};
  await updateBindings(
    { OPENROUTER_URL: "https://api.orcarouter.ai/v1" },
    { stateDir: dir, bindingsFile: file, env },
  );
  const read = await readBindingsFile(file);
  assert.equal(read.settings.OPENROUTER_URL, "https://api.orcarouter.ai/v1");
  assert.equal(env.OPENROUTER_URL, "https://api.orcarouter.ai/v1");
});

test("syncModelsIfMismatch pushes OPENROUTER_URL when live host differs", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "glyph-bind-sync-or-"));
  const file = path.join(dir, "bindings.json");
  await writeBindingsFile(
    {
      keys: { OPENROUTER_API_KEY: "sk-orca-abc" },
      settings: { OPENROUTER_URL: "https://api.orcarouter.ai/v1" },
      models: {
        shared: { primary: "z-ai/glm-5.3-flash-free", fallback: "" },
      },
      provider: "openrouter",
    },
    file,
  );
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({
      url,
      method: init?.method || "GET",
      body: init?.body ? JSON.parse(init.body) : null,
    });
    return { ok: true, json: async () => ({ ok: true }) };
  };
  const result = await syncModelsIfMismatch({
    stateDir: dir,
    bindingsFile: file,
    env: { GLYPH_AGENT_URL: "http://127.0.0.1:18899" },
    fetchImpl,
    agentHealth: {
      ok: true,
      body: {
        models: {
          shared: { primary: "z-ai/glm-5.3-flash-free", fallback: "" },
          code: {
            primary: "z-ai/glm-5.3-flash-free",
            fallback: "",
            override: false,
          },
          provider: "openrouter",
          provider_mode: "openrouter",
          code_provider: "openrouter",
          code_provider_mode: "openrouter",
          direct: { openrouter_url: "https://openrouter.ai/api/v1" },
        },
      },
    },
  });
  assert.equal(result.ok, true);
  const post = calls.find((c) => String(c.url).endsWith("/models") && c.method === "POST");
  assert.ok(post, "expected POST /models");
  assert.equal(post.body.direct.openrouter_url, "https://api.orcarouter.ai/v1");
  assert.equal(post.body.direct.openrouter_key, "sk-orca-abc");
});

test("pushModelsToAgent posts direct.openrouter_url", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ ok: true }) };
  };
  const result = await pushModelsToAgent(
    "http://127.0.0.1:18899",
    { shared: { primary: "deepseek-v4-flash-vision-exp", fallback: "z-ai/glm-5.3-flash" } },
    {
      fetchImpl,
      direct: {
        openrouter_url: "https://api.orcarouter.ai/v1",
        openrouter_key: "sk-orca-abc",
      },
    },
  );
  assert.equal(result.ok, true);
  assert.equal(calls[0].body.direct.openrouter_url, "https://api.orcarouter.ai/v1");
  assert.equal(calls[0].body.direct.openrouter_key, "sk-orca-abc");
});

test("pushModelsToAgent posts direct.api_key even when empty", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ ok: true }) };
  };
  const result = await pushModelsToAgent(
    "http://127.0.0.1:18899",
    { shared: { primary: "deepseek-v4-flash-vision-exp", fallback: "" } },
    { fetchImpl, direct: { api_key: "", url: "https://api.deepseek.com" } },
  );
  assert.equal(result.ok, true);
  assert.equal(result.applied, true);
  assert.equal(calls[0].body.direct.api_key, "");
  assert.equal(calls[0].body.direct.url, "https://api.deepseek.com");
});

test("hopFromModelId: no slash is Direct, slash is Router", () => {
  assert.equal(hopFromModelId("deepseek-v4-flash-vision-exp"), "direct");
  assert.equal(hopFromModelId("z-ai/glm-5.3-flash"), "openrouter");
});

test("probeModelOnAgent sends hop=direct for Vision-Exp", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ ok: true, hop: "direct" }) };
  };
  const result = await probeModelOnAgent(
    "http://127.0.0.1:18899",
    "deepseek-v4-flash-vision-exp",
    { fetchImpl },
  );
  assert.equal(result.ok, true);
  assert.equal(calls[0].body.model, "deepseek-v4-flash-vision-exp");
  assert.equal(calls[0].body.hop, "direct");
});

test("probeModelOnAgent sends hop=openrouter for slash slug", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ ok: true, hop: "openrouter" }) };
  };
  const result = await probeModelOnAgent(
    "http://127.0.0.1:18899",
    "z-ai/glm-5.3-flash",
    { fetchImpl },
  );
  assert.equal(result.ok, true);
  assert.equal(calls[0].body.hop, "openrouter");
});

test("isLoopbackAgentUrl lässt nur lokale Engine-Ziele zu", () => {
  assert.equal(isLoopbackAgentUrl("http://127.0.0.1:18899"), true);
  assert.equal(isLoopbackAgentUrl("http://localhost:18899/"), true);
  assert.equal(isLoopbackAgentUrl("http://[::1]:18899"), true);
  assert.equal(isLoopbackAgentUrl("https://127.0.0.1.evil.example"), false);
  assert.equal(isLoopbackAgentUrl("https://evil.example"), false);
  assert.equal(isLoopbackAgentUrl("file:///tmp/x"), false);
  assert.equal(isLoopbackAgentUrl(""), false);
});
