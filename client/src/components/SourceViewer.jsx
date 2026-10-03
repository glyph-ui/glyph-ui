/**
 * SourceViewer — zitierte Quelle im Seitenfenster (Vault-PDF/Notiz oder Web).
 *
 * PDF: nativer Viewer + Begriffsuche (Textlayer via pdfjs). Web: iframe,
 * Fuß Browser + Zurück. Vault: Obsidian im Kopf. Chat bleibt, Esc/Zurück.
 *
 * Copyright (c) 2026 Alexander Hubert · SPDX-License-Identifier: MIT
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SideDrawer } from "./SideDrawer.jsx";
import { MarkdownBody } from "./MarkdownBody.jsx";
import {
  obsidianUrl,
  shortLinkLabel,
  sourceFileUrl,
  sourceKind,
  sourceTitle,
  sourceVault,
} from "../utils/sourceLinks.js";
import { findInPages, findMatchOffsets, snippetAround } from "../utils/sourceFind.js";
import { extractPdfPages } from "../utils/pdfText.js";
import { openWebUrl } from "../utils/sourceOpen.js";

function SourceFindBar({ query, onQuery, hits, index, onIndex, disabled, emptyHint }) {
  const n = hits.length;
  const label = !query.trim()
    ? ""
    : disabled
      ? emptyHint || ""
      : n
        ? `${Math.min(index, n - 1) + 1} / ${n}`
        : "keine Treffer";

  return (
    <form
      className="source-find"
      onSubmit={(e) => {
        e.preventDefault();
        if (n) onIndex((index + 1) % n);
      }}
    >
      <input
        type="search"
        className="source-find-input"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Im Dokument suchen"
        aria-label="Im Dokument suchen"
        autoComplete="off"
        enterKeyHint="search"
      />
      <span className="source-find-count" aria-live="polite">
        {label}
      </span>
      <button
        type="button"
        className="ghost source-find-nav"
        disabled={!n}
        onClick={() => onIndex((index - 1 + n) % n)}
        aria-label="Vorheriger Treffer"
      >
        Vor
      </button>
      <button
        type="submit"
        className="ghost source-find-nav"
        disabled={!n}
        aria-label="Nächster Treffer"
      >
        Weiter
      </button>
    </form>
  );
}

function SourceViewer({ file, open, onClose, side = "right", mode = "overlay" }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pdfPages, setPdfPages] = useState(null);
  const [pdfErr, setPdfErr] = useState("");
  const [webPage, setWebPage] = useState(null);
  const [webErr, setWebErr] = useState("");
  const [textAnsicht, setTextAnsicht] = useState(false);
  const [webReload, setWebReload] = useState(0);
  const [query, setQuery] = useState("");
  const [hitIndex, setHitIndex] = useState(0);
  const [frameSrc, setFrameSrc] = useState("");
  const [drawerW, setDrawerW] = useState(() => {
    try {
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches) {
        return null;
      }
      const n = Number(sessionStorage.getItem("glyph-source-w"));
      return n >= 400 ? n : null;
    } catch {
      return null;
    }
  });
  const textRef = useRef(null);

  const kind = sourceKind(file);
  const isWeb = kind === "web";
  const isPdf = kind === "pdf";
  const path = String(file?.path || "");
  const url = String(file?.url || (isWeb ? path : ""));
  const fileUrl = path && !isWeb ? sourceFileUrl(path) : "";

  useEffect(() => {
    setText("");
    setError("");
    setPdfPages(null);
    setPdfErr("");
    setWebPage(null);
    setWebErr("");
    setTextAnsicht(false);
    setQuery("");
    setHitIndex(0);
    setFrameSrc(fileUrl);
  }, [open, path, url, fileUrl]);

  // Web: verbietet die Seite die Einbettung (X-Frame-Options / frame-ancestors),
  // zeigt der Browser im <iframe> nur den Block-Kreis — dann greift die
  // Textansicht (derselbe Abruf nennt Text und Einbettbarkeit).
  useEffect(() => {
    if (!open || !isWeb || !url) return undefined;
    let alive = true;
    fetch(`/api/web/page?url=${encodeURIComponent(url)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok || j?.ok === false) {
          setWebErr(j?.error || `Seite nicht prüfbar (HTTP ${r.status})`);
          return;
        }
        setWebPage(j);
      })
      .catch((e) => {
        if (alive) setWebErr(e?.message || String(e));
      });
    return () => {
      alive = false;
    };
  }, [open, isWeb, url, webReload]);

  const webBlocked = Boolean(webPage && webPage.embeddable === false);
  const showText = webBlocked || textAnsicht;

  useEffect(() => {
    if (!open || !path || isPdf || isWeb) return undefined;
    let alive = true;
    fetch(fileUrl)
      .then(async (r) => {
        if (r.ok) return r.text();
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `Datei nicht ladbar (HTTP ${r.status})`);
      })
      .then((t) => {
        if (alive) setText(t);
      })
      .catch((e) => {
        if (alive) setError(String(e?.message || e));
      });
    return () => {
      alive = false;
    };
  }, [open, path, isPdf, isWeb, fileUrl]);

  useEffect(() => {
    if (!open || !isPdf || !fileUrl) return undefined;
    let alive = true;
    extractPdfPages(fileUrl)
      .then((pages) => {
        if (alive) setPdfPages(pages);
      })
      .catch((e) => {
        if (alive) setPdfErr(String(e?.message || e));
      });
    return () => {
      alive = false;
    };
  }, [open, isPdf, fileUrl]);

  const pdfHits = useMemo(
    () => (isPdf && pdfPages ? findInPages(pdfPages, query) : []),
    [isPdf, pdfPages, query],
  );
  const mdHits = useMemo(
    () => (!isPdf && !isWeb ? findMatchOffsets(text, query) : []),
    [isPdf, isWeb, text, query],
  );
  const hits = isPdf ? pdfHits : mdHits;
  const pdfNoText =
    isPdf && Array.isArray(pdfPages) && pdfPages.every((p) => !p.text);

  useEffect(() => {
    setHitIndex(0);
  }, [query, path, url]);

  useEffect(() => {
    if (!isPdf || !pdfHits.length || !fileUrl) return;
    const page = pdfHits[Math.min(hitIndex, pdfHits.length - 1)]?.page;
    if (!page) return;
    setFrameSrc(`${fileUrl}#page=${page}`);
  }, [isPdf, pdfHits, hitIndex, fileUrl]);

  useEffect(() => {
    if (isPdf || isWeb || !query.trim() || !mdHits.length || !textRef.current) return;
    const marks = textRef.current.querySelectorAll("mark.source-mark");
    const el = marks[Math.min(hitIndex, marks.length - 1)];
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [isPdf, isWeb, query, hitIndex, mdHits.length, text]);

  const paintMarks = useCallback(() => {
    const root = textRef.current;
    if (!root) return;
    const marks = root.querySelectorAll("mark.source-mark");
    for (const m of marks) {
      const parent = m.parentNode;
      if (!parent) continue;
      parent.replaceChild(document.createTextNode(m.textContent || ""), m);
      parent.normalize();
    }
    const q = query.trim();
    if (!q) return;
    const needle = q.toLowerCase();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node = walker.nextNode();
    while (node) {
      nodes.push(node);
      node = walker.nextNode();
    }
    let nth = 0;
    for (const textNode of nodes) {
      const value = textNode.nodeValue || "";
      const lower = value.toLowerCase();
      if (!lower.includes(needle)) continue;
      const frag = document.createDocumentFragment();
      let from = 0;
      let i = lower.indexOf(needle, from);
      while (i >= 0) {
        if (i > from) frag.appendChild(document.createTextNode(value.slice(from, i)));
        const mark = document.createElement("mark");
        mark.className =
          nth === hitIndex ? "source-mark source-mark--on" : "source-mark";
        mark.textContent = value.slice(i, i + q.length);
        frag.appendChild(mark);
        nth += 1;
        from = i + q.length;
        i = lower.indexOf(needle, from);
      }
      if (from < value.length) frag.appendChild(document.createTextNode(value.slice(from)));
      textNode.parentNode?.replaceChild(frag, textNode);
    }
  }, [query, hitIndex]);

  useEffect(() => {
    if (isPdf || isWeb) return undefined;
    paintMarks();
    return undefined;
  }, [isPdf, isWeb, text, query, hitIndex, paintMarks]);

  const vault = sourceVault(file);
  const ext = !isWeb ? obsidianUrl(file) : "";
  const title = sourceTitle(file) || shortLinkLabel(url) || "Quelle";
  const kicker = isWeb ? "Quelle · Web" : vault ? `Quelle · ${vault}` : "Quelle";
  const canFind = !isWeb;
  const pdfLoading = isPdf && pdfPages === null && !pdfErr;
  const findDisabled = isPdf && (pdfNoText || pdfErr || pdfLoading);

  const onResizePointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    const panel = e.currentTarget.parentElement;
    if (!panel) return;
    const startX = e.clientX;
    const startW = panel.getBoundingClientRect().width;
    const onMove = (ev) => {
      const next = Math.round(
        Math.min(Math.max(startW + (startX - ev.clientX), 400), window.innerWidth - 36),
      );
      setDrawerW(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      try {
        const w = panel.getBoundingClientRect().width;
        if (w >= 400) sessionStorage.setItem("glyph-source-w", String(Math.round(w)));
      } catch {
        /* private mode */
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  const mdSnippets = !isPdf && !isWeb && query.trim()
    ? mdHits.slice(0, 12).map((m, i) => ({
        i,
        snippet: snippetAround(text, m.start, m.end),
      }))
    : [];

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={title}
      kicker={kicker}
      side={side}
      mode={mode}
      className="source-viewer"
      ariaLabel="Quelldatei"
      closeLabel={isWeb ? "" : "Zurück"}
      style={
        drawerW
          ? { width: `${drawerW}px`, maxWidth: "calc(100% - 20px)" }
          : undefined
      }
      gutter={
        <div
          className="source-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Fensterbreite"
          onPointerDown={onResizePointerDown}
        />
      }
      headExtra={
        ext ? (
          <div className="source-open-row">
            <a className="ghost source-open-ext" href={ext} title="In Obsidian öffnen">
              Obsidian
            </a>
          </div>
        ) : null
      }
    >
      {canFind ? (
        <SourceFindBar
          query={query}
          onQuery={setQuery}
          hits={hits}
          index={hitIndex}
          onIndex={setHitIndex}
          disabled={findDisabled}
          emptyHint={
            pdfLoading ? "lädt …" : pdfErr ? "Text nicht lesbar" : pdfNoText ? "Scan — kein Text" : ""
          }
        />
      ) : null}

      {isWeb ? (
        <div className="source-web">
          {showText ? (
            <div className="source-web-text">
              <p className="source-web-hint">
                {webBlocked
                  ? "Diese Seite verbietet die Einbettung (X-Frame-Options) — hier als Textansicht."
                  : "Textansicht. Die ganze Seite öffnet „Browser“."}
              </p>
              <p className="source-web-url">{(webPage && webPage.url) || url}</p>
              {webPage && webPage.text
                ? webPage.text.split(/\n{2,}/).map((para, i) => (
                    <p className="source-web-p" key={`p${i}`}>
                      {para}
                    </p>
                  ))
                : null}
              {!webPage || !webPage.text ? (
                <p className="source-web-hint">
                  {webErr ? `Kein Text ladbar — ${webErr}.` : "Lädt …"}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <iframe
                className="source-frame"
                src={url}
                title={title}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                referrerPolicy="no-referrer"
              />
              <p className="source-web-hint">
                {webErr
                  ? `Seitenprüfung fehlgeschlagen (${webErr}). Bei leerem Fenster: „Textansicht“ oder „Browser“.`
                  : "Sitzt die Seite leer, ist die Einbettung gesperrt — dann „Textansicht“."}
              </p>
            </>
          )}
          <div className="source-actions">
            {webBlocked ? null : (
              <button
                type="button"
                className="source-action"
                onClick={() => {
                  setTextAnsicht((v) => !v);
                  if (!webPage) setWebReload((n) => n + 1);
                }}
              >
                {showText ? "Im Fenster" : "Textansicht"}
              </button>
            )}
            {url ? (
              <button
                type="button"
                className="source-action"
                onClick={() => openWebUrl(url)}
              >
                Browser
              </button>
            ) : null}
            <button type="button" className="source-action" onClick={onClose}>
              Zurück
            </button>
          </div>
        </div>
      ) : isPdf ? (
        <iframe
          className="source-frame"
          src={frameSrc || fileUrl}
          title={title}
        />
      ) : error ? (
        <p className="source-error">{error}</p>
      ) : (
        <div className="source-text" ref={textRef}>
          <MarkdownBody text={text || "lädt …"} />
          {mdSnippets.length > 1 ? (
            <ol className="source-hit-list">
              {mdSnippets.map((s) => (
                <li key={s.i}>
                  <button
                    type="button"
                    className={s.i === hitIndex ? "is-on" : ""}
                    onClick={() => setHitIndex(s.i)}
                  >
                    {s.snippet}
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      )}

      {isPdf && pdfHits.length > 1 ? (
        <ol className="source-hit-list">
          {pdfHits.slice(0, 16).map((h, i) => (
            <li key={`${h.page}-${h.start}-${i}`}>
              <button
                type="button"
                className={i === hitIndex ? "is-on" : ""}
                onClick={() => setHitIndex(i)}
              >
                S. {h.page} · {h.snippet}
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </SideDrawer>
  );
}

export { SourceViewer };
