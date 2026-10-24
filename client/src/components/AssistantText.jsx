/**
 * AssistantText — rendert die Antwort eines lokalen/Cloud-Agenten.
 *
 * Lese-Hierarchie (Lesespur-Vertrag):
 *   - Primärspur = nur Final-/Status-Text (Markdown)
 *   - Protokoll = Steps (Tools) + Entwürfe (Zwischen-LLM), Haiku-artig:
 *     schmaler Aktivitäts-Streifen (neueste Statuszeile + Laufzeit), der
 *     aufklappt zu Einzel-Stufen (SearchWeb, Think …) + Entwürfen.
 *     Live und nach Turn-Ende zugeklappt — HSEQ-Nachvollzug per Klick.
 *
 * Zwei Quellen für die Tool-/Denk-Stufen („SearchVault“/“SearchWeb“ …):
 *   1. `steps` (live): Array von {start, result} pro Stufe während Streaming.
 *   2. Fallback über den Sentinel im Text (alte, nicht-streamende Antworten).
 *
 * Der Antworttext geht immer durch cleanAssistantAnswer — Sentinel/Banner
 * und geleakte Tool-JSON landen nie im Markdown-Body (saubere Lesespur).
 *
 * Copyright (c) 2026 Alexander Hubert · SPDX-License-Identifier: MIT
 */
import { memo, useRef, useState, useEffect } from "react";
import { MarkdownBody } from "./MarkdownBody.jsx";
import { cleanAssistantAnswer, stripLeakedToolCalls } from "../utils/assistantTrace.js";
import { activityCounts, formatElapsed, friendlyActivityLine, latestActivity } from "../utils/activityStrip.js";

/**
 * Laufzeit der laufenden Runde: tickt live während Streaming, friert beim
 * Turn-Ende ein. Werden alte Nachrichten erst nach dem Ende gemountet, bleibt
 * die Laufzeit unbekannt (leer).
 */
function useElapsedSeconds(streaming) {
  const startedRef = useRef(null);
  const [elapsed, setElapsed] = useState(null);

  useEffect(() => {
    if (streaming) {
      if (startedRef.current == null) startedRef.current = Date.now();
      const tick = () =>
        setElapsed(Math.max(0, Math.round((Date.now() - startedRef.current) / 1000)));
      tick();
      const id = window.setInterval(tick, 1000);
      return () => window.clearInterval(id);
    }
    if (startedRef.current != null) {
      setElapsed(Math.max(0, Math.round((Date.now() - startedRef.current) / 1000)));
      startedRef.current = null;
    }
    return undefined;
  }, [streaming]);

  return elapsed;
}

/**
 * Aktivitäts-Steine: goldene Steine (zu 3/4 gefüllt), während der Recherche
 * wandert ein dunkler Stein von links nach rechts hindurch.
 */
function ActivityMark({ live }) {
  return (
    <span
      className={`activity-mark${live ? " activity-mark--live" : ""}`}
      aria-hidden="true"
    >
      <span className="activity-dot" />
      <span className="activity-dot" />
      <span className="activity-dot" />
      {live ? <span className="activity-traveler" /> : null}
    </span>
  );
}

/**
 * Stufenzeilen im aufgeklappten Protokoll: Titel = Start der Stufe
 * („SearchWeb · suche im Internet …“), aufklappbar um das Ergebnis.
 */
function StepRows({ steps }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  return (
    <div className="steps-rail chat-secondary" data-testid="steps-rail">
      {steps.map((s, i) => {
        const title = String(s.start || s.result || "").trim();
        const detail = s.start && s.result ? String(s.result).trim() : "";
        if (!title) return null;
        if (!detail) {
          return (
            <div className="step-row step-row--plain" key={s.id ?? i}>
              <span className="step-row-title">{title}</span>
            </div>
          );
        }
        return (
          <details className="step-row" key={s.id ?? i}>
            <summary className="step-row-summary">
              <span className="step-row-title">{title}</span>
              <span className="step-row-chev" aria-hidden="true">
                ›
              </span>
            </summary>
            <div className="step-row-detail">{detail}</div>
          </details>
        );
      })}
    </div>
  );
}

/** Alt-Responses ohne Live-Stufen: Banner-Zeilen als schlichte Stufenzeilen. */
function BannerSteps({ banner }) {
  if (!banner) return null;
  return (
    <div className="agent-steps chat-secondary" data-testid="agent-steps">
      {banner.split("\n").filter(Boolean).map((line, i) => (
        <div className="step-row step-row--plain" key={i}>
          <span className="step-row-title">{line}</span>
        </div>
      ))}
    </div>
  );
}

function DraftsBlock({ drafts }) {
  if (!Array.isArray(drafts) || drafts.length === 0) return null;
  return (
    <div className="drafts-rail chat-secondary" data-testid="drafts-rail">
      <div className="drafts-rail-label">Entwürfe</div>
      {drafts.map((d, i) => (
        <div className="draft-block" key={d.id ?? i}>
          <div className="draft-body">
            {stripLeakedToolCalls(typeof d === "string" ? d : d.text || "")}
          </div>
        </div>
      ))}
    </div>
  );
}

const AssistantText = memo(function AssistantText({
  text,
  steps,
  drafts,
  streaming = false,
  protocolCollapsed = false,
}) {
  const hasLiveSteps = Array.isArray(steps) && steps.length > 0;
  const draftList = Array.isArray(drafts) ? drafts : [];
  // Banner + leaked tool JSON never enter MarkdownBody.
  const { banner, answer } = cleanAssistantAnswer(text);
  const prose = answer || "";

  const stepCount = hasLiveSteps
    ? steps.length
    : banner
      ? banner.split("\n").filter(Boolean).length
      : 0;
  const hasProtocol = stepCount > 0 || draftList.length > 0;

  // Laufzeit der Runde: live tickend, nach Final eingefroren.
  const elapsed = useElapsedSeconds(streaming);
  const elapsedText = formatElapsed(elapsed);
  const counts = activityCounts(stepCount, draftList.length);

  // Haiku-Art: immer als schmaler Streifen starten, Aufklappen per Klick.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!streaming && protocolCollapsed) {
      setOpen(false);
    }
  }, [streaming, protocolCollapsed]);

  // Streifen-Zeile (Haiku-Art): live die Statusmeldung der laufenden Stufe
  // („Websuche läuft …“), nach Final die Zähler.
  const latest = latestActivity(steps, banner, streaming ? "Agent arbeitet …" : "Protokoll");
  const stripLine = streaming
    ? friendlyActivityLine(latest.line, latest.running)
    : counts || friendlyActivityLine(latest.line, latest.running);

  return (
    <>
      {hasProtocol ? (
        <details
          className="work-protocol chat-secondary"
          data-testid="work-protocol"
          open={open}
          onToggle={(e) => setOpen(e.currentTarget.open)}
        >
          <summary
            className="work-protocol-summary"
            data-testid="activity-strip"
            title={counts || undefined}
          >
            <ActivityMark live={streaming} />
            <span className="activity-strip-text">{stripLine}</span>
            {elapsedText ? (
              <span className="activity-strip-time">{elapsedText}</span>
            ) : null}
            <span className="activity-strip-chev" aria-hidden="true">
              ›
            </span>
          </summary>
          <div className="work-protocol-body">
            {hasLiveSteps ? <StepRows steps={steps} /> : <BannerSteps banner={banner} />}
            <DraftsBlock drafts={draftList} />
          </div>
        </details>
      ) : null}
      {prose ? <MarkdownBody text={prose} /> : null}
    </>
  );
});

export { AssistantText };
