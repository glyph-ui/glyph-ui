/**
 * Routine-Lage für den Plan-Tab (^_tick): Zähler, Job-Ordner, letzter Lauf.
 * Reine Funktionen — der Fetch liegt im Panel.
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */

/** Zähler aus /api/routines/overview, immer Zahlen. */
export function routineCounts(overview) {
  const c = overview?.counts || {};
  const n = (v) => Math.max(0, Number(v) || 0);
  return {
    todosOpen: n(c.todos_active),
    todosPaused: n(c.todos_paused),
    todosDue: n(c.todos_due),
    tasksOpen: n(c.tasks_open),
    daily: n(c.jobs_daily),
    inbox: n(c.jobs_inbox),
    blocked: n(c.jobs_blocked),
    done: n(c.jobs_done),
  };
}

/** Vier Kacheln für den Kopf der Routine-Lage. */
export function routineTiles(overview) {
  const n = routineCounts(overview);
  return [
    {
      id: "todos",
      label: "Offene To-dos",
      value: n.todosOpen,
      detail: n.todosPaused ? `${n.todosPaused} pausiert` : "keine pausiert",
      tone: "",
    },
    {
      id: "tasks",
      label: "Offene Aufgaben",
      value: n.tasksOpen,
      detail: n.tasksOpen ? "im Plan" : "keine",
      tone: "",
    },
    {
      id: "jobs",
      label: "Job-Ordner",
      value: n.daily + n.inbox,
      detail: `Daily ${n.daily} · Inbox ${n.inbox}`,
      tone: "",
    },
    {
      id: "blocked",
      label: "Blockiert",
      value: n.blocked,
      detail: n.blocked ? "braucht Entscheidung" : "nichts offen",
      tone: n.blocked ? "warn" : "",
    },
  ];
}

/** Job-Dateien aus Daily/Inbox/Blocked in Abarbeitungs-Reihenfolge. */
export function routineJobList(overview, limit = 6) {
  const boxes = overview?.job_boxes || {};
  const rows = [];
  for (const box of ["Daily", "Inbox", "Blocked"]) {
    for (const file of boxes[box]?.files || []) {
      rows.push({
        box,
        name: String(file?.name || "").slice(0, 120),
        date: String(file?.date || ""),
        head: String(file?.head || "").slice(0, 120),
      });
    }
  }
  const cap = Math.max(1, Number(limit) || 6);
  return rows.slice(0, cap);
}

/** Jüngster Lauf aus dem Eventlog — oder null. */
export function routineLastRun(overview) {
  const runs = Array.isArray(overview?.last_runs) ? overview.last_runs : [];
  const first = runs[0];
  if (!first) return null;
  return {
    title: String(first.title || first.id || "Lauf"),
    ok: first.ok !== false,
    ts: String(first.ts || ""),
    preview: String(first.preview || "").slice(0, 160),
  };
}

/** Text, den der Composer als Abarbeitungs-Auftrag bekommt. */
export function routineRunPrompt() {
  return (
    "Arbeite die Routinen ab: erst Daily/, dann Inbox/ nach Datum. " +
    "Pro Job Ziel und Randbedingungen, Plan, Liste der Änderungen — dann ausführen, " +
    "gegen den Plan prüfen und ins Laufprotokoll schreiben. Erledigte Inbox-Jobs nach Done/."
  );
}

/** Text für „Was liegt an?“ — Zahlenfrage ohne Lauf. */
export function routineStatusPrompt() {
  return (
    "Zeige mir die Routine-Lage: Anzahl offener To-dos (aktiv/pausiert/fällig), " +
    "Anzahl offener Aufgaben und die Job-Dateien in Daily/, Inbox/ und Blocked/."
  );
}
