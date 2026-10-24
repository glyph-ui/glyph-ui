# 0006 · ^_tick als Routine-Kopf (Nachfolger ^_Code)

`^_tick` (id `_tick`, Engine-Modus `tick`) ersetzt `^_Code` als Code- und Routine-Kopf. Er erbt die Code-Fähigkeiten der Engine (Workspace-Tools, Write/Shell mit Freigabe, Vault-Lesen/-Schreiben nach Graph-Recht) und besitzt zusätzlich die tägliche Arbeit: den Job-Ordner `memory-wiki/Routinen/` (Daily/Inbox/Blocked/Done/Log) und Plan & Aktivität (wiederkehrende To-dos + Aufgaben). Ein Kopf, nicht zwei.

## Considered

- **Zweiter Kopf neben ^_Code** (`_code` + `_tick`) — abgelehnt: zwei Profile mit denselben Werkzeugen, zwei Freigabe-Wege, doppelte Doku. Der Nutzer will einen Nachfolger.
- **Kopf-id `code` in `heads` umbenennen** (`vaults.json`/`workspaces.json` → `heads.tick`) — abgelehnt: die Rechte-Kanten liegen real als `heads.code` auf Platte; eine Umbenennung verwaisen lässt alle Anbindungen, ohne Gewinn. Der Graph-Kopf heißt weiter `code`, nur das Profil heißt `_tick`.
- **Modell-Kanal `code` mit umbenennen** (`models.code`, `codeProvider`, `kind:"code"`, `/api/code/grants`) — abgelehnt: das ist das Engine-Protokoll, nicht der Kopf-Name. `_tick` fährt weiter über den Code-Kanal (DeepSeek V4 Flash).
- **Neuer Modus `tick` als eigener Provider-Pfad** in `llm.py`/`factory.py`/`runtime_models.py` — abgelehnt: `tick` ist ein Alias des Code-Kanals (`get_provider("code")`); nur Rolle, Werkzeugliste und Job-Ordner unterscheiden sich.
- **Trockenlauf-Schalter (TROCKENLAUF/SCHARF)** — abgelehnt: der Nutzer will direkt scharf. Schreiben bleibt ohnehin durch die Grant-Freigaben (Einmal/Auftrag/Task) gedeckelt; das Laufprotokoll macht jeden Lauf nachvollziehbar.
- **Jobs als JSON im Engine-Ordner** (`jobs/`) — abgelehnt für die Tagesarbeit: der Zustand soll im Vault sichtbar und auf allen Geräten prüfbar sein.

## Consequences

- Profil-Aliase bleiben: `claude`, `code`, `_code`, `^_Code` → `_tick` (gespeicherte UI-Zustände, `/api/bridge/agent`, laufende Sessions). `heads.code`, `models.code`, `/api/code/grants` und `code_grants` bleiben unverändert.
- Engine: `GLYPH_AGENT_MODE=tick` → `code_loop.run_code(head="tick")` mit `tick_role()`; Werkzeuge `RoutineOverview` · `RoutineJobs` · `RoutineRead` · `RoutineJobWrite` · `RoutineMove` · `RoutineLog` · `RoutinePlan` · `RoutineSet` · `RoutineRun`. Modus in `/health` sichtbar (`modes`).
- **Eigene Fläche statt Chat-Rätsel:** `GET /routines/overview` (Engine) liefert Zähler und Job-Ordner; die UI proxyt über `/api/routines/overview` und der Plan-Tab zeigt für die Capability `routines` die Routine-Lage. Ohne diese Fläche sähe ^_tick aus wie °_Agent — genau die Beschwerde, die dieses ADR auslöst.
- Freigabe-Policy: eigene Ordnerarbeit (`RoutineLog`, `RoutineMove`, Lesen) läuft ohne Popup; Auftrags-/Plan-Änderungen (`RoutineJobWrite`, `RoutineSet`, `RoutineRun`) brauchen eine Freigabe.
- Job-Ordner: `memory-wiki/Routinen/` mit `AGENTS.md` als Vertrag. `^_tick` verschiebt erledigte Inbox-Jobs nach `Done/` (Datum im Namen), Unklares nach `Blocked/` mit genau einer Frage, und schreibt ein Laufprotokoll nach `Log/YYYY-MM-DD_HHMM.md`.
- Plan & Aktivität bleibt **eine** Wahrheit (`jobs/recurring.json`, `~/.glyph/tasks.json`); `^_tick` schreibt nie die JSON per Hand, sondern über `RoutineSet`/`RoutineRun`. Die UI zeigt den aktiven Kopf als Auftraggeber im To-do-Formular (`ownerLabel`).
- Der Modus erbt den Code-Pfad vollständig: Provider, Timeout (`CODE_CHAT_TIMEOUT`), Kontingent-Logik und Freigabe-Schleife (Einmal/Auftrag/Task) gelten unverändert.
