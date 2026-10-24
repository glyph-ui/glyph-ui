/**
 * Password gate for the public Web-Fläche (glyph-ui.com).
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */

import { useEffect, useRef, useState } from "react";

export function WebGate({ onUnlocked, hint }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function syncCaps(e) {
    try {
      setCapsOn(Boolean(e.getModifierState?.("CapsLock")));
    } catch {
      /* ignore */
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/web-gate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setError(json?.error || "Passwort falsch");
        setBusy(false);
        requestAnimationFrame(() => {
          inputRef.current?.focus();
          inputRef.current?.select?.();
        });
        return;
      }
      onUnlocked?.();
      // Nach dem Login hart neu laden: die Seite VOR dem Tor lief mit altem
      // Bundle und ohne WS-Token — Search-Modus, 27B-Schalter und „Im Vault
      // suchen" erschienen erst nach einem manuellen Refresh. Der Reload
      // liefert frisches index.html (mit Token) und den vollen Zustand.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Netzwerkfehler");
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  return (
    <div className="web-gate">
      <form className="web-gate-card" onSubmit={(e) => void submit(e)}>
        <p className="web-gate-kicker">glyph-ui.com</p>
        <h1 className="web-gate-title">Glyph</h1>
        <p className="web-gate-copy">
          {hint || "Geschützter Arbeitsbereich – bitte Kennwort eingeben."}
        </p>
        <label className="web-gate-label">
          <span className="sr-only">Passwort</span>
          <input
            ref={inputRef}
            type="password"
            name="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={syncCaps}
            onKeyUp={syncCaps}
            placeholder="Passwort"
            className={`web-gate-input${error ? " web-gate-input--error" : ""}`}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error || capsOn ? "web-gate-field-hint" : undefined
            }
          />
        </label>
        {capsOn ? (
          <p id="web-gate-field-hint" className="web-gate-caps" role="status">
            Feststelltaste ist an
          </p>
        ) : null}
        {error ? (
          <p
            id={capsOn ? "web-gate-error" : "web-gate-field-hint"}
            className="web-gate-error"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <button type="submit" className="web-gate-submit" disabled={busy || !password}>
          {busy ? "…" : "Öffnen"}
        </button>
      </form>
      <p className="web-gate-foot">Zugang nur für berechtigte Personen</p>
    </div>
  );
}
