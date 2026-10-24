/**
 * Kennwort und Gastzugang (Web-Fläche, nur Hauptzugang).
 *
 * Aufbau: Kopf mit Titel und Schließen-Kreuz, darunter zwei gleich gebaute
 * Bereiche mit je einem Eingabefeld-Satz und EINEM Knopf in voller Breite.
 * Dadurch sind alle Knöpfe gleich hoch und gleich breit — kein Knopfpaar mit
 * unterschiedlichen Textlängen mehr. Wo es die Bedeutung trägt, steht ein
 * Symbol neben der Beschriftung (Haken = speichern, Kreuz = schließen,
 * Papierkorb = entfernen).
 *
 * Mindestlänge 4 Zeichen, keine Zeichenklassen-Regeln: das Kennwort ist ein
 * Zugangsschloss für eine private Instanz. Wer es ändern kann, ändert es,
 * sobald etwas kompromittiert wirkt.
 *
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */

import { useEffect, useRef, useState } from "react";
import { handleDialogTab } from "../utils/focusTrap.js";
import { IconCheck, IconClose, IconTrash } from "./icons.jsx";

const MIN_LENGTH = 4;

/**
 * Serverfehler in Klartext. „Web-Tor" und „Nur auf der Web-Fläche" sind
 * technische Kürzel: sie bedeuten für den Nutzer nur „deine Sitzung fehlt" oder
 * „hier geht das grundsätzlich nicht". Ohne Übersetzung bleibt man ratlos.
 */
function erklaereFehler(roh, status) {
  const text = String(roh || "").trim();
  if (text === "Web-Tor" || status === 401) {
    return "Sitzung abgelaufen — Seite neu laden und neu anmelden.";
  }
  if (text === "Nur auf der Web-Fläche") {
    return "Das Passwort lässt sich nur auf glyph-ui.com ändern, nicht in der lokalen App.";
  }
  if (text === "Passwort falsch") {
    return "Das aktuelle Passwort stimmt nicht.";
  }
  return text || `Speichern fehlgeschlagen (HTTP ${status})`;
}

export function WebPasswordDialog({ onClose }) {
  const rootRef = useRef(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [guest, setGuest] = useState("");
  const [guestEnabled, setGuestEnabled] = useState(false);
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  /**
   * Enter in einem Feld speichert den zugehörigen Bereich. Der Dialog ist kein
   * <form> mehr (zwei Bereiche mit unterschiedlichen Aktionen), deshalb muss
   * Enter hier ausdrücklich behandelt werden — sonst passiert beim Drücken
   * nichts, was sich kaputt anfühlt.
   */
  const enterSaves = (fn) => (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      fn();
    }
  };

  /**
   * onClose in einer Referenz halten: der Elternteil übergibt ein Inline-Pfeil
   * (`onClose={() => setOpen(false)}`), also bei JEDEM Render eine neue
   * Funktion. Hinge der Effekt unten an `[onClose]`, liefe er bei jedem
   * Tastendruck erneut — und der `focus()`-Aufruf darin würde den Cursor
   * jedes Mal zurück ins Feld „Aktuelles Passwort" reißen. Genau das war der
   * Sprung, der beim Tippen gestört hat.
   */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Fokus und Escape-Behandlung genau EINMAL beim Öffnen.
  useEffect(() => {
    const root = rootRef.current;
    root?.querySelector("input")?.focus?.();
    function onKey(e) {
      if (handleDialogTab(root, e)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/web-gate/guest", { credentials: "same-origin", cache: "no-store" })
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (cancelled) return;
        // 401 heißt: die Sitzung fehlt (abgelaufen, anderes Gerät, http statt
        // https). Das muss sofort sichtbar sein — sonst füllt man Felder aus
        // und der Speicherknopf scheitert ohne erkennbaren Grund.
        if (!r.ok) {
          setError(erklaereFehler(json?.error, r.status));
          return;
        }
        setGuestEnabled(Boolean(json?.enabled));
        setRole(json?.owner === false ? "guest" : "owner");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function savePassword() {
    if (busy) return;
    setError("");
    setNote("");
    // Erst prüfen, dann melden — der Knopf ist absichtlich immer klickbar.
    // Ein abgeschalteter Knopf ohne Begründung fühlt sich kaputt an: man klickt
    // und nichts passiert, ohne zu wissen, welches Feld fehlt.
    if (!current) {
      setError("Bitte zuerst das aktuelle Passwort eintragen");
      return;
    }
    if (!next) {
      setError("Bitte ein neues Passwort eintragen");
      return;
    }
    if (!confirm) {
      setError("Bitte das neue Passwort wiederholen");
      return;
    }
    if (next !== confirm) {
      setError("Die neuen Passwörter stimmen nicht überein");
      return;
    }
    if (next.length < MIN_LENGTH) {
      setError(`Das neue Passwort braucht mindestens ${MIN_LENGTH} Zeichen`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/web-gate/password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setError(erklaereFehler(json?.error, res.status));
        setBusy(false);
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setNote("Gespeichert. Andere Geräte müssen sich neu anmelden.");
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Netzwerkfehler");
      setBusy(false);
    }
  }

  async function saveGuest(remove) {
    if (busy) return;
    setError("");
    setNote("");
    // Kein „aktuelles Passwort" nötig: die Hauptzugangs-Sitzung ist der Beleg.
    // Das Gast-Passwort ist ein schwächerer Zugang und sperrt niemanden aus.
    const value = remove ? "" : guest;
    if (!remove && value.length < MIN_LENGTH) {
      setError(`Das Gast-Passwort braucht mindestens ${MIN_LENGTH} Zeichen`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/web-gate/guest", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setError(erklaereFehler(json?.error, res.status) || "Gastzugang konnte nicht geändert werden");
        setBusy(false);
        return;
      }
      setGuestEnabled(Boolean(json?.enabled));
      setGuest("");
      setNote(json?.enabled ? "Gastzugang ist eingerichtet." : "Gastzugang ist entfernt.");
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Netzwerkfehler");
      setBusy(false);
    }
  }

  /**
   * Gast: keine Formulare. Er darf nichts ändern — dann zeigt der Dialog auch
   * keine Felder, die nur so tun, als könnte er es. Vorher sah ein Gast alle
   * drei Bereiche, obwohl jeder Speicherversuch am Server scheitern musste.
   */
  if (role === "guest") {
    return (
      <div
        className="web-password-backdrop"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onCloseRef.current?.();
        }}
      >
        <div
          ref={rootRef}
          className="web-password-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="web-password-title"
        >
          <div className="web-password-head">
            <h2 id="web-password-title" className="web-password-title">
              Kennwort
              <span className="web-password-role is-guest">Gast</span>
            </h2>
            <button
              type="button"
              className="web-password-icon-btn"
              onClick={() => onCloseRef.current?.()}
              title="Schließen"
              aria-label="Schließen"
            >
              <IconClose size={18} />
            </button>
          </div>
          <p className="web-password-copy">
            Du bist als Gast angemeldet. Nur der Hauptzugang kann das Passwort
            oder den Gastzugang ändern.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="web-password-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={rootRef}
        className="web-password-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="web-password-title"
      >
        <div className="web-password-head">
          <h2 id="web-password-title" className="web-password-title">
            Kennwort
            {role ? (
              <span className={`web-password-role is-${role}`}>
                {role === "guest" ? "Gast" : "Hauptzugang"}
              </span>
            ) : null}
          </h2>
          <button
            type="button"
            className="web-password-icon-btn"
            onClick={() => onClose?.()}
            title="Schließen"
            aria-label="Schließen"
          >
            <IconClose size={18} />
          </button>
        </div>

        <p className="web-password-copy">
          Passwort für die Anmeldung an glyph-ui.com. Nach dem Ändern müssen sich
          andere Geräte neu anmelden.
        </p>

        <input
          type="password"
          name="current-password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="Aktuelles Passwort"
          aria-label="Aktuelles Passwort"
          className="web-gate-input"
            onKeyDown={enterSaves(() => void savePassword)}
        />
        <input
          type="password"
          name="new-password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="Neues Passwort"
          aria-label="Neues Passwort"
          className="web-gate-input"
            onKeyDown={enterSaves(() => void savePassword)}
        />
        <input
          type="password"
          name="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Neues Passwort wiederholen"
          aria-label="Neues Passwort wiederholen"
          className="web-gate-input"
            onKeyDown={enterSaves(() => void savePassword)}
        />
        <button
          type="button"
          className="web-gate-submit web-password-wide"
          disabled={busy}
          onClick={() => void savePassword()}
        >
          <IconCheck size={16} />
          {busy ? "…" : "Passwort speichern"}
        </button>

        <h3 className="web-password-subtitle">Gastzugang</h3>
        <p className="web-password-copy">
          Gäste können chatten, aber nichts ändern — kein Passwort, keine
          Einstellungen. {guestEnabled ? "Zurzeit eingerichtet." : "Zurzeit aus."}
        </p>
        <div className="web-password-row">
          <input
            type="password"
            name="guest-password"
            autoComplete="new-password"
            value={guest}
            onChange={(e) => setGuest(e.target.value)}
            placeholder="Gast-Passwort"
            aria-label="Gast-Passwort"
            className="web-gate-input"
            onKeyDown={enterSaves(() => void saveGuest(false))}
        />
          <button
            type="button"
            className="web-password-icon-btn"
            disabled={busy || !guestEnabled}
            onClick={() => void saveGuest(true)}
            title="Gastzugang entfernen"
            aria-label="Gastzugang entfernen"
          >
            <IconTrash size={18} />
          </button>
        </div>
        <button
          type="button"
          className="web-gate-submit web-password-wide"
          disabled={busy}
          onClick={() => void saveGuest(false)}
        >
          <IconCheck size={16} />
          {busy ? "…" : "Gast-Passwort speichern"}
        </button>

        {error ? (
          <p className="web-gate-error" role="alert">
            {error}
          </p>
        ) : null}
        {note ? (
          <p className="web-password-ok" role="status">
            {note}
          </p>
        ) : null}
      </div>
    </div>
  );
}
