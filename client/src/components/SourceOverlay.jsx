/**
 * SourceOverlay — zeigt eine Quelldatei (PDF/Text) als einfaches Overlay
 * INNERHALB der laufenden Glyph UI. Bewusst minimal: kein neues Fenster,
 * kein SideDrawer, keine Fokus-Falle — damit nichts kippen kann.
 *
 * Copyright (c) 2026 Alexander Hubert · SPDX-License-Identifier: MIT
 */
import { useEffect, useState } from "react";
import { MarkdownBody } from "./MarkdownBody.jsx";
import { obsidianUrl, sourceFileUrl } from "../utils/sourceLinks.js";

function SourceOverlay({ file, onClose }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const path = String(file?.path || "");
  const kind = String(file?.kind || "").toLowerCase() ||
    (path.toLowerCase().endsWith(".pdf") ? "pdf" : "md");
  const isPdf = kind === "pdf";

  useEffect(() => {
    setText("");
    setError("");
    if (!path || isPdf) return undefined;
    let alive = true;
    fetch(sourceFileUrl(path))
      .then(async (r) => {
        if (r.ok) return r.text();
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      })
      .then((t) => alive && setText(t))
      .catch((e) => alive && setError(String(e?.message || e)));
    return () => {
      alive = false;
    };
  }, [path, isPdf]);

  if (!path) return null;
  const ext = obsidianUrl(file);

  return (
    <div className="source-overlay" role="dialog" aria-modal="true" aria-label="Quelldatei">
      <div className="source-overlay-head">
        <span className="source-overlay-title" title={path}>
          {file?.title || path.split("/").pop()}
        </span>
        {ext ? (
          <a className="source-overlay-ext" href={ext} title="In Obsidian öffnen">
            In Obsidian öffnen
          </a>
        ) : null}
        <button type="button" className="source-overlay-close" onClick={onClose}>
          Schließen
        </button>
      </div>
      <div className="source-overlay-body">
        {isPdf ? (
          <iframe className="source-overlay-frame" src={sourceFileUrl(path)} title={file?.title || "PDF"} />
        ) : error ? (
          <p className="source-overlay-error">{error}</p>
        ) : (
          <MarkdownBody text={text || "lädt …"} />
        )}
      </div>
    </div>
  );
}

export { SourceOverlay };
