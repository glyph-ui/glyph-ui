/**
 * Ownership-Regel: Ein adoptierter (von Hand gestarteter) Modellprozess darf
 * nicht durch Idle- oder Max-Runtime-Bremse beendet werden — nur selbst
 * gestartete Kinder und die Speicher-Bremse greifen dort.
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const savedEnv = {
  GLYPH_LOCAL_URL: process.env.GLYPH_LOCAL_URL,
  GLYPH_UI_STATE_DIR: process.env.GLYPH_UI_STATE_DIR,
  GLYPH_LOCAL_MIN_FREE_MB: process.env.GLYPH_LOCAL_MIN_FREE_MB,
};

function restoreEnv() {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

after(restoreEnv);

describe("Adoption", () => {
  it("beendet einen fremden Prozess nicht per maxRuntime", async () => {
    const fake = http.createServer((req, res) => {
      if (req.url.endsWith("/health")) {
        res.end("ok");
        return;
      }
      // Kein /metrics — wie der laufende llama-server ohne --metrics.
      res.statusCode = 501;
      res.end("{}");
    });
    await new Promise((resolve) => fake.listen(0, "127.0.0.1", resolve));
    const port = fake.address().port;

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "glyph-local-"));
    process.env.GLYPH_LOCAL_URL = `http://127.0.0.1:${port}/v1`;
    process.env.GLYPH_UI_STATE_DIR = dir;
    process.env.GLYPH_LOCAL_MIN_FREE_MB = "0";

    // PID-Datei zeigt auf diesen Testprozess (lebt), Startzeit 4 h alt.
    fs.writeFileSync(
      path.join(dir, "local-model.pid"),
      JSON.stringify({
        pid: process.pid,
        startedAt: Date.now() - 4 * 60 * 60 * 1000,
      }),
    );

    // Frische Modulinstanz, damit CFG die Test-Env liest.
    const mod = await import(
      `../../server/localModel.mjs?ownership=${Date.now()}`
    );

    try {
      await mod.localTick(); // Adoption
      assert.equal(mod.localStatus().state, "ready");
      assert.equal(mod.localStatus().pid, process.pid);

      await mod.localTick(); // würde ohne Ownership-Regel max-runtime stoppen
      const st = mod.localStatus();
      assert.equal(st.state, "ready");
      assert.equal(st.lastStopReason, "");
    } finally {
      mod.resetLocalModelState();
      await new Promise((resolve) => fake.close(resolve));
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
