/**
 * Anbindung: Kabelplan (Profile + Voice) + Liste Direct/Router.
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */
import { useCallback, useEffect, useId, useState } from "react";
import { cablePath } from "../utils/cables.js";
import { GlyphMark } from "./EgyptMarks.jsx";
import { AnbindungSheet } from "./AnbindungSheet.jsx";

/** Agent profiles on the map (full nodes). */
const PROFILE_ORDER = ["grok", "_code", "glyph-agent"];
/** Capability strands (thin nodes). */
const CAPABILITY_ORDER = ["voice"];
const MAP_NODE_ORDER = [...PROFILE_ORDER, ...CAPABILITY_ORDER];

/** Hub + node positions in viewBox 0–100 (for cable SVG). */
const MAP_POS = {
  hub: { x: 50, y: 48 },
  grok: { x: 50, y: 12 },
  _code: { x: 16, y: 82 },
  "glyph-agent": { x: 84, y: 82 },
  /** Thin capability strand — right mid */
  voice: { x: 90, y: 42 },
};

function nodeSlot(id) {
  if (id === "grok") return "grok";
  if (id === "_code") return "code";
  if (id === "glyph-agent") return "agent";
  if (id === "voice") return "voice";
  return "agent";
}

/**
 * @param {{ profiles: Record<string, object>, expandedId: string|null, onToggle: (id: string) => void, loading: boolean }} props
 */
function BindingsMap({ profiles, expandedId, onToggle, loading }) {
  const titleId = useId();

  return (
    <section
      className="bindings-map"
      aria-labelledby={titleId}
      data-loading={loading || undefined}
    >
      <h4 id={titleId} className="bindings-section-title">
        Kabelplan
      </h4>

      <div className="bindings-map-stage">
        <svg
          className="bindings-map-cables"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {MAP_NODE_ORDER.map((id) => {
            const p = profiles[id];
            const to = MAP_POS[id];
            if (!to) return null;
            const ok = Boolean(p?.ok);
            const thin = p?.kind === "capability" || id === "voice";
            return (
              <path
                key={id}
                className={`bindings-cable${thin ? " is-thin" : ""}${ok ? " is-live" : " is-cut"}`}
                d={cablePath(MAP_POS.hub.x, MAP_POS.hub.y, to.x, to.y)}
              />
            );
          })}
        </svg>

        <div className="bindings-map-hub" aria-hidden="true">
          <GlyphMark size={40} className="bindings-map-mark" />
          <span className="bindings-map-hub-label">Glyph</span>
        </div>

        {MAP_NODE_ORDER.map((id) => {
          const p = profiles[id];
          if (!p) return null;
          const ok = Boolean(p.ok);
          const open = expandedId === id;
          const slot = nodeSlot(id);
          const thin = p.kind === "capability" || id === "voice";
          return (
            <button
              key={id}
              type="button"
              className={`bindings-node bindings-node--${slot}${thin ? " is-thin" : ""}${ok ? " is-ok" : " is-bad"}${open ? " is-open" : ""}`}
              aria-expanded={open}
              aria-controls={`bindings-node-detail-${id}`}
              onClick={() => onToggle(id)}
            >
              <span className="bindings-node-dot" aria-hidden="true" />
              <span className="bindings-node-body">
                <strong className="bindings-node-label">{p.label}</strong>
                <span className="bindings-node-auth">{p.auth}</span>
              </span>
              <span className="bindings-node-state" aria-hidden="true">
                {ok ? "live" : "cut"}
              </span>
            </button>
          );
        })}
      </div>

      {MAP_NODE_ORDER.map((id) => {
        const p = profiles[id];
        if (!p || expandedId !== id) return null;
        return (
          <div
            key={`detail-${id}`}
            id={`bindings-node-detail-${id}`}
            className={`bindings-node-detail${p.ok ? " is-ok" : " is-bad"}`}
            role="region"
            aria-label={`${p.label} — Checks`}
          >
            <ul className="bindings-checks">
              {(p.checks || []).map((c) => (
                <li key={c.id} className={c.ok ? "ok" : "bad"}>
                  <span className="bindings-check-mark" aria-hidden="true">
                    {c.ok ? "✓" : "·"}
                  </span>
                  <span>{c.detail}</span>
                </li>
              ))}
            </ul>
            {id === "grok" ? (
              <p className="bindings-oauth-inline">
                OAuth nur Terminal: <code>grok login</code> · Status aus{" "}
                <code>~/.grok/auth.json</code> — kein Token hier.
              </p>
            ) : null}
            {p.hint ? <p className="bindings-hint">{p.hint}</p> : null}
          </div>
        );
      })}
    </section>
  );
}

/**
 * @param {object} props
 * @param {boolean} props.active — when true, load/refresh status
 */
function BindingsPanel({ active }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/bindings", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void load();
  }, [active, load]);

  function toggleNode(id) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  if (!active) return null;

  const profiles = status?.profiles || {};

  return (
    <div className="bindings-panel" role="tabpanel" aria-label="Anbindung">
      <p className="bindings-lead">
        Glyph ist eine leere Hülle — hier knüpfst du Agenten an. Keys bleiben auf
        diesem Rechner (<code>~/.glyph-ui/bindings.json</code>).
      </p>

      {loading && !status ? (
        <p className="bindings-flash bindings-flash--muted">
          Status wird geladen…
        </p>
      ) : null}
      {error ? (
        <p className="bindings-flash bindings-flash--error" role="alert">
          {error}
        </p>
      ) : null}

      {status ? (
        <BindingsMap
          profiles={profiles}
          expandedId={expandedId}
          onToggle={toggleNode}
          loading={loading}
        />
      ) : null}

      {status?.modelsMismatch ? (
        <p className="bindings-hint bindings-hint--warn">
          Gespeicherte Models ≠ laufender Agent — Speichern oder Connect synct.
        </p>
      ) : null}

      {status ? (
        <AnbindungSheet
          absorb="agent"
          bindings={status}
          onBindingsChange={setStatus}
          moreModels
          extras
        />
      ) : null}

      <p className="bindings-footer">
        Datei:{" "}
        <code>{status?.bindingsPath || "~/.glyph-ui/bindings.json"}</code>
      </p>
    </div>
  );
}

export { BindingsPanel };
export default BindingsPanel;
