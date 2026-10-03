/**
 * sourceOpen — winziger Event-Bus für „Quelle öffnen".
 *
 * Der Antworttext kann Vault-Pfade enthalten (vom Modell als Text geschrieben).
 * MarkdownBody macht sie zu Buttons; die App registriert den Handler und öffnet
 * das Quelldatei-Fenster. So braucht kein Prop durch alle Ebenen gereicht werden.
 *
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */

const listeners = new Set();

/** @returns {() => void} Abmelden */
export function onOpenVaultSource(fn) {
  if (typeof fn !== "function") return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function openVaultSource(file) {
  if (!file || !(file.path || file.url)) return;
  for (const fn of listeners) {
    try {
      fn(file);
    } catch {
      /* ein defekter Listener darf die anderen nicht blockieren */
    }
  }
}

/**
 * Externe Seite im System-Browser. Nicht window.open auf Glyph-Origin —
 * das öffnet ein leeres zweites App-Fenster.
 */
export function openWebUrl(url) {
  const href = String(url || "").trim();
  if (!href || typeof window === "undefined") return;
  const opened = window.open(href, "_blank", "noopener,noreferrer");
  if (opened) return;
  if (typeof document === "undefined") return;
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.referrerPolicy = "no-referrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
