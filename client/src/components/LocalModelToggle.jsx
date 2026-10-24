/**
 * LocalModelToggle — Zwei-Segment-Schalter „27B | API" für die Web-Fläche
 * (glyph-ui.com).
 *
 * Vorher war das eine EINZELNE Pille, die nur die aktive Quelle nannte. Man
 * sah also nie, welche Alternative es gibt — erst nach dem Klick wusste man,
 * dass gewechselt wurde. Jetzt stehen beide Quellen nebeneinander, und die
 * gewählte ist gold.
 *
 * Beschriftung bleibt bewusst nackt („27B" / „API", Meldung 2026-10-03:
 * kein „(on)"/„(off)", keine Zusätze). Der Zustand wird ausschließlich
 * über die Darstellung gezeigt:
 *
 *   gefüllt gold   = gewählt UND bereit (antwortet gerade)
 *   goldene Kontur = gewählt, aber noch nicht bereit (startet / schläft)
 *   rote Kontur    = gewählt, Modell meldet Fehler
 *   neutral        = nicht gewählt
 *
 * Klick auf das NICHT gewählte Segment schaltet um:
 *   auf 27B → /api/local/select {enabled:true} + /api/local/start (weckt es)
 *   auf API → /api/local/select {enabled:false} + /api/local/stop
 * Klick auf das bereits gewählte Segment tut nichts — ein Schalter soll nicht
 * beim Draufzeigen das Modell wecken oder einschläfern.
 *
 * Gast-Sperre (2026-10-24): `locked` hält den Schalter sichtbar, aber
 * ausgegraut (`.is-locked`). Ein Klick schaltet NICHT, sondern zeigt 2 s lang
 * den Hinweis „Nur für den Hauptnutzer". Bewusst KEIN HTML-`disabled` — das
 * würde das Klick-Event schlucken und der Hinweis bliebe aus. Serverseitig
 * sperren die /api/local-Routen zusätzlich (Gast → 403).
 *
 * Auf der Admin-Fläche übernimmt ProviderSwitch die Moduswahl (Direkt /
 * Hybrid / Fallback / Lokal); im Web ist /api/bindings gesperrt, deshalb
 * dieser eigene, enge Weg.
 *
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */
import { useEffect, useRef, useState } from "react";
import { LOCAL_MODEL_LABEL } from "../utils/bindingsModels.js";

const REMOTE_LABEL = "API";
/** Dauer des Kurzhinweises bei gesperrtem Schalter (Meldung 2026-10-24). */
const LOCKED_HINT_MS = 2000;
const LOCKED_HINT_TEXT = "Nur für den Hauptnutzer";

/**
 * @param {boolean} [locked]  Gast-Sperre: sichtbar, ausgegraut, Klick = Hinweis
 */
export default function LocalModelToggle({
  active = false,
  state = "sleeping",
  busy = false,
  disabled = false,
  locked = false,
  onToggle,
}) {
  const isLocal = Boolean(active);
  const ready = state === "ready";
  const starting = state === "starting";
  const failed = state === "error";

  /** Kurzhinweis bei gesperrtem Schalter — 2 s, dann wieder weg. */
  const [lockedHint, setLockedHint] = useState(false);
  const lockedHintTimer = useRef(null);
  useEffect(
    () => () => {
      if (lockedHintTimer.current) clearTimeout(lockedHintTimer.current);
    },
    [],
  );
  const lockedClick = () => {
    setLockedHint(true);
    if (lockedHintTimer.current) clearTimeout(lockedHintTimer.current);
    lockedHintTimer.current = setTimeout(
      () => setLockedHint(false),
      LOCKED_HINT_MS,
    );
  };

  /**
   * Klassen für ein Segment.
   * `is-on`   = gewählt und bereit    → gefüllt gold
   * `is-armed`= gewählt, nicht bereit → goldene Kontur
   * `is-err`  = gewählt mit Fehler    → rote Kontur
   *
   * WICHTIG: „bereit" ist je Quelle etwas anderes. Das lokale Modell ist bereit,
   * wenn sein Prozess läuft (`state === "ready"`); die API ist bereit, sobald
   * ein Schlüssel hinterlegt ist — und den prüft die Brücke. Deshalb wird die
   * API NICHT am Zustand des lokalen Modells gemessen: sonst wäre der
   * Normalfall (API antwortet) nur eine Kontur statt Gold, und die Regel
   * „Gold = bereit" von 2026-10-03 wäre wieder kaputt.
   */
  const segClass = (selected, segReady, segFailed = false) => {
    if (!selected) return "provider-toggle-seg";
    if (segFailed) return "provider-toggle-seg is-armed is-err";
    if (segReady) return "provider-toggle-seg is-on";
    return "provider-toggle-seg is-armed";
  };

  // Nur sperren, während die GEWÄHLTE Quelle startet — schläft das Modell im
  // Hintergrund, bleibt der Schalter bedienbar.
  const localPending = isLocal && starting;
  const localDisabled = disabled || localPending || (isLocal && busy);
  const apiDisabled = disabled || (!isLocal && busy);
  // Gesperrt: sichtbar, ausgegraut, klickbar — HTML-`disabled` würde den
  // Klick (und damit den Hinweis) schlucken.
  const localSegDisabled = locked ? false : localDisabled;
  const apiSegDisabled = locked ? false : apiDisabled;
  const lockedTitle = "Nur der Hauptnutzer kann die Antwortquelle wechseln";

  const localTitle = isLocal
    ? `${LOCAL_MODEL_LABEL} antwortet${
        starting ? " — startet gerade …" : ready ? "" : " — noch nicht bereit"
      }`
    : `${LOCAL_MODEL_LABEL} einschalten${
        state === "sleeping" ? " (weckt das Modell, ~8 GB RAM)" : ""
      }`;
  const apiTitle = isLocal
    ? `${REMOTE_LABEL} einschalten — Antworten kommen aus der Cloud`
    : `${REMOTE_LABEL} antwortet — Antworten kommen aus der Cloud`;

  return (
    <div className="provider-toggle-wrap">
      <div
        className="provider-toggle"
        role="group"
        aria-label="Antwortquelle: lokal oder API"
      >
        <button
          type="button"
          className={`${segClass(isLocal, ready, failed)}${
            locked ? " is-locked" : ""
          }`}
          disabled={localSegDisabled}
          aria-disabled={locked || undefined}
          aria-pressed={isLocal}
          title={locked ? lockedTitle : localTitle}
          onClick={() => {
            if (locked) {
              lockedClick();
              return;
            }
            if (!isLocal) onToggle?.(true);
          }}
        >
          {LOCAL_MODEL_LABEL}
        </button>
        <button
          type="button"
          className={`${segClass(!isLocal, true)}${locked ? " is-locked" : ""}`}
          disabled={apiSegDisabled}
          aria-disabled={locked || undefined}
          aria-pressed={!isLocal}
          title={locked ? lockedTitle : apiTitle}
          onClick={() => {
            if (locked) {
              lockedClick();
              return;
            }
            if (isLocal) onToggle?.(false);
          }}
        >
          {REMOTE_LABEL}
        </button>
      </div>
      {lockedHint ? (
        <span className="provider-toggle-hint" role="status">
          {LOCKED_HINT_TEXT}
        </span>
      ) : null}
    </div>
  );
}
