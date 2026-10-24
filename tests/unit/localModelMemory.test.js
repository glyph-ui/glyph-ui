/**
 * Speicher-Bremse: die Messung muss auf macOS brauchbare Werte liefern.
 * `os.freemem()` tut das nicht (zählt nur komplett freie Seiten, meist nahe 0),
 * deshalb liest die Brücke `vm_stat`. Fällt die Messung aus, greift die Bremse
 * nie — dann friert der Rechner wieder ein.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  readAvailableMb,
  localStatus,
  localStop,
  resetLocalModelState,
} from "../../server/localModel.mjs";

describe("readAvailableMb", () => {
  it("liefert einen plausiblen Wert in MB (macOS) bzw. null (andere OS)", async () => {
    const mb = await readAvailableMb();
    if (process.platform !== "darwin") {
      // vm_stat gibt es nur auf macOS — die Bremse meldet sich als
      // "unavailable", statt einen falschen Wert zu liefern.
      assert.equal(mb, null);
      return;
    }
    assert.equal(typeof mb, "number");
    assert.ok(mb > 0, `erwartet > 0, war ${mb}`);
    // Kein Rechner hat weniger als 50 MB oder mehr als 1 TB zurückholbar.
    assert.ok(mb > 50 && mb < 1024 * 1024, `unplausibel: ${mb} MB`);
  });
});

describe("localStatus", () => {
  beforeEach(() => resetLocalModelState());

  it("meldet die Speicher-Bremse als nicht messbar, wenn noch kein Sample vorliegt", () => {
    const st = localStatus();
    assert.equal(st.state, "sleeping");
    assert.equal(st.memoryBrake, "unavailable");
    assert.equal(st.availableMb, null);
  });

  it("normales Schlafen ist kein Fehlerzustand", async () => {
    const st = await localStop({ reason: "manual" });
    assert.equal(st.state, "sleeping");
    assert.equal(st.lastStopReason, "manual");
    assert.equal(st.lastError, "");
    assert.equal(st.pid, 0);
  });
});
