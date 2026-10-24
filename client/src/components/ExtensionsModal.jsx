/**
 * Befehle & Skills — content for the shared right side drawer.
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  isInternalOpsCommand,
  rankCatalog,
  slashItemLabel,
  withoutHiddenAgentCommands,
} from "../utils/slash.js";
import { scrollChildIntoView } from "../utils/scrollChild.js";
import { SideDrawer } from "./SideDrawer.jsx";

/** Unified badge label: SKILL / UI / USER */
function badgeMeta(item) {
  const kind = item?.kind;
  if (kind === "ui") return { label: "UI", cls: "ui" };
  if (kind === "skill") {
    if (item?.source === "user") return { label: "USER", cls: "user" };
    return { label: "SKILL", cls: "skill" };
  }
  // Agent-/command entries → USER (nutzer-/agent-seitig ausführbar)
  return { label: "USER", cls: "user" };
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {Array<{ name: string, description?: string, inputHint?: string, kind?: string, source?: string }>} props.skills
 * @param {Array<{ name: string, description?: string, inputHint?: string }>} props.agentCommands
 * @param {string | null} [props.intro]  fester Erklärungstext über der Liste
 * @param {string | null} [props.skillsHint]
 * @param {boolean} [props.loading]
 * @param {string} [props.error]
 * @param {(item: { name: string, kind: string }, opts?: { close?: boolean }) => void} props.onPick
 * @param {string} [props.initialQuery]  seed filter (e.g. from composer `/query`)
 * @param {"left"|"right"} [props.side]
 * @param {"push"|"overlay"} [props.mode]
 */
function ExtensionsModal({
  open,
  onClose,
  skills = [],
  agentCommands = [],
  skillsHint = null,
  loading = false,
  error = "",
  onPick,
  initialQuery = "",
  side = "right",
  mode = "overlay",
  internalHidden = false,
  intro = null,
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const rowRefs = useRef(new Map());
  const openedRef = useRef(false);

  const skillItems = useMemo(
    () =>
      (skills || [])
        .map((s) => ({
          ...s,
          kind: "skill",
          name: String(s.name || "").replace(/^\//, ""),
        })),
    [skills],
  );

  const commandItems = useMemo(
    () =>
      withoutHiddenAgentCommands(
        (agentCommands || []).map((c) => ({
          ...c,
          kind: c.kind === "ui" ? "ui" : "command",
          name: String(c.name || "").replace(/^\//, ""),
        })),
      ).filter(
        (c) =>
          c.kind !== "ui" &&
          c.action !== "reload" &&
          (!internalHidden || !isInternalOpsCommand(c.name)),
      ),
    [agentCommands, internalHidden],
  );

  // „/“ ist der gewohnte Auslöser — als Filter-Eingabe soll es nichts wegfiltern.
  const normQuery = query.replace(/^[/\s]+/, "");
  const items = useMemo(
    () => rankCatalog(skillItems, commandItems, normQuery),
    [skillItems, commandItems, normQuery],
  );

  const filterEmpty = Boolean(query.trim()) && items.length === 0 && !loading;

  useEffect(() => {
    if (!open) {
      openedRef.current = false;
      return;
    }
    setQuery(String(initialQuery || "").replace(/^[/\s]+/, ""));
    setSelectedIndex(0);
    openedRef.current = true;
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = 0;
    });
    // Seed once per open — further typing stays in the filter field
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialQuery at open
  }, [open]);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedIndex(0);
      return;
    }
    setSelectedIndex((i) => Math.min(Math.max(0, i), items.length - 1));
  }, [items.length, query]);

  useEffect(() => {
    if (!open) return;
    if (openedRef.current) {
      openedRef.current = false;
      return;
    }
    const item = items[selectedIndex];
    if (!item) return;
    const el = rowRefs.current.get(`${item.kind}:${item.name}`);
    scrollChildIntoView(listRef.current, el, { block: "nearest" });
  }, [open, selectedIndex, items]);

  const pick = (item, { close = false } = {}) => {
    if (!item) return;
    const phone =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 640px), (pointer: coarse)").matches;
    const shouldClose = close || phone;
    onPick?.(item, { close: shouldClose });
    if (shouldClose) {
      onClose?.();
      return;
    }
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const selected = items[selectedIndex] || null;

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      kicker="Extensions"
      title="Befehle & Skills"
      className="app-drawer--extensions"
      ariaLabel="Erweiterungen und Befehle"
      initialFocusRef={searchRef}
      side={side}
      mode={mode}
      meta={
        <>
          Auswahl setzt <code>/name</code> ins Eingabefeld — gesendet wird erst
          dort.
        </>
      }
      headExtra={
        <button
          type="button"
          className="ghost extensions-head-zu"
          disabled={!selected}
          title="Ausgewählten Eintrag einfügen und Panel schließen"
          onClick={() => pick(selected, { close: true })}
        >
          Einfügen &amp; zu
        </button>
      }
    >
      {intro ? <p className="overview-hint app-drawer-hint">{intro}</p> : null}
      <p className="overview-hint app-drawer-hint">
        <kbd>↑</kbd> <kbd>↓</kbd> wählen · <kbd>Enter</kbd> einfügen ·{" "}
        <kbd>Esc</kbd> schließen · <kbd>/</kbd> öffnet dieses Panel auch im
        Eingabefeld
      </p>

      <div className="extensions-search-row">
        <input
          ref={searchRef}
          className="overview-search"
          type="search"
          placeholder="Befehl oder Skill suchen …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Befehle und Skills filtern"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelectedIndex((i) =>
                Math.min(i + 1, Math.max(0, items.length - 1)),
              );
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelectedIndex((i) => Math.max(i - 1, 0));
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              pick(items[selectedIndex], { close: e.metaKey || e.ctrlKey });
            }
          }}
        />
      </div>

      {error ? <p className="overview-hint overview-hint--error">{error}</p> : null}
      {loading ? <p className="overview-hint">Skills werden geladen…</p> : null}
      {!loading && skillsHint && skillItems.length === 0 ? (
        <p className="overview-hint">{skillsHint}</p>
      ) : null}

      <div
        ref={listRef}
        className="overview-list extensions-list"
        role="listbox"
        aria-label="Skills und Befehle"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((i) =>
              Math.min(i + 1, Math.max(0, items.length - 1)),
            );
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((i) => Math.max(i - 1, 0));
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            pick(items[selectedIndex], { close: e.metaKey || e.ctrlKey });
          }
        }}
      >
        {filterEmpty ? (
          <div className="extensions-empty">
            <p className="slash-popup-empty">Keine Treffer</p>
            <button
              type="button"
              className="ghost extensions-reset-filter"
              onClick={() => {
                setQuery("");
                requestAnimationFrame(() => searchRef.current?.focus());
              }}
            >
              Filter zurücksetzen
            </button>
          </div>
        ) : items.length === 0 && !loading ? (
          <p className="slash-popup-empty" style={{ padding: 12 }}>
            Keine Einträge
            {commandItems.length === 0
              ? " — Agent-Commands erscheinen nach Verbindung."
              : ""}
          </p>
        ) : (
          items.map((item, i) => {
            const key = `${item.kind}:${item.name}`;
            const isSel = i === selectedIndex;
            const badge = badgeMeta(item);
            return (
              <div
                key={key}
                className={`session-row extensions-row${isSel ? " is-selected" : ""}`}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  className="extensions-row-main"
                  ref={(el) => {
                    if (el) rowRefs.current.set(key, el);
                    else rowRefs.current.delete(key);
                  }}
                  onClick={() => pick(item, { close: false })}
                >
                  <div className="session-main">
                    <div className="extensions-row-title">
                      <code>{slashItemLabel(item)}</code>
                      <span className={`slash-badge slash-badge--${badge.cls}`}>
                        {badge.label}
                      </span>
                      {item.source && item.source !== "user" ? (
                        <span className="extensions-source">{item.source}</span>
                      ) : null}
                    </div>
                    {item.description ? (
                      <p className="session-summary">{item.description}</p>
                    ) : null}
                    {item.inputHint ? (
                      <p className="extensions-hint-line">Args: {item.inputHint}</p>
                    ) : null}
                  </div>
                </button>
                <button
                  type="button"
                  className="ghost extensions-row-zu"
                  title="Einfügen & schließen"
                  aria-label={`${slashItemLabel(item)} einfügen und schließen`}
                  onClick={() => pick(item, { close: true })}
                >
                  Einfügen
                </button>
              </div>
            );
          })
        )}
      </div>
    </SideDrawer>
  );
}

export { ExtensionsModal };
