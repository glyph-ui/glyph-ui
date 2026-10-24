/**
 * Vault-PDF als Seiten, nicht als iframe. +/− ändert die Seitengröße.
 */
import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { pageDrawScale } from "../utils/pdfView.js";

GlobalWorkerOptions.workerSrc = workerSrc;

function PdfSheet({ url, zoom, focusPage }) {
  const scrollRef = useRef(null);
  const pagesRef = useRef(null);
  const [status, setStatus] = useState("");
  const [fail, setFail] = useState("");
  const [drawn, setDrawn] = useState(0);

  /** Geladenes PDF + URL im Cache: Zoom darf das Dokument nicht neu laden. */
  const docRef = useRef(null);
  /** Sichtbare Seite + Offset vor dem Neuzeichnen (Zoom darf nicht nach oben springen). */
  const anchorRef = useRef(null);

  useEffect(() => {
    const scroll = scrollRef.current;
    const host = pagesRef.current;
    if (!url || !scroll || !host) return undefined;

    // Anker vor dem Leeren merken: erste Seite, die den oberen Rand berührt.
    let anchor = null;
    for (const el of host.querySelectorAll("[data-pdf-page]")) {
      const rel = el.offsetTop - scroll.scrollTop;
      if (rel <= 24) {
        anchor = {
          page: el.dataset.pdfPage,
          offset: scroll.scrollTop - el.offsetTop,
        };
      } else {
        break;
      }
    }
    anchorRef.current = anchor;

    let cancelled = false;
    const tasks = [];
    let timer = null;

    const run = async () => {
      try {
        if (!docRef.current || docRef.current.url !== url) {
          if (docRef.current?.doc) {
            await docRef.current.doc.destroy().catch(() => {});
          }
          const doc = await getDocument({ url }).promise;
          if (cancelled) {
            await doc.destroy().catch(() => {});
            return;
          }
          docRef.current = { url, doc };
        }
        const doc = docRef.current.doc;
        const box = Math.max(120, scroll.clientWidth - 16);
        let okPages = 0;
        host.replaceChildren();
        setStatus("lädt …");
        setFail("");
        for (let n = 1; n <= doc.numPages; n += 1) {
          if (cancelled) break;
          try {
            const page = await doc.getPage(n);
            const base = page.getViewport({ scale: 1 });
            const scale = pageDrawScale(box, base.width, zoom);
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const view = page.getViewport({ scale });
            const pixel = page.getViewport({ scale: scale * dpr });
            const wrap = document.createElement("div");
            wrap.className = "source-pdf-page";
            wrap.dataset.pdfPage = String(n);
            wrap.style.width = `${view.width}px`;
            wrap.style.height = `${view.height}px`;
            const canvas = document.createElement("canvas");
            canvas.width = Math.floor(pixel.width);
            canvas.height = Math.floor(pixel.height);
            canvas.style.width = `${view.width}px`;
            canvas.style.height = `${view.height}px`;
            wrap.appendChild(canvas);
            host.appendChild(wrap);
            const task = page.render({
              canvasContext: canvas.getContext("2d"),
              viewport: pixel,
            });
            tasks.push(task);
            await task.promise;
            okPages += 1;
          } catch (e) {
            if (cancelled) break;
            if (String(e?.name || "") === "RenderingCancelledException") break;
            const wrap = document.createElement("div");
            wrap.className = "source-pdf-page source-pdf-page--err";
            wrap.dataset.pdfPage = String(n);
            wrap.style.minHeight = "120px";
            wrap.textContent = `Seite ${n} nicht darstellbar`;
            host.appendChild(wrap);
          }
        }
        if (cancelled) return;
        setStatus("");
        if (!okPages) setFail("PDF nicht darstellbar");
        setDrawn((n) => n + 1);
        // Nach dem Neuzeichnen zurück an die vorher sichtbare Stelle.
        const target = anchorRef.current;
        if (target?.page) {
          const el = host.querySelector(
            `[data-pdf-page="${target.page}"]`,
          );
          if (el) {
            scroll.scrollTop = Math.max(0, el.offsetTop + target.offset);
          }
        }
        anchorRef.current = null;
      } catch (e) {
        if (cancelled) return;
        const name = String(e?.name || "");
        if (name === "RenderingCancelledException") return;
        setStatus("");
        setFail("PDF nicht darstellbar");
      }
    };

    // Zoom-Schritte bündeln: schnelles +/− löst nicht für jeden Klick einen
    // kompletten Neuaufbau aus.
    timer = window.setTimeout(() => {
      void run();
    }, 120);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      for (const task of tasks) {
        try {
          task.cancel();
        } catch {
          /* schon fertig */
        }
      }
    };
  }, [url, zoom]);

  // Dokument erst freigeben, wenn die Datei wechselt oder das Sheet verschwindet.
  useEffect(() => () => {
    const current = docRef.current;
    docRef.current = null;
    if (current?.doc) current.doc.destroy().catch(() => {});
  }, [url]);

  useEffect(() => {
    if (!focusPage || !pagesRef.current) return;
    pagesRef.current
      .querySelector(`[data-pdf-page="${focusPage}"]`)
      ?.scrollIntoView({ block: "start" });
  }, [focusPage, drawn]);

  return (
    <div className="source-pdf-scroll" ref={scrollRef}>
      {status ? <p className="source-pdf-status">{status}</p> : null}
      {fail ? <p className="source-pdf-err">{fail}</p> : null}
      <div className="source-pdf-pages" ref={pagesRef} />
    </div>
  );
}

export { PdfSheet };
