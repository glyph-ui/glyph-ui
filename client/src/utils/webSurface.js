/**
 * Public web surface hostnames. Keep in sync with server/webSurface.mjs.
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */

const DEFAULT_WEB_HOSTS = ["glyph-ui.com", "www.glyph-ui.com"];

export function isWebSurfaceHost(hostname) {
  const h = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .split(":")[0];
  return DEFAULT_WEB_HOSTS.includes(h);
}

/**
 * Limited header on Sitz `web`: Neu Laden, not Beenden.
 * Desk/phone keep the chain (quit/connect); reload stays on the rail.
 */
export function surfaceHeaderControls(seat) {
  const web = seat === "web";
  return { reload: web, quit: !web, logout: web };
}

/**
 * Auf diesem Gerät abmelden. Fehler zählen nicht: danach lädt die Seite neu
 * und zeigt das Web-Tor, falls die Sitzung weg ist.
 */
export async function webLogout(fetchImpl = globalThis.fetch) {
  try {
    await fetchImpl("/api/web-gate/logout", {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
    /* offline o. ä. — Neuladen klärt den Stand */
  }
}
