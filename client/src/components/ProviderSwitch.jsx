/**
 * ProviderSwitch — kompakter Header-Umschalter (Direkt/Hybrid/Fallback/Lokal)
 * für °_Agent & ^_tick. Schreibt direkt via PUT /api/bindings.
 *
 * „Lokal" ist der Bonsai-2-27B-Kopf (127.0.0.1:8080). Sein Modellprozess
 * braucht ~8 GB RAM, deshalb zeigt der Eintrag seinen Zustand (off /
 * startet… / on) und wird über server/localModel.mjs gesteuert.
 *
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */
import { useEffect, useRef, useState } from "react";
import { normalizeProvider, LOCAL_MODEL_LABEL } from "../utils/bindingsModels.js";

const OPTIONS = [
  { mode: "direct", label: "Direkt" },
  { mode: "hybrid", label: "Hybrid" },
  { mode: "openrouter", label: "Fallback" },
  { mode: "local", label: "Lokal" },
];

/** Kurztext für den lokalen Kopf. */
function localStateLabel(state) {
  if (state === "ready") return `${LOCAL_MODEL_LABEL} on`;
  if (state === "starting") return `${LOCAL_MODEL_LABEL} startet…`;
  if (state === "error") return `${LOCAL_MODEL_LABEL} Fehler`;
  return `${LOCAL_MODEL_LABEL} off`;
}

function optionLabel(mode, isPeak, localState) {
  if (mode === "hybrid") return isPeak ? "Hybrid · OR" : "Hybrid";
  if (mode === "openrouter") return "Fallback";
  if (mode === "local") {
    if (localState === "ready") return "Lokal · on";
    if (localState === "starting") return "Lokal · …";
    return "Lokal · off";
  }
  return "Direkt";
}

export default function ProviderSwitch({
  provider = "hybrid",
  isPeak = false,
  mismatch = false,
  disabled = false,
  localState = "sleeping",
  localBusy = false,
  cloudOk = true,
  onChange,
  onSleep,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = normalizeProvider(provider);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const isLocal = current === "local";
  const stateText = localStateLabel(localState);
  // EINE Regel für alle Anbieter: gold = der aktive antwortet, grau = er kann
  // gerade nicht. Kein Sonderfall für „lokal" und keiner für die Cloud.
  //   lokal  → bereit, wenn das Modell wirklich läuft
  //   Cloud  → bereit, wenn ein Schlüssel hinterlegt ist
  const usable = isLocal ? localState === "ready" : cloudOk;

  return (
    <div className="provider-switch" ref={ref}>
      <button
        type="button"
        className={`provider-switch-btn${mismatch ? " is-mismatch" : ""}${
          usable ? " is-on" : " is-cold"
        }`}
        disabled={disabled}
        title={
          mismatch
            ? "Provider weicht vom aktiven Agent ab — klicken zum Umschalten"
            : `Provider: Direkt / Hybrid / Fallback / Lokal${
                isLocal ? ` — ${stateText}` : ""
              }`
        }
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="provider-switch-dot" aria-hidden="true" />
        {optionLabel(current, isPeak, localState)}
        <span className="provider-switch-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <ul className="provider-switch-menu" role="listbox">
          {OPTIONS.map((o) => {
            const active = current === o.mode;
            const isLocalOpt = o.mode === "local";
            return (
              <li key={o.mode} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`provider-switch-opt${active ? " is-on" : ""}`}
                  disabled={isLocalOpt && localBusy}
                  onClick={() => {
                    setOpen(false);
                    if (!active) onChange?.(o.mode);
                  }}
                >
                  <span className="provider-switch-dot" aria-hidden="true" />
                  {o.label}
                  {isLocalOpt ? (
                    <span className="provider-switch-peak">
                      {localStateLabel(localState)}
                    </span>
                  ) : null}
                  {o.mode === "hybrid" && isPeak ? (
                    <span className="provider-switch-peak">Peak → OR</span>
                  ) : null}
                </button>
              </li>
            );
          })}
          {/* Aktion statt Modus: gehört INS Menü (das ist absolut positioniert).
              Daneben gerendert stand sie im Kopfzeilen-Fluss und hat das
              Layout verzogen — der Knopf wirkte nach oben geschoben. */}
          {isLocal && typeof onSleep === "function" ? (
            <>
              <li className="provider-switch-sep" role="separator" aria-hidden="true" />
              <li>
                <button
                  type="button"
                  className="provider-switch-opt"
                  disabled={localState !== "ready" || localBusy}
                  onClick={() => {
                    setOpen(false);
                    onSleep();
                  }}
                >
                  {LOCAL_MODEL_LABEL} off — RAM freigeben
                </button>
              </li>
            </>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
