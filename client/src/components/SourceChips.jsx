/**
 * SourceChips — Quellen einer Antwort als anklickbare Chips.
 *
 * Datenquelle ist der effektive Server-Trace (`trace.sources.vault.files`, vom
 * Agenten mit Pfad/Titel/Art befüllt). Fehlt die Struktur (ältere Antworten),
 * wird auf `items` (Pfad-Strings) zurückgefallen — dann ohne Volltext-Marke.
 *
 * Copyright (c) 2026 Alexander Hubert · SPDX-License-Identifier: MIT
 */
import { buildSourceList, buildWebList } from "../utils/sourceLinks.js";
import { openVaultSource } from "../utils/sourceOpen.js";

function SourceChips({ sources, web, onOpen }) {
  const list = buildSourceList(sources);
  const webs = buildWebList(web);
  if (!list.length && !webs.length) return null;

  const openFile = (f) => {
    if (typeof onOpen === "function") onOpen(f);
    else openVaultSource(f);
  };

  return (
    <div className="source-chips" role="group" aria-label="Quellen" data-testid="source-chips">
      {list.map((f) => (
        <button
          key={f.path}
          type="button"
          className="source-chip"
          title={`${f.path} — öffnen${f.full_text ? " · vollständig gelesen" : ""}${
            f.error ? ` · ${f.error}` : ""
          }`}
          onClick={() => openFile(f)}
        >
          <span className={`source-chip-kind source-chip-kind--${f.kind}`} aria-hidden="true">
            {f.kind === "pdf" ? "PDF" : "MD"}
          </span>
          <span className="source-chip-name">{f.title}</span>
          {f.full_text ? (
            <span className="source-chip-full" title="vollständig gelesen">
              ✓
            </span>
          ) : null}
        </button>
      ))}
      {webs.map((w) => (
        <button
          key={w.url}
          type="button"
          className="source-chip"
          title={`${w.url} — in Glyph öffnen`}
          onClick={() =>
            openFile({ kind: "web", url: w.url, path: w.url, title: w.title })
          }
        >
          <span className="source-chip-kind source-chip-kind--web" aria-hidden="true">
            WEB
          </span>
          <span className="source-chip-name">{w.title}</span>
        </button>
      ))}
    </div>
  );
}

export { SourceChips };
