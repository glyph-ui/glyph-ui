/**
 * Anbindung list: Direct / Router closed rows; models stay visible.
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */
import { useEffect, useState } from "react";
import {
  applyLiveStatus,
  buildModelsPatch,
  DIRECT_HOST_DEFAULT,
  hopPill,
  hopRow,
  modelsForHead,
  normalizeProvider,
  ROUTER_HOST_OPENROUTER,
  ROUTER_HOST_ORCA,
} from "../utils/bindingsModels.js";

function KeyLine({ name, keyId, rec, hint, onPut, busy }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const [ask, setAsk] = useState(false);
  const set = Boolean(rec?.set);

  return (
    <div className="lage-keyline">
      <div className="lage-keyline-head">
        <strong>{name}</strong>
        <span className={set ? "lage-pill is-on" : "lage-pill"}>
          {set ? rec.masked : "offen"}
        </span>
      </div>
      {hint ? <p className="lage-lede">{hint}</p> : null}
      <div className="lage-actions">
        <button
          type="button"
          className="lage-link"
          disabled={busy}
          onClick={() => {
            setOpen((v) => !v);
            setAsk(false);
          }}
        >
          {set ? "Ersetzen" : "Setzen"}
        </button>
        {set ? (
          <button
            type="button"
            className="lage-link is-danger"
            disabled={busy}
            onClick={() => {
              setAsk(true);
              setOpen(false);
            }}
          >
            Entfernen
          </button>
        ) : null}
      </div>
      {open ? (
        <form
          className="lage-key-reveal"
          onSubmit={(e) => {
            e.preventDefault();
            if (!val.trim()) return;
            void onPut({ [keyId]: val.trim() }).then(() => {
              setVal("");
              setOpen(false);
            });
          }}
        >
          <input
            type="password"
            autoComplete="off"
            autoFocus
            value={val}
            disabled={busy}
            placeholder="Neuer Key — ersetzt den alten"
            onChange={(e) => setVal(e.target.value)}
          />
          <button type="submit" className="lage-link" disabled={busy || !val.trim()}>
            Schreiben
          </button>
          <button
            type="button"
            className="lage-link"
            onClick={() => {
              setOpen(false);
              setVal("");
            }}
          >
            Abbrechen
          </button>
        </form>
      ) : null}
      {ask ? (
        <p className="lage-confirm">
          <span>Key löschen?</span>
          <button
            type="button"
            className="lage-link is-danger"
            disabled={busy}
            onClick={() => {
              void onPut({ [keyId]: "" }).then(() => setAsk(false));
            }}
          >
            Löschen
          </button>
          <button type="button" className="lage-link" onClick={() => setAsk(false)}>
            Behalten
          </button>
        </p>
      ) : null}
    </div>
  );
}

function HopCard({ hop, bindings, open, onToggle, onPut, busy }) {
  const row = hopRow(bindings, hop);
  const [host, setHost] = useState(row.host);
  const isRouter = hop === "router";

  useEffect(() => {
    setHost(row.host);
  }, [row.host]);

  return (
    <div className={`anbind-hop${open ? " is-open" : ""}`}>
      <div className="anbind-hop-head">
        <div className="anbind-hop-title">
          <strong>{row.label}</strong>
          <span className={`anbind-hop-state is-${row.state}`}>{row.state}</span>
          <span className="anbind-hop-host" title={row.host}>
            {row.hostShort}
          </span>
        </div>
        <button
          type="button"
          className="lage-link"
          aria-expanded={open}
          aria-controls={`anbind-hop-${hop}`}
          onClick={onToggle}
        >
          {open ? "Schließen" : "Bearbeiten"}
        </button>
      </div>
      {open ? (
        <div id={`anbind-hop-${hop}`} className="anbind-hop-body">
          {isRouter ? (
            <div className="anbind-presets" role="group" aria-label="Router-Host">
              {[
                { id: "openrouter", label: "OpenRouter", url: ROUTER_HOST_OPENROUTER },
                { id: "orca", label: "Orca", url: ROUTER_HOST_ORCA },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`anbind-preset${row.kind === p.id ? " is-on" : ""}`}
                  disabled={busy}
                  onClick={() => setHost(p.url)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="lage-lede">
              Direct-Endpoint. DeepSeek oder anderer OpenAI-kompatibler Host.
            </p>
          )}
          <form
            className="lage-key-reveal"
            onSubmit={(e) => {
              e.preventDefault();
              if (!host.trim()) return;
              void onPut({ [row.urlId]: host.trim() });
            }}
          >
            <input
              type="url"
              autoComplete="off"
              spellCheck={false}
              aria-label={isRouter ? "Router Base-URL" : "Direct Base-URL"}
              placeholder={isRouter ? ROUTER_HOST_OPENROUTER : DIRECT_HOST_DEFAULT}
              value={host}
              disabled={busy}
              onChange={(e) => setHost(e.target.value)}
            />
            <button type="submit" className="lage-link" disabled={busy || !host.trim()}>
              Schreiben
            </button>
          </form>
          <KeyLine
            name={isRouter ? "Router-Key" : "Direct-Key"}
            keyId={row.keyId}
            rec={
              isRouter
                ? bindings?.keys?.OPENROUTER_API_KEY
                : bindings?.keys?.DIRECT_API_KEY
            }
            hint={
              isRouter
                ? "Zum Router-Host. sk-or-… (OpenRouter) oder sk-orca-… (Orca)."
                : "Zum Host. DeepSeek sk-… oder Key des anderen Endpoints."
            }
            onPut={onPut}
            busy={busy}
          />
        </div>
      ) : null}
    </div>
  );
}

function ModelBlock({
  absorb,
  bindings,
  onPut,
  onTest,
  onEmptyPrimary,
  busy,
  testing,
}) {
  const shown = modelsForHead(bindings, absorb);
  const [primary, setPrimary] = useState(shown.primary);
  const [fallback, setFallback] = useState(shown.fallback);
  const isCode = absorb === "code";

  useEffect(() => {
    setPrimary(shown.primary);
    setFallback(shown.fallback);
  }, [shown.primary, shown.fallback, absorb]);

  return (
    <form
      className="anbind-models"
      onSubmit={(e) => {
        e.preventDefault();
        const patch = buildModelsPatch({ absorb, primary, fallback });
        if (!patch) {
          onEmptyPrimary?.();
          return;
        }
        void onPut(patch);
      }}
    >
      <div className="lage-keyline-head">
        <strong>{isCode ? "Modell ^_Code" : "Modell °_Agent"}</strong>
        <span className={`lage-pill${shown.source === "code" ? " is-on" : ""}`}>
          {isCode ? (shown.source === "code" ? "eigen" : "wie Agent") : "shared"}
        </span>
      </div>
      <p className="lage-lede">
        {isCode
          ? "Leer + Schreiben = gleiches Paar wie °_Agent. Ohne Slash = Direct, mit Slash = Router."
          : "Ohne Slash = Direct. Mit Slash = Router."}
      </p>
      <label className="lage-field-label" htmlFor={`anbind-model-${absorb}`}>
        Primary
      </label>
      <div className="lage-key-reveal">
        <input
          id={`anbind-model-${absorb}`}
          type="text"
          autoComplete="off"
          spellCheck={false}
          aria-label={isCode ? "Modell ^_Code" : "Modell °_Agent"}
          placeholder="deepseek-v4-flash-vision-exp"
          value={primary}
          disabled={busy}
          onChange={(e) => setPrimary(e.target.value)}
        />
        <span className="lage-pill">{hopPill(primary)}</span>
      </div>
      <label className="lage-field-label" htmlFor={`anbind-fb-${absorb}`}>
        Reserve-Modell
      </label>
      <div className="lage-key-reveal">
        <input
          id={`anbind-fb-${absorb}`}
          type="text"
          autoComplete="off"
          spellCheck={false}
          aria-label="Reserve-Modell"
          placeholder="z-ai/glm-5.3-flash"
          value={fallback}
          disabled={busy}
          onChange={(e) => setFallback(e.target.value)}
        />
        <span className="lage-pill">
          {fallback.trim() ? hopPill(fallback) : "Router"}
        </span>
      </div>
      <div className="lage-actions">
        <button type="submit" className="lage-link" disabled={busy}>
          {busy ? "…" : "Schreiben"}
        </button>
        <button
          type="button"
          className="lage-link"
          disabled={busy || testing || !primary.trim()}
          onClick={() => void onTest(primary)}
        >
          {testing ? "Teste…" : "Testen"}
        </button>
        {isCode && shown.source === "code" ? (
          <button
            type="button"
            className="lage-link"
            disabled={busy}
            onClick={() => {
              setPrimary("");
              setFallback("");
              void onPut({ models: { code: null } });
            }}
          >
            Wie Agent
          </button>
        ) : null}
      </div>
    </form>
  );
}

function ExtraRows({
  bindings,
  openHop,
  setOpenHop,
  onPut,
  busy,
  provider,
  setProvider,
}) {
  const voice = bindings?.keys?.XAI_API_KEY;
  const voiceLive = Boolean(voice?.set);
  const agentNow =
    bindings?.settings?.GLYPH_AGENT_URL?.value || "http://127.0.0.1:18899";
  const [agentUrl, setAgentUrl] = useState(agentNow);

  useEffect(() => {
    setAgentUrl(agentNow);
  }, [agentNow]);

  return (
    <>
      <div className="anbind-hop">
        <div className="lage-keyline-head">
          <strong>Modus</strong>
        </div>
        <div className="lage-provider" role="radiogroup" aria-label="Provider-Modus">
          {["direct", "hybrid", "openrouter"].map((mode) => {
            const on = normalizeProvider(provider) === mode;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={on}
                className={`lage-provider-opt${on ? " is-on" : ""}`}
                disabled={busy}
                onClick={() => {
                  setProvider(mode);
                  void onPut({ provider: normalizeProvider(mode) });
                }}
              >
                {mode === "direct" ? "Direkt" : mode === "openrouter" ? "Router" : "Hybrid"}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`anbind-hop${openHop === "voice" ? " is-open" : ""}`}>
        <div className="anbind-hop-head">
          <div className="anbind-hop-title">
            <strong>Voice</strong>
            <span className={`anbind-hop-state is-${voiceLive ? "live" : "cut"}`}>
              {voiceLive ? "live" : "cut"}
            </span>
            <span className="anbind-hop-host">xAI</span>
          </div>
          <button
            type="button"
            className="lage-link"
            aria-expanded={openHop === "voice"}
            onClick={() => setOpenHop(openHop === "voice" ? null : "voice")}
          >
            {openHop === "voice" ? "Schließen" : "Bearbeiten"}
          </button>
        </div>
        {openHop === "voice" ? (
          <KeyLine
            name="XAI_API_KEY"
            keyId="XAI_API_KEY"
            rec={voice}
            hint="Voice STT/TTS Primary (Grok-Stimmen)."
            onPut={onPut}
            busy={busy}
          />
        ) : null}
      </div>

      <div className={`anbind-hop${openHop === "agent" ? " is-open" : ""}`}>
        <div className="anbind-hop-head">
          <div className="anbind-hop-title">
            <strong>glyph-agent</strong>
            <span className="anbind-hop-host" title={agentNow}>
              {agentNow.replace(/^https?:\/\//, "")}
            </span>
          </div>
          <button
            type="button"
            className="lage-link"
            aria-expanded={openHop === "agent"}
            onClick={() => setOpenHop(openHop === "agent" ? null : "agent")}
          >
            {openHop === "agent" ? "Schließen" : "Bearbeiten"}
          </button>
        </div>
        {openHop === "agent" ? (
          <form
            className="lage-key-reveal"
            onSubmit={(e) => {
              e.preventDefault();
              if (!agentUrl.trim()) return;
              void onPut({ GLYPH_AGENT_URL: agentUrl.trim() });
            }}
          >
            <input
              type="url"
              autoComplete="off"
              spellCheck={false}
              aria-label="glyph-agent URL"
              value={agentUrl}
              disabled={busy}
              onChange={(e) => setAgentUrl(e.target.value)}
            />
            <button type="submit" className="lage-link" disabled={busy || !agentUrl.trim()}>
              Schreiben
            </button>
          </form>
        ) : null}
      </div>
    </>
  );
}

/**
 * @param {{
 *   absorb: "agent"|"code",
 *   bindings: object|null,
 *   onBindingsChange?: (data: object) => void,
 *   moreModels?: boolean,
 *   extras?: boolean,
 * }} props
 */
export function AnbindungSheet({
  absorb,
  bindings,
  onBindingsChange,
  moreModels = false,
  extras = false,
}) {
  const [openHop, setOpenHop] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [testing, setTesting] = useState(false);
  const [provider, setProvider] = useState(
    () => normalizeProvider(bindings?.provider),
  );

  useEffect(() => {
    setProvider(normalizeProvider(bindings?.provider));
  }, [bindings?.provider]);

  async function put(body) {
    setBusy(true);
    setErr("");
    setOkMsg("");
    try {
      const res = await fetch("/api/bindings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      onBindingsChange?.(data);
      const live = applyLiveStatus(data?.modelsApply);
      const needsLive =
        Boolean(data?.modelsApply) ||
        Object.prototype.hasOwnProperty.call(body, "DIRECT_API_KEY") ||
        Object.prototype.hasOwnProperty.call(body, "DIRECT_API_URL") ||
        Object.prototype.hasOwnProperty.call(body, "OPENROUTER_API_KEY") ||
        Object.prototype.hasOwnProperty.call(body, "OPENROUTER_URL") ||
        Boolean(body.models);
      if (!needsLive) {
        setOkMsg("Gespeichert.");
        return data;
      }
      if (live.ok) {
        setOkMsg(live.text);
        return data;
      }
      setErr(live.text);
      return null;
    } catch (e) {
      setErr(e.message || String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function testModel(primary) {
    const m = String(primary || "").trim();
    if (!m) {
      setErr("Zum Testen eine Modell-ID eintragen.");
      return;
    }
    setTesting(true);
    setErr("");
    setOkMsg("");
    try {
      const hop = m.includes("/") ? "openrouter" : "direct";
      const res = await fetch("/api/models/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: m, hop }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || `Probe HTTP ${res.status}`);
      }
      const via =
        (data.hop || hop) === "direct"
          ? " · Direct"
          : (data.hop || hop) === "openrouter"
            ? " · Router"
            : "";
      setOkMsg(`Test ok: ${m}${via}`);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setTesting(false);
    }
  }

  function toggleHop(id) {
    setOpenHop((cur) => (cur === id ? null : id));
  }

  const other = absorb === "code" ? "agent" : "code";

  return (
    <div className="anbind lage-bind">
      <HopCard
        hop="direct"
        bindings={bindings}
        open={openHop === "direct"}
        onToggle={() => toggleHop("direct")}
        onPut={put}
        busy={busy}
      />
      <HopCard
        hop="router"
        bindings={bindings}
        open={openHop === "router"}
        onToggle={() => toggleHop("router")}
        onPut={put}
        busy={busy}
      />
      <ModelBlock
        absorb={absorb}
        bindings={bindings}
        onPut={put}
        onTest={testModel}
        onEmptyPrimary={() => setErr("Modell-ID fehlt.")}
        busy={busy}
        testing={testing}
      />
      {moreModels ? (
        <ModelBlock
          absorb={other}
          bindings={bindings}
          onPut={put}
          onTest={testModel}
          onEmptyPrimary={() => setErr("Modell-ID fehlt.")}
          busy={busy}
          testing={testing}
        />
      ) : null}
      {extras ? (
        <ExtraRows
          bindings={bindings}
          openHop={openHop}
          setOpenHop={setOpenHop}
          onPut={put}
          busy={busy}
          provider={provider}
          setProvider={setProvider}
        />
      ) : null}
      {err ? (
        <p className="lage-alert" role="alert">
          {err}
        </p>
      ) : null}
      {okMsg ? (
        <p className="lage-fact" role="status">
          {okMsg}
        </p>
      ) : null}
    </div>
  );
}

export { KeyLine };
export default AnbindungSheet;
