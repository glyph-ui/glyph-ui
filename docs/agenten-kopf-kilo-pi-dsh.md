# Dritter Kopf: Kilo Code, Pi oder DeepSeek Harness?

**Stand:** 2026-10-17 · **Auftrag:** prüfen, nicht einrichten · **Gegenstand:** `^_tick` durch Kilo Code oder Pi ersetzen, „vollwertig wie Grok oder Harness"; Vergleich mit DSH.

## 0 · Kurzfassung

| Kandidat | ACP heute? | Aufwand bis „läuft in Glyph" | Urteil |
|---|---|---|---|
| **Kilo Code** | **Ja, nativ** (`kilo acp`, ACP v1) | **Tage** (Profil + Feinschliff) | Bester Fremd-Kopf; reichste Oberfläche, eigenes Modell-/Auth-Universum |
| **Pi** | **Nein** (3 ACP-PRs abgelehnt) | **Wochen** (eigener RPC→ACP-Adapter) | Nur mit eigenem Adapter sinnvoll; **kein** Permission-System |
| **DSH** | **Ja, nativ** (`dsh --profile acp`, „automation-only") | **Tage**, aber CLI-Zugang offen | Nächster „Harness"-Begriff; bewusst ohne Plan/Todo/Terminal |

**Kernaussage:** Kilo und DSH sind heute echte ACP-Server und damit technisch als Kopf tauglich. Pi ist es nicht — dafür bräuchte es einen selbst gebauten Adapter. Alle drei bringen ihre **eigene Welt** mit (Modelle, Auth, Konfiguration, Rechte); Glyphs Governance (Workspaces, Vaults, Grants, Routinen) gilt für sie **nicht**. Und: `^_tick` ist seit dem letzten Schritt der **Routine-Kopf** — wer ihn ersetzt, gibt die Routine-Fläche auf oder muss sie verlegen.

---

## 1 · Was „vollwertiger Kopf" in Glyph konkret heißt

Glyph ist ACP-Client; ein Kopf ist ein ACP-Server über stdio. Der Vertrag, den die UI tatsächlich nutzt ([server/index.js](server/index.js)):

| Baustein | Was Glyph erwartet | Pflicht? |
|---|---|---|
| `initialize` | Protokoll v1, `agentInfo`, Capabilities; optional `authMethods` | ja |
| `authenticate` | wird bei vorhandenen `authMethods` **automatisch** aufgerufen | nur wenn angeboten |
| `session/new` | `cwd`, `mcpServers: []`, `_meta.yoloMode` | ja |
| `session/prompt` | Text-, Resource-, Embedded- und Bild-Blöcke; `_meta.glyph` | ja |
| `session/update` | `agent_message_chunk`, `agent_thought_chunk`, `tool_call(_update)`, `plan`, `available_commands_update` | Streaming ja, Rest optional |
| `requestPermission` | Dialog mit den Optionen des Agenten | für Schreib-/Shell-Aktionen |
| `session/cancel` | Abbruch | ja |
| `session/load` | Wiederaufnehmen | optional (`loadSession`) |
| `session/fork`, `session.history`, `session.rewind` | Fork/Verlauf/Rewind | optional, Graceful-Fail |

**Wichtig:** Die Kabelsalat-Rechte (`r`/`r+w`/🔒), Vault-Allowlists, Grants (Einmal/Auftrag/Task) und der Routine-Ordner leben **in glyph-agent**, nicht im UI. Ein fremder Agent führt seine Datei- und Shell-Aktionen mit **seinen** Regeln aus. Glyph kann Rechte anzeigen und Freigaben einholen — aber nicht erzwingen, was der Agent nicht fragt.

---

## 2 · Kilo Code

**Form:** Kilo Code 7.x ist ein OpenCode-Fork (MIT, Copyright 2026 Kilo Code / 2025 opencode). VS-Code- und JetBrains-Extension, CLI (`@kilocode/cli`, Binaries `kilo`/`kilocode`), Desktop-Beta, Cloud/Web. CLI 7.8.12 (npm) / 7.8.14 (GitHub, 16.10.2026).

**ACP — erster Klasse:**
- Start: `kilo acp` (bzw. `npx @kilocode/cli@7.8.12 acp`), NDJSON-JSON-RPC über stdio; der Prozess startet intern zusätzlich einen Loopback-HTTP-Server.
- `initialize`: `protocolVersion: 1`, `loadSession: true`, `promptCapabilities {image, embeddedContext}`, `mcpCapabilities {http,sse}`, `sessionCapabilities {list,resume,close,fork}`, `authMethods [{id:"kilo-login"}]`.
- Methoden: `session/new|load|list|resume|close`, `unstable_forkSession`, `session/set_mode`, `session/set_config_option`, `unstable_setSessionModel`, `session/prompt`, `session/cancel`.
- `session/new` liefert **Config-Options** für Modell, Effort und Modus → als Selects darstellbar.
- Updates: `agent_message_chunk`, `agent_thought_chunk`, `tool_call(_update)`, `available_commands_update`, `usage_update` (Tokens + Kosten).
- **Keine** `plan`-Updates (Todos), **kein** Checkpoint/Revert über ACP.
- Permissions: `permission.asked` → `requestPermission` mit **once / always / reject**; Edits kommen als **diff**-Content → Glyphs ToolCard rendert Diffs bereits.
- **Harte Kante:** Implementiert der Client `requestPermission` nicht, wird **jede** Freigabe still mit `reject` beantwortet. Glyph hat den Dialog — also ok.
- Auth: `authenticate` ist ein **No-op**; Login nur über `kilo auth login` (oder `KILO_API_KEY`), Credentials in `~/.config/kilo/auth.json`.

**Was Glyph selbst bauen müsste:** Profil-Eintrag, `profileHeadId`-Mapping (`code`), Capability-Flags, Bindings-Behandlung (Kilo ist „extern konfiguriert"), **dynamisches Profil-Label im Freigabe-Dialog** (heute steht dort fest „Profil ^_tick"), deutsche Labels für die drei Permission-Optionen (once/always/reject), **Fork-Methodenname** (Glyph ruft `session/fork`, Kilo bietet `unstable_forkSession`), ggf. Modell-/Effort-Selects aus `configOptions`, und — falls gewünscht — eine **Session-Lupe für Kilo** (Kilo liefert `session/list`; Glyphs Lupe liest heute nur `~/.grok/sessions`). Geschätzt **1–2 Tage bis First Light, ~1 Woche bis solide** (eigene Schätzung).

**Risiken:** Kilo ist im Umbruch (V1 `main` vs. `kilo-v2`-Portierung mit neuem ACP-Paket, inkompatible Config/DB), sehr hohe Release-Frequenz (7.8.12 → 7.8.14 in ~1 Tag), 648 offene Issues, Eigentümerwechsel (Anaconda, 15.07.2026). Mit Kilo-Gateway laufen Prompts über OpenRouter in die USA; BYOK/lokal vermeidet das. Die Marketplace-Angabe „Apache-2.0" ist für 7.x **falsch** (MIT).

---

## 3 · Pi

**Form:** Pi (heute `earendil-works/pi`, npm `@earendil-works/pi-coding-agent` 1.3.0, MIT) ist ein minimales, erweiterbares Terminal-Harness mit TUI, RPC-, JSON- und SDK-Modus. Keine offizielle Web-/Desktop-UI.

**ACP — nicht vorhanden.** Drei Anläufe (`--mode acp`) wurden ohne Merge geschlossen ([#836](https://github.com/earendil-works/pi/pull/836), [#241](https://github.com/earendil-works/pi/pull/241), Issues #10389/#10496). Einziger Pfad ist der Community-Adapter [`pi-acp`](https://github.com/svkozak/pi-acp) (0.0.34, **vor** Pi 1.0 veröffentlicht, ACP-SDK 0.26 gegen aktuell 1.9, 88 offene Issues, „expect minor breaking changes").

**Die zwei harten Lücken:**
1. **Kein Permission-System.** Pi fragt vor Tool-Calls nicht; `pi-acp` nutzt `requestPermission` nur für Extension-UI-Dialoge, nicht für Datei-/Shell-Aktionen. In Glyph würde also **nichts** freigefragt.
2. **Kein ACP-Denkstrom, kein MCP-Durchreichen, kein Fork/List.** `session/load` gibt es; Thought-Stream, MCP und Session-Liste nicht.

**Eigener Adapter (empfohlen, falls Pi):** Pi-RPC ist gut dokumentiert (JSONL, ~35 Commands, Event-Stream, `extension_ui confirm` als Permission-Haken, Session-Baum). Aufwand **1,5–3 Wochen Beta, 3–5 Wochen Parität** (Schätzung des Recherche-Reports; nicht belegt).

**Was Pi dafür bietet:** breiteste Provider-/OAuth-Abdeckung (inkl. Abo-Logins), sehr kleine, hackbare Runtime, SDK, exakt gepinnte Supply Chain, MIT. **Was fehlt:** Subagenten und Plan-Modus sind laut Hersteller **absichtlich** nicht eingebaut; Sandbox nur über Container/VM.

---

## 4 · DeepSeek Harness (DSH)

**Form:** Harness mit Agent-Runtime, Web-GUI, Tools, Skills, Subagenten/Workflows, Approvals, Sandbox — und einem **eigenen ACP-Server**.

**Belegt aus der lokalen Installation** (`app.asar`, Paket `@deepseek-ai/dsh-acp` 0.2.1-rc.2, ACP-SDK 1.4.0, MIT): „Automation-only ACP server for driving DeepSeek Harness agents over JSON-RPC stdio". Start: `dsh --profile acp`.

| Bereich | DSH-ACP |
|---|---|
| Protokoll | ACP v1, stdio |
| Sessions | `new`, `list`, `resume`, `close` (persistent, prozessübergreifend) |
| Modell | `session/set_config_option` für `model` + `reasoning_effort` |
| Bilder | ja, wenn Route + Attachment-Store es tragen |
| MCP | stdio + Streamable HTTP (Client) |
| Permissions | `session/request_permission` — **einmalig allow/reject** |
| Subagenten | **ja** — Descendants laufen mit, Settlement wartet auf sie |
| Fehlt bewusst | `session/load`, Fork, Löschen, zusätzliche Verzeichnisse, **Plans/Todos**, Commands, Terminals, Client-Dateisystem, Elicitation, Modi |
| Auth | keine (trusted client) |
| Modell-Route | konfigurierbar, Default `deepseek-official` / `deepseek-v4-flash` |

**Einordnung:** DSH-ACP ist der **nächste „Harness"-Begriff** von allen dreien (Subagenten, persistente Sessions, MCP, Approval) — aber bewusst **ohne** die menschliche Präsentationsschicht (Pläne, Todos, Titel, Terminals). Als *menschlicher* Coding-Kopf in Glyph wäre es dünner als Kilo; als **Orchestrierungs-Kopf** (Subagenten) ist es stärker.

**Offener Punkt:** In der Desktop-Installation liegt der ACP-Server als Paket, aber **kein globales `dsh`-Binary** (`runtime/bin` enthält nur Node). Für einen Glyph-Kopf müsste der ACP-Profilstart bereitgestellt werden (CLI-Installation oder App-Integration) — das ist eine kleine, aber echte Lücke.

---

## 5 · Vergleich

| Kriterium | **Kilo Code** | **Pi** | **DSH (acp)** | Status quo **Grok** | Status quo **^_tick** |
|---|---|---|---|---|---|
| ACP nativ | ✅ v1 | ❌ (Community-Adapter) | ✅ v1 | ✅ (proprietär) | ✅ (Bridge) |
| Streaming/Thoughts | ✅ / ✅ | ✅ / ❌ | ✅ / ✅ | ✅ | ✅ |
| Tool-Diffs | ✅ | ⚠️ nur Adapter | ⚠️ generisch | ✅ | ✅ |
| Permissions | once/always/reject | ❌ keine | once/reject | always-approve | Einmal/Auftrag/Task |
| Session list/load/fork | ✅/✅/⚠️ unstable | ❌/✅/❌ | ✅/❌/❌ | ✅/—/✅ | ✅/—/✅ |
| *in Glyph sichtbar* | list/fork erst nach UI-Arbeit | list/fork nein | list ja, fork nein | ja (Lupe) | ja |
| Bilder | ✅ | ✅ | ⚠️ bedingt | ✅ | ✅ |
| MCP | Client (lokal/HTTP) | Client (nicht durchgereicht) | Client (stdio/HTTP) | ? | — |
| Modelle/Auth | 500+, BYOK/Gateway | sehr breit, OAuth/BYOK | DSH-Provider (DeepSeek) | Grok/OAuth | Direct/Router |
| Plans/Todos in Glyph | ❌ | ❌ | ❌ | ❌ | ✅ (Plan-Lage) |
| Glyph-Governance | ❌ | ❌ | ❌ | ❌ | ✅ |
| Routinen | ❌ | ❌ | ❌ | ❌ | ✅ |
| Aufwand | Tage | Wochen | Tage (+CLI-Zugang) | — | — |
| Lizenz | MIT | MIT | MIT | proprietär | MIT |
| Datenpfad | BYOK/lokal oder Kilo-Gateway (USA) | Provider/BYOK, kein Telemetrie-Backend | DeepSeek/Provider | xAI | Direct/Router |

---

## 6 · Dafür / Dagegen

**Kilo Code**
- **Dafür:** native ACP-Reife (Registry, Zed, eigene Tests), reichste Coding-Oberfläche, Modellvielfalt, MCP, Modi, Session-Liste/Fork/Resume, Diff-Content, Usage/Kosten — und in Tagen integriert.
- **Dagegen:** eigene Welt (Auth/Config/Modelle) außerhalb Glyphs Anbindung; Governance und Routinen weg; V1/V2-Umbruch; hohe Release-Frequenz; Vendor-Cloud als wirtschaftlicher Anreiz; keine Plan-/Todo-Sicht in Glyph.

**Pi**
- **Dafür:** MIT, minimal, SDK/RPC, breiteste Provider-/OAuth-Abdeckung, volle Kontrolle über einen eigenen Adapter, keine Vendor-Cloud nötig.
- **Dagegen:** **kein** ACP, **kein** Permission-System, Adapter = Wochen, Community-Adapter zu alt/zu dünn, keine Subagenten/Plan-Modus, MCP nicht durchgereicht, Thought-Stream fehlt.

**DSH**
- **Dafür:** nativer ACP-Server, Harness-Fähigkeiten (Subagenten, persistente Sessions, MCP, Approval), MIT, DeepSeek-Routen, gleiche Protokollversion wie Glyph.
- **Dagegen:** „automation-only" — keine Pläne/Todos/Terminals/Elicitation, kein Fork/Load; GUI-Dopplung; Start über `dsh --profile acp` in der Desktop-Installation nicht exponiert; Modellwelt = DSH-Provider.

---

## 7 · Fenster: was sich öffnet und schließt

**Öffnet (Kilo):** Modellvielfalt (500+), MCP-Ökosystem, Agent-Modi, Session-Liste/Fork/Resume, Diff-Vorschauen, Checkpoints in Kilo selbst, schnelle Integration, ACP-registry-getestet.
**Schließt (Kilo):** Glyph-Governance (Workspaces/Vaults/Grants), einheitliche Anbindung, Routine-Besitz, Plan/Todo in Glyph, Web-Sitz, Wartungs-Einfachheit, deutsche Freigabe-Labels.

**Öffnet (Pi):** Provider-/Abo-Auth, Minimalismus, Erweiterbarkeit, volle Adapter-Kontrolle.
**Schließt (Pi):** Freigaben (keine), MCP, Thought-Stream, Session-Liste/Fork, Wochen an Arbeit, Sicherheitsmodell.

**Öffnet (DSH):** Subagenten/Descendants, persistente Sessions über Neustarts, MCP, Approval, DeepSeek-Routen, native ACP-Anbindung.
**Schließt (DSH):** Pläne/Todos/Terminals/Elicitation, Fork/Load, menschliche Präsentation, GUI-Dopplung, sofortiger CLI-Start.

**Bleibt geschlossen (alle):** Web-Sitz (`agentAllowedOnSeat` erlaubt dort nur °_Agent), Glyph-Grants, Vault-Allowlists, Routine-Werkzeuge.

---

## 8 · Empfehlung

1. **`^_tick` nicht ersetzen.** Er ist seit dem letzten Schritt der Routine-Kopf (Job-Ordner, `RoutineOverview/Set/Run`, Plan-Lage). Ein Ersatz würde diese Fläche entweder löschen oder nach °_Agent verlagern müssen — beides ist teurer als ein zusätzliches Profil.
2. **Wenn ein Fremd-Kopf, dann Kilo als viertes Profil**, gemappt auf den Graph-Kopf `code` (kein vierter Kabelsalat-Kopf nötig). Erste Stufe: Profil + Capability-Flags + „extern konfiguriert"-Hinweis + deutsche Permission-Labels; Version pinnen. Das ist in **1–2 Tagen** testbar und reversibel.
3. **Pi nur mit eigenem Adapter** und nur, wenn du gezielt Pi's Provider-/Abo-Auth oder Minimalismus willst. Rechne mit Wochen und baue das Permission-Gate selbst.
4. **DSH als Kopf** ist technisch am nächsten an „Harness" und günstig — aber „automation-only": ohne Pläne/Todos/Terminals. Interessant als **Orchestrierungs-Kopf** (Subagenten), nicht als Ersatz für einen menschlichen Coding-Kopf. Vorher den ACP-Profilstart aus der Desktop-Installation bereitstellen.
5. **Für jeden Fremd-Kopf dokumentieren:** Kabelsalat-Rechte, Grants und Routinen gelten dort **nicht**. Entweder akzeptieren (wie bei Grok) oder einen Sandbox-Wrapper bauen — Letzteres ist ein eigenes Projekt.

**Nächster konkreter Test (wenn du willst, ohne Festlegung):** `npx @kilocode/cli@7.8.12 acp` gegen den Glyph-Dev-Server, dann `initialize` → `session/new` → ein Prompt mit Diff → Freigabe-Dialog. Damit sind Protokollversion, Bilder, Diff-Content und Permission-Mapping in einem Durchlauf geprüft.

---

## 9 · Quellen (Auswahl)

- Kilo: [CLI-Doku](https://kilo.ai/docs/code-with-ai/platforms/cli) · [ACP-Einstieg](https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/cli/cmd/acp.ts) · [ACP-Service](https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/acp/service.ts) · [Permissions](https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/acp/permission.ts) · [Zed-ACP-Seite](https://zed.dev/acp/agent/kilo) · [npm](https://registry.npmjs.org/@kilocode/cli/latest)
- Pi: [Repo](https://github.com/earendil-works/pi) · [RPC](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/rpc.md) · [SDK](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/sdk.md) · [pi-acp](https://github.com/svkozak/pi-acp)
- DSH: lokale Installation `app.asar` → `@deepseek-ai/dsh-acp` (README/`package.json`), `@deepseek-ai/dsh-acp-app`; Start `dsh --profile acp`.
- Glyph: [server/index.js](server/index.js) (ACP-Client), [server/agents.js](server/agents.js), [docs/adr/0006-tick-head.md](docs/adr/0006-tick-head.md).
