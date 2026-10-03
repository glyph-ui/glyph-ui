/**
 * LocalModelToggle — Switch „27B lokal" ⇄ „API remote" für die Web-Fläche
 * (glyph-ui.com).
 *
 * Reiner Zwei-Zustands-Schalter: die Beschriftung nennt NUR die aktive Quelle.
 * Kein Zustandszusatz, kein „(on)"/„(off)".
 *
 *   angezeigt „27B lokal"  → aktiv ist das lokale Modell — Pille leuchtet GOLD
 *   angezeigt „API remote" → aktiv ist die Cloud-API      — Pille ist NEUTRAL
 *
 * Farbe: GOLD heißt „an", NEUTRAL heißt „aus". Nur wenn das 27B wirklich
 * läuft, ist die Pille gold; die Cloud ist der Normalzustand. Vorher leuchtete
 * beides gold und unterschied damit nichts — man sah nicht, welche Quelle
 * gerade antwortet. Weitere Zustände:
 *   lokal startet → neutral (gesperrt),  lokal schläft → neutral,  Fehler → rot
 *
 * Das ist auch die Anzeige für den automatischen Rückfall: schläft das Modell
 * ein (20 Min Leerlauf), wechselt die Brücke von selbst auf den vorherigen
 * Modus. Die Pille springt dabei von gold auf neutral und die Beschriftung auf
 * „API remote" — man sieht also, dass man gerade nicht lokal spricht.
 *
 * Klick schaltet um:
 *   an  → /api/local/select {enabled:true}  + /api/local/start  (weckt das Modell)
 *   aus → /api/local/select {enabled:false} + /api/local/stop
 *
 * Auf der Admin-Fläche übernimmt ProviderSwitch die Moduswahl; dort ist die
 * Bindings-Fläche offen. Im Web ist sie gesperrt (`/api/bindings`, `/api/models`
 * → 403, siehe server/webSurface.mjs), deshalb dieser eigene, enge Weg.
 *
 * Ausschalten legt das Modell wirklich schlafen (~8 GB frei) — das ist der
 * wirksamste Schutz gegen ein dauerhaft belegtes Mac-mini.
 *
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */
import { LOCAL_MODEL_LABEL } from "../utils/bindingsModels.js";

const REMOTE_LABEL = "API remote";

export default function LocalModelToggle({
  active = false,
  state = "sleeping",
  busy = false,
  disabled = false,
  onToggle,
}) {
  // Gold = an. Nur das laufende 27B ist „an"; die Cloud ist der
  // Normalzustand und bleibt neutral.
  const on = active && state === "ready";
  const failed = state === "error";
  // Nur sperren, wenn die ANGEZEIGTE Quelle startet — startet das Modell im
  // Hintergrund, während die API aktiv ist, bleibt der Knopf bedienbar.
  const pending = (active && state === "starting") || busy;
  const cls = `pill pill-btn${failed ? " bad" : on ? " ok" : ""}`;
  const label = active ? `${LOCAL_MODEL_LABEL} lokal` : REMOTE_LABEL;
  const title = active
    ? state === "starting"
      ? `${LOCAL_MODEL_LABEL} startet …`
      : `Aktiv: ${LOCAL_MODEL_LABEL} lokal — klicken wechselt zu ${REMOTE_LABEL}`
    : `Aktiv: ${REMOTE_LABEL}${
        state === "sleeping"
          ? ` — ${LOCAL_MODEL_LABEL} schläft, klicken weckt es`
          : ""
      } — klicken wechselt zu ${LOCAL_MODEL_LABEL} lokal`;
  return (
    <button
      type="button"
      className={cls}
      disabled={disabled || pending}
      title={title}
      onClick={() => onToggle?.(!active)}
    >
      {label}
    </button>
  );
}
