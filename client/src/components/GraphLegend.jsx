/**
 * Graph dock — toolbox: status, set/replace/clear, quiet rights.
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */
import { useEffect, useState } from "react";
import { bindsOf } from "../utils/lageLayout.js";
import { ModeGlyph } from "./ModeGlyph.jsx";
import { AnbindungSheet } from "./AnbindungSheet.jsx";

const HEAD_ROWS = [
  { id: "grok", label: "Grok Build", write: true },
  { id: "agent", label: "°_Agent", write: true },
  { id: "code", label: "^_tick", write: true },
];

function modeWordOf(binds) {
  const parts = [];
  for (const h of HEAD_ROWS) {
    const m = binds?.[h.id];
    if (!m || m === "unbound") continue;
    const right =
      m === "private" ? "privat" : m === "rw" ? "schreiben" : "lesen";
    parts.push(`${h.label} ${right}`);
  }
  return parts.join(" · ");
}

function shortPath(p) {
  const s = String(p || "");
  if (s.startsWith("/Users/")) {
    const slash = s.indexOf("/", 7);
    if (slash > 0) return `~${s.slice(slash)}`;
  }
  return s;
}

export function GraphLegend({
  absorb,
  selected,
  state,
  neighbors = [],
  onPick,
  grok,
  bindings,
  onBindingsChange,
  vaults,
  workspaces,
  busy,
  pendingDetach,
  setPendingDetach,
  openBind = false,
}) {
  const item = state?.item;
  const hook = selected?.kind === "workspace" ? workspaces : vaults;
  const title = item
    ? state?.label || selected?.label
    : absorb === "grok"
      ? "Grok Build"
      : absorb === "agent"
        ? "°_Agent"
        : absorb === "code"
          ? "^_Code"
          : "Glyph";
  const kindWord = state?.kindWord || "";
  const binds = item ? bindsOf(item, selected?.kind) : state?.binds;
  const modeWord = item
    ? modeWordOf(binds) || "ungebunden"
    : state?.live
      ? "verbunden"
      : "";
  const canBind = (absorb === "agent" || absorb === "code") && !item;
  const [bindOpen, setBindOpen] = useState(Boolean(openBind && canBind));

  useEffect(() => {
    setBindOpen(Boolean(openBind && canBind));
  }, [openBind, canBind, absorb, item?.id]);

  return (
    <div className={`lage-dock-card${bindOpen && canBind ? " is-bind-sheet" : ""}`}>
      <p className="lage-kicker">{kindWord || "Legende"}</p>
      <h3 title={title}>
        {state?.primary ? "★ " : ""}
        {title}
      </h3>
      {modeWord ? <p className="lage-fact">{modeWord}</p> : null}

      {bindOpen && canBind ? (
        <div className="lage-bind-sheet">
          <button
            type="button"
            className="lage-link"
            onClick={() => setBindOpen(false)}
          >
            Zurück
          </button>
          <AnbindungSheet
            absorb={absorb}
            bindings={bindings}
            onBindingsChange={onBindingsChange}
          />
        </div>
      ) : (
        <>
          {neighbors.length ? (
            <ul className="lage-deps">
              {neighbors.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="lage-link"
                    onClick={() => onPick?.(n.id)}
                  >
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {!absorb && !item ? (
            <p className="lage-lede">
              Kopf in die Mitte. Solid = schreiben, Strich = lesen, Punkte =
              privat.
            </p>
          ) : null}

          {absorb === "grok" && !item ? <GrokBind grok={grok} /> : null}

          {canBind ? (
            <button
              type="button"
              className="lage-link lage-bind-open"
              onClick={() => setBindOpen(true)}
            >
              Anbindung
            </button>
          ) : null}

          {item ? (
            <ResourceTools
              item={item}
              kind={selected?.kind || "vault"}
              hook={hook}
              busy={busy}
              pendingDetach={pendingDetach}
              setPendingDetach={setPendingDetach}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function GrokBind({ grok }) {
  const oauth = grok?.checks?.find((c) => c.id === "oauth");
  const bin = grok?.checks?.find((c) => c.id === "bin");
  const ok = Boolean(oauth?.ok);
  return (
    <div className="lage-bind">
      <p className={`lage-fact${ok ? "" : " is-off"}`}>
        {ok ? "OAuth steht." : "OAuth fehlt."}
      </p>
      <p className="lage-lede">
        Fest. Nur Terminal: <code>grok login</code>
        {bin?.ok ? "." : " — CLI nicht im PATH."}
      </p>
    </div>
  );
}

function ResourceTools({
  item,
  kind,
  hook,
  busy,
  pendingDetach,
  setPendingDetach,
}) {
  const on = item.enabled !== false;
  const binds = bindsOf(item, kind);
  return (
    <>
      <p className="lage-path" title={item.path}>
        {shortPath(item.path)}
      </p>
      <div className="lage-heads" aria-label="Anbindung">
        {HEAD_ROWS.map((head) => {
          const cur = binds[head.id] || "unbound";
          const modes = [
            { mode: "r", word: "Lesen" },
            ...(head.write ? [{ mode: "rw", word: "Schreiben" }] : []),
            { mode: "private", word: "Privat" },
            { mode: "unbound", word: "Weg" },
          ];
          return (
            <div key={head.id} className="lage-head-row">
              <span className="lage-head-name">{head.label}</span>
              <div
                className={`lage-head-modes${head.write ? "" : " is-three"}`}
                role="radiogroup"
                aria-label={`${head.label} Rechte`}
              >
                {modes.map((row) => {
                  const active = cur === row.mode;
                  return (
                    <button
                      key={row.mode}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`lage-right${active ? " is-on" : ""}`}
                      disabled={busy || active}
                      title={row.word}
                      onClick={() =>
                        void hook.patch(item.id, {
                          heads: { [head.id]: row.mode },
                        })
                      }
                    >
                      {row.mode === "unbound" ? (
                        <span className="lage-right-mark">–</span>
                      ) : (
                        <ModeGlyph mode={row.mode} kind={kind} size={16} />
                      )}
                      <span>{row.word}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="lage-rights lage-rights--tools" role="group" aria-label="Ordner">
        <button
          type="button"
          className={`lage-right${item.primary ? " is-on" : ""}`}
          disabled={busy || item.primary}
          title="Zuerst nehmen"
          onClick={() => void hook.patch(item.id, { primary: true })}
        >
          <span className="lage-right-mark">★</span>
          <span>Zuerst</span>
        </button>
        <button
          type="button"
          className={`lage-right${!on ? " is-on" : ""}`}
          disabled={busy}
          title={on ? "Am Graph, aber stumm" : "Wieder verbinden"}
          onClick={() => void hook.patch(item.id, { enabled: !on })}
        >
          <span>{on ? "Aus" : "An"}</span>
        </button>
        {item.obsidian_uri ? (
          <a
            className="lage-right"
            href={item.obsidian_uri}
            title="Im Vault öffnen"
          >
            <span>Öffnen</span>
          </a>
        ) : (
          <span className="lage-right is-empty" aria-hidden="true" />
        )}
        <button
          type="button"
          className="lage-right is-danger"
          disabled={busy}
          title="Vom Graph nehmen"
          onClick={() => setPendingDetach(item.id)}
        >
          <span>Entfernen</span>
        </button>
      </div>
      {pendingDetach === item.id ? (
        <p className="lage-confirm">
          <span>Diesen Ordner vom Graph nehmen?</span>
          <button
            type="button"
            className="lage-link is-danger"
            disabled={busy}
            onClick={() => {
              void hook.detach(item.id);
              setPendingDetach(null);
            }}
          >
            Entfernen
          </button>
          <button
            type="button"
            className="lage-link"
            onClick={() => setPendingDetach(null)}
          >
            Bleibt
          </button>
        </p>
      ) : null}
      {item.pins?.length ? (
        <ul className="lage-pins">
          {item.pins.map((p) => (
            <li key={p.path}>{p.label || p.path}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
