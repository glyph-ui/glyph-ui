/**
 * ImageLightbox — Bild im Chat vergrößern (Klick auf das Miniaturbild).
 *
 * Ein Klick vergrößert, ein zweiter schließt: Esc oder Klick auf den
 * Hintergrund ebenfalls. Der Dialog sitzt über allem und blockiert die
 * Hintergrund-Scrollleiste.
 */
import { useEffect } from "react";

export function ImageLightbox({ src, name = "", onClose }) {
  useEffect(() => {
    if (!src) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      // Vor anderen Escape-Handlern (Drawers) abfangen.
      e.stopPropagation();
      e.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [src, onClose]);

  if (!src) return null;
  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={name || "Bild"}
      onClick={onClose}
    >
      <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <img className="lightbox-img" src={src} alt={name || "Bild"} />
        <div className="lightbox-bar">
          <span className="lightbox-name">{name}</span>
          <button
            type="button"
            className="lightbox-close"
            onClick={onClose}
            title="Schließen"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
