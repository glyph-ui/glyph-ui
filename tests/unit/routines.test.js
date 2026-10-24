/**
 * Routine-Lage: Zähler, Kacheln, Job-Liste, Prompts.
 * Copyright (c) 2026 Alexander Hubert · MIT
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  routineCounts,
  routineJobList,
  routineLastRun,
  routineRunPrompt,
  routineStatusPrompt,
  routineTiles,
} from "../../client/src/utils/routines.js";

const overview = {
  ok: true,
  counts: {
    todos_active: 5,
    todos_paused: 2,
    todos_due: 1,
    tasks_open: 3,
    jobs_daily: 2,
    jobs_inbox: 1,
    jobs_blocked: 1,
    jobs_done: 4,
  },
  job_boxes: {
    Daily: {
      count: 2,
      files: [
        { name: "Vault-Eingang.md", date: "2026-10-11", head: "JOB: Vault-Eingang" },
        { name: "Briefing.md", date: "2026-10-10", head: "JOB: Briefing" },
      ],
    },
    Inbox: { count: 1, files: [{ name: "Neu.md", date: "2026-10-11", head: "JOB: Neu" }] },
    Blocked: { count: 1, files: [{ name: "Frage.md", date: "2026-10-09", head: "JOB: Frage" }] },
    Done: { count: 1, files: [{ name: "2026-10-08_Alt.md", date: "2026-10-08", head: "JOB: Alt" }] },
  },
  last_runs: [{ title: "Vault-Inbox Sync", ok: true, ts: "2026-10-11T07:11:00+02:00", preview: "79 neu" }],
};

test("routineCounts", async (t) => {
  await t.test("liest alle Zähler als Zahlen", () => {
    assert.deepEqual(routineCounts(overview), {
      todosOpen: 5,
      todosPaused: 2,
      todosDue: 1,
      tasksOpen: 3,
      daily: 2,
      inbox: 1,
      blocked: 1,
      done: 4,
    });
  });

  await t.test("fehlende Daten werden zu null, nie zu NaN", () => {
    assert.deepEqual(routineCounts(null), {
      todosOpen: 0,
      todosPaused: 0,
      todosDue: 0,
      tasksOpen: 0,
      daily: 0,
      inbox: 0,
      blocked: 0,
      done: 0,
    });
    assert.equal(routineCounts({ counts: { todos_active: "x" } }).todosOpen, 0);
  });
});

test("routineTiles", async (t) => {
  await t.test("vier Kacheln mit Zahlen und Beisatz", () => {
    const tiles = routineTiles(overview);
    assert.deepEqual(
      tiles.map((x) => x.id),
      ["todos", "tasks", "jobs", "blocked"],
    );
    assert.equal(tiles[0].value, 5);
    assert.equal(tiles[0].detail, "2 pausiert");
    assert.equal(tiles[1].value, 3);
    assert.equal(tiles[2].value, 3);
    assert.equal(tiles[2].detail, "Daily 2 · Inbox 1");
    assert.equal(tiles[3].tone, "warn");
  });

  await t.test("ohne Blockierte keine Warnung", () => {
    const tiles = routineTiles({ counts: { jobs_blocked: 0 } });
    assert.equal(tiles[3].value, 0);
    assert.equal(tiles[3].tone, "");
  });
});

test("routineJobList", async (t) => {
  await t.test("Daily vor Inbox vor Blocked, Done bleibt draußen", () => {
    const jobs = routineJobList(overview);
    assert.deepEqual(
      jobs.map((j) => `${j.box}/${j.name}`),
      ["Daily/Vault-Eingang.md", "Daily/Briefing.md", "Inbox/Neu.md", "Blocked/Frage.md"],
    );
  });

  await t.test("Limit greift", () => {
    assert.equal(routineJobList(overview, 2).length, 2);
  });

  await t.test("leere Lage bleibt leer", () => {
    assert.deepEqual(routineJobList({}), []);
  });
});

test("routineLastRun", async (t) => {
  await t.test("jüngster Lauf mit Status", () => {
    assert.deepEqual(routineLastRun(overview), {
      title: "Vault-Inbox Sync",
      ok: true,
      ts: "2026-10-11T07:11:00+02:00",
      preview: "79 neu",
    });
  });

  await t.test("Fehler wird als ok=false geführt", () => {
    const run = routineLastRun({ last_runs: [{ id: "td-x", ok: false }] });
    assert.equal(run.title, "td-x");
    assert.equal(run.ok, false);
  });

  await t.test("ohne Läufe null", () => {
    assert.equal(routineLastRun({}), null);
  });
});

test("Prompts", async (t) => {
  await t.test("Abarbeitungs-Auftrag nennt Reihenfolge und Protokoll", () => {
    const p = routineRunPrompt();
    assert.match(p, /Daily\//);
    assert.match(p, /Inbox\//);
    assert.match(p, /Laufprotokoll/);
  });

  await t.test("Lage-Auftrag fragt nach Zahlen, nicht nach einem Lauf", () => {
    const p = routineStatusPrompt();
    assert.match(p, /Anzahl/);
    assert.ok(!/Arbeite die Routinen ab/.test(p));
  });
});
