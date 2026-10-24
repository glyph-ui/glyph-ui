/**
 * Shared side drawer — Skills / Plan / Buch / Suche.
 * Desk: left beside rail (overlay). Web: right overlay; chat recenters in remaining width.
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */
import { useEffect, useId, useRef, useState } from "react";
import { handleDialogTab } from "../utils/focusTrap.js";

/**
 * Stapel offener Panels. Mehrere SideDrawer können gleichzeitig offen sein
 * (z. B. Skills + Quellen-Fenster). Nur das oberste darf Esc/Tab behandeln,
 * sonst schließt ein Escape beide und zwei Fokusfallen kämpfen um Tab.
 */
const drawerStack = [];
function pushDrawer(id) {
  const i = drawerStack.indexOf(id);
  if (i >= 0) drawerStack.splice(i, 1);
  drawerStack.push(id);
}
function popDrawer(id) {
  const i = drawerStack.indexOf(id);
  if (i >= 0) drawerStack.splice(i, 1);
}
function isTopDrawer(id) {
  return drawerStack[drawerStack.length - 1] === id;
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.title
 * @param {string} [props.kicker]
 * @param {import("react").ReactNode} [props.meta]
 * @param {import("react").ReactNode} [props.headExtra]
 * @param {import("react").ReactNode} props.children
 * @param {string} [props.className]  extra class on panel (e.g. extensions / cal)
 * @param {string} [props.ariaLabel]
 * @param {import("react").RefObject<HTMLElement | null>} [props.initialFocusRef]
 * @param {"left"|"right"} [props.side="right"]
 * @param {"push"|"overlay"} [props.mode="overlay"]
 * @param {string} [props.closeLabel="Schließen"]  leer = kein Kopf-Schließen
 * @param {import("react").CSSProperties} [props.style]
 * @param {import("react").ReactNode} [props.gutter]
 */
function SideDrawer({
  open,
  onClose,
  title,
  kicker = "",
  meta = null,
  headExtra = null,
  children,
  className = "",
  ariaLabel,
  initialFocusRef,
  side = "right",
  mode = "overlay",
  closeLabel = "Schließen",
  style,
  gutter = null,
}) {
  const panelRef = useRef(null);
  const titleId = useId();
  const drawerId = titleId;
  const [present, setPresent] = useState(open);
  const [entered, setEntered] = useState(false);
  const sideNorm = side === "left" ? "left" : "right";
  const modeNorm = mode === "push" ? "push" : "overlay";

  useEffect(() => {
    if (open) {
      setPresent(true);
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
      });
      if (reduce) setEntered(true);
      return () => cancelAnimationFrame(id);
    }
    setEntered(false);
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) {
      setPresent(false);
      return undefined;
    }
    const t = window.setTimeout(() => setPresent(false), 200);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || !present) return undefined;
    const phone =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 640px), (pointer: coarse)").matches;
    const focusTarget = phone
      ? panelRef.current
      : initialFocusRef?.current ||
        panelRef.current?.querySelector?.(
          'input:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ) ||
        panelRef.current;
    const id = requestAnimationFrame(() => {
      panelRef.current && (panelRef.current.scrollTop = 0);
      focusTarget?.focus?.({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [open, present, initialFocusRef]);

  useEffect(() => {
    if (!open) return undefined;
    pushDrawer(drawerId);
    const onTab = (e) => {
      if (e.key !== "Tab") return;
      if (!isTopDrawer(drawerId)) return;
      handleDialogTab(panelRef.current, e);
    };
    // Bubble: nested menus (⋯) preventDefault on Esc first
    const onEsc = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (!isTopDrawer(drawerId)) return;
      const t = e.target;
      if (
        t &&
        typeof t.closest === "function" &&
        t.closest(".cal-more-menu, .cal-more-wrap, [role='menu']")
      ) {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose?.();
    };
    window.addEventListener("keydown", onTab, true);
    window.addEventListener("keydown", onEsc, false);
    return () => {
      popDrawer(drawerId);
      window.removeEventListener("keydown", onTab, true);
      window.removeEventListener("keydown", onEsc, false);
    };
  }, [open, onClose, drawerId]);

  if (!present) return null;

  const label = ariaLabel || title;
  const sideClass = `app-drawer--side-${sideNorm}`;
  const modeClass = `app-drawer--mode-${modeNorm}`;

  return (
    <aside
      ref={panelRef}
      className={`app-drawer ${sideClass} ${modeClass}${entered && open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-label={label}
      tabIndex={-1}
      data-drawer-open={open ? "true" : "false"}
      data-drawer-side={sideNorm}
      data-drawer-mode={modeNorm}
      style={style}
    >
      {gutter}
      <header className="app-drawer-head">
        <div className="app-drawer-head-text">
          {kicker ? <p className="overview-kicker">{kicker}</p> : null}
          <h2 id={titleId}>{title}</h2>
          {meta ? <div className="overview-meta app-drawer-meta">{meta}</div> : null}
        </div>
        {(headExtra || closeLabel) ? (
          <div className="overview-head-actions app-drawer-head-actions">
            {headExtra}
            {closeLabel ? (
              <button type="button" className="ghost" onClick={onClose}>
                {closeLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </header>
      <div className="app-drawer-body">{children}</div>
    </aside>
  );
}

export { SideDrawer };
