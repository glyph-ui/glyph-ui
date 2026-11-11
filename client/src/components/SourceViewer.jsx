/**
 * SourceViewer — zitierte Quelle im Seitenfenster (Vault-PDF/Notiz oder Web).
 *
 * PDF: nativer Viewer + Begriffsuche (Textlayer via pdfjs). Web: iframe,
 * Fuß Browser (+ Textansicht). Vault: Obsidian im Kopf. Chat bleibt, Esc/×.
 *
 * Copyright (c) 2026 Alexander Hubert · SPDX-License-Identifier: MIT
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SideDrawer } from "./SideDrawer.jsx";
import { MarkdownBody } from "./MarkdownBody.jsx";
import {
  IconChevronLeft,
  IconChevronRight,
  IconCheck,
  IconClose,
  IconCollapse,
  IconDocument,
  IconDownload,
  IconExpand,
  IconGlobe,
} from "./icons.jsx";
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
import { PdfSheet } from "./PdfSheet.jsx";

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
        title="Vorheriger Treffer"
      >
        <IconChevronLeft size={16} />
      </button>
      <button
        type="submit"
        className="ghost source-find-nav"
        disabled={!n}
        onClick={(e) => {
          // Submit-Button: Enter im Feld springt weiter; Klick ebenso.
          e.preventDefault();
          if (n) onIndex((index + 1) % n);
        }}
        aria-label="Nächster Treffer"
        title="Nächster Treffer"
      >
        <IconChevronRight size={16} />
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
  const [pdfZoom, setPdfZoom] = useState(100);
  const [saveErr, setSaveErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [maxW, setMaxW] = useState(() => {
    try {
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches) {
        return false;
      }
      return sessionStorage.getItem("glyph-source-max") === "1";
    } catch {
      return false;
    }
  });
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
  // Office-/Textdateien: der Agent extrahiert den Text (docx/xlsx/pptx/txt).
  const isDoc = kind === "docx" || kind === "xlsx" || kind === "pptx" || kind === "text";
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
    setPdfZoom(100);
    setSaveErr("");
    setSaved(false);
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
    const url = isDoc ? `${fileUrl}&format=text` : fileUrl;
    fetch(url)
      .then(async (r) => {
        if (r.ok) {
          if (!isDoc) return r.text();
          const j = await r.json().catch(() => ({}));
          if (j?.ok === false) throw new Error(j.error || "Text nicht extrahierbar");
          return String(j?.text || "");
        }
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
  }, [open, path, isPdf, isWeb, isDoc, fileUrl]);

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

  const pdfFocus = isPdf && pdfHits.length
    ? pdfHits[Math.min(hitIndex, pdfHits.length - 1)]?.page || 0
    : 0;

  useEffect(() => {
    if (isPdf || isWeb || !query.trim() || !mdHits.length || !textRef.current) return;
    const marks = textRef.current.querySelectorAll("mark.source-mark");
    const el = marks[Math.min(hitIndex, marks.length - 1)];
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [isPdf, isWeb, query, hitIndex, mdHits.length, text]);

  const vault = sourceVault(file);
  const ext = !isWeb ? obsidianUrl(file) : "";
  const title = sourceTitle(file) || shortLinkLabel(url) || "Quelle";
  const kicker = isWeb ? "Quelle · Web" : vault ? `Quelle · ${vault}` : "Quelle";
  const canFind = !isWeb;
  const pdfLoading = isPdf && pdfPages === null && !pdfErr;
  const findDisabled = isPdf && (pdfNoText || pdfErr || pdfLoading);

  // Herunterladen für beide Vault-Arten über denselben Proxy-URL: PDF als
  // Blob-Download (application/pdf), Notiz als Textdatei. `a.download` regelt
  // den Dateinamen; der Browser legt die Datei in den Downloads-Ordner.
  const saveSource = useCallback(async () => {
    if (!fileUrl) return;
    setSaveErr("");
    setSaved(false);
    try {
      const r = await fetch(fileUrl);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      let name = path.split(/[/\\]/).pop() || "dokument";
      const lower = name.toLowerCase();
      if (isPdf && !lower.endsWith(".pdf")) name = `${name}.pdf`;
      if (!isPdf && !lower.endsWith(".md")) name = `${name}.md`;
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2400);
    } catch {
      setSaveErr("Herunterladen fehlgeschlagen");
    }
  }, [fileUrl, isPdf, path]);

  const onResizePointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    // Ziehen verlässt die volle Breite — Startpunkt ist die aktuelle Breite.
    setMaxW(false);
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
      className={`source-viewer${maxW ? " source-viewer--wide" : ""}`}
      ariaLabel="Quelldatei"
      closeLabel=""
      style={
        maxW
          ? undefined
          : drawerW
            ? { width: `${drawerW}px`, maxWidth: "calc(100% - 20px)" }
            : undefined
      }
      gutter={
        <div
          className="source-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Fensterbreite — ziehen oder Doppelklick für volle Breite"
          title="Ziehen ändert die Breite · Doppelklick = volle Breite"
          onPointerDown={onResizePointerDown}
          onDoubleClick={() => setMaxW(true)}
        />
      }
      headExtra={
        <div className="source-open-row">
          {!isWeb ? (
            <button
              type="button"
              className={`source-icon-btn${saved ? " is-done" : ""}`}
              onClick={saveSource}
              aria-label="Datei herunterladen"
              title="Datei herunterladen (Downloads-Ordner)"
            >
              {saved ? <IconCheck size={16} /> : <IconDownload size={17} />}
            </button>
          ) : null}
          <button
            type="button"
            className="source-icon-btn source-max-btn"
            onClick={() => setMaxW((v) => !v)}
            aria-pressed={maxW}
            aria-label={maxW ? "Zurück zur Fensterbreite" : "Volle Breite"}
            title={
              maxW
                ? "Zurück zur Fensterbreite"
                : "Volle Breite (auch: Doppelklick auf die Kante)"
            }
          >
            {maxW ? <IconCollapse size={17} /> : <IconExpand size={17} />}
          </button>
          {ext ? (
            <a
              className="source-icon-btn source-icon-btn--text"
              href={ext}
              title="In Obsidian öffnen"
            >
              Obsidian
            </a>
          ) : null}
          <button
            type="button"
            className="source-icon-btn source-icon-btn--close"
            onClick={onClose}
            aria-label="Fenster schließen"
            title="Fenster schließen (Esc)"
          >
            <IconClose size={17} />
          </button>
        </div>
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

      {saveErr ? <p className="source-error">{saveErr}</p> : null}

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
                {showText ? (
                  <>
                    <IconExpand size={15} />
                    <span>Im Fenster</span>
                  </>
                ) : (
                  <>
                    <IconDocument size={15} />
                    <span>Textansicht</span>
                  </>
                )}
              </button>
            )}
            {url ? (
              <button
                type="button"
                className="source-action"
                onClick={() => openWebUrl(url)}
              >
                <IconGlobe size={15} />
                <span>Browser</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : isPdf ? (
        <div className="source-pdf">
          <div className="source-pdf-tools">
            <button
              type="button"
              className="source-pdf-btn"
              onClick={() => setPdfZoom((z) => Math.max(50, z - 25))}
              aria-label="Kleiner"
            >
              −
            </button>
            <span className="source-pdf-zoom">{pdfZoom}%</span>
            <button
              type="button"
              className="source-pdf-btn"
              onClick={() => setPdfZoom((z) => Math.min(250, z + 25))}
              aria-label="Größer"
            >
              +
            </button>
          </div>
          <PdfSheet url={fileUrl} zoom={pdfZoom} focusPage={pdfFocus} />
        </div>
      ) : error ? (
        <p className="source-error">{error}</p>
      ) : (
        <div className="source-text" ref={textRef}>
          <MarkdownBody text={text || "lädt …"} highlight={query} />
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
