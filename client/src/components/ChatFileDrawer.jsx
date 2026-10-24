/**
 * Chat-Datei im Seitenfenster. Speichern lädt die Datei. Schließen lässt sie im Chat.
 * Copyright (c) 2026 Alexander Hubert — MIT License
 */
import { useLayoutEffect, useRef, useState } from "react";
import { SideDrawer } from "./SideDrawer.jsx";
import m002Sign from "../signs/M002.svg";
import m009Sign from "../signs/M009.svg";
import e003Sign from "../signs/E003.svg";
import w012Sign from "../signs/W012.svg";
import w017Sign from "../signs/W017.svg";
import w071Sign from "../signs/W071.svg";

const SIGN_LABEL = {
  W008: "Warnung vor Absturzgefahr",
  W011: "Warnung vor Rutschgefahr",
  W012: "Elektrische Spannung",
  W017: "Heiße Oberfläche",
  W071: "Gesundheitsgefährdender Stoff",
  M002: "Betriebsanleitung beachten",
  M008: "Fußschutz benutzen",
  M009: "Handschutz benutzen",
  M012: "Handlauf benutzen",
  E003: "Erste Hilfe",
};

function SignGlyph({ code }) {
  if (code === "W012") return <img src={w012Sign} alt="" className="iso-svg" />;
  if (code === "W017") return <img src={w017Sign} alt="" className="iso-svg" />;
  if (code === "W071") return <img src={w071Sign} alt="" className="iso-svg" />;
  if (code === "W008") {
    return (
      <svg viewBox="0 0 64 64" className="iso-svg" aria-hidden="true">
        <polygon points="32,3 61,58 3,58" fill="#f5c400" stroke="#111" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="40" cy="24" r="4" fill="#111" />
        <path d="M38 28 L28 42 M34 34 L46 30 M28 42 L20 52 M28 42 L38 52" stroke="#111" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (code === "W011") {
    return (
      <svg viewBox="0 0 64 64" className="iso-svg" aria-hidden="true">
        <polygon points="32,3 61,58 3,58" fill="#f5c400" stroke="#111" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="34" cy="26" r="4" fill="#111" />
        <path d="M33 30 L38 42 M38 42 L50 48 M38 42 L28 52 M16 50 H50" stroke="#111" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (code === "M002") {
    return <img src={m002Sign} alt="" className="iso-svg" />;
  }
  if (code === "M008") {
    return (
      <svg viewBox="0 0 64 64" className="iso-svg" aria-hidden="true">
        <circle cx="32" cy="32" r="26" fill="#0057b8" />
        <path d="M24 18 h12 v16 h14 v8 H18 v-8 h6 z" fill="#fff" />
      </svg>
    );
  }
  if (code === "M009") return <img src={m009Sign} alt="" className="iso-svg" />;
  if (code === "M012") {
    return (
      <svg viewBox="0 0 64 64" className="iso-svg" aria-hidden="true">
        <circle cx="32" cy="32" r="26" fill="#0057b8" />
        <path d="M20 14 v36" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        <circle cx="34" cy="22" r="5" fill="#fff" />
        <path d="M34 28 L46 40" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }
  if (code === "E003") {
    return <img src={e003Sign} alt="" className="iso-svg" />;
  }
  const kind = (code[0] || "w").toLowerCase();
  return <span className={`iso-fallback iso-${kind}`}>{code}</span>;
}

const SIGN_SHOWN = new Set(["W071", "W017", "W012", "M009", "M002", "E003"]);

function SignRow({ line }) {
  const codes = line.replace(/^ISO 7010:?\s*/i, "").split("·").map((s) => s.trim()).filter((code) => SIGN_SHOWN.has(code));
  if (!codes.length) return null;
  return (
    <p className="iso-row">
      {codes.map((code) => (
        <span key={code} className="iso-fig" title={SIGN_LABEL[code] || ""}>
          <SignGlyph code={code} />
        </span>
      ))}
    </p>
  );
}

function sheetBlocks(text) {
  const blocks = [];
  let current = null;
  const push = () => {
    if (current) blocks.push(current);
    current = null;
  };
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (!line) {
      push();
      continue;
    }
    const head = /^(?:\d+\.\s|Betriebsanweisung$|Firma:|Nummer:|Datum:|Unterschrift:)/.test(line);
    if (head) {
      push();
      current = { head: line, signs: "", body: [] };
      continue;
    }
    if (!current) current = { head: "", signs: "", body: [] };
    if (/^ISO 7010\b/i.test(line) && !current.signs) {
      current.signs = line;
      continue;
    }
    current.body.push(line);
  }
  push();
  return blocks;
}

function A4Sheet({ text }) {
  const pageRef = useRef(null);
  const fitRef = useRef(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const page = pageRef.current;
    const fit = fitRef.current;
    if (!page || !fit) return;
    fit.style.transform = "none";
    fit.style.width = "100%";
    const need = fit.scrollHeight;
    const avail = page.clientHeight;
    const next = need > avail && need > 0 ? avail / need : 1;
    setScale((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
  }, [text]);
  const blocks = sheetBlocks(text);
  return (
    <div className="a4-page" ref={pageRef}>
      <div
        className="a4-fit"
        ref={fitRef}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: scale < 1 ? `${100 / scale}%` : "100%",
        }}
      >
        {blocks.map((block, i) => (
          <div className="ba-sec" key={i}>
            <div className="ba-main">
              {block.head ? <p className="ba-head">{block.head}</p> : null}
              {block.body.map((line, j) =>
                line.startsWith("• ") ? (
                  <p key={j} className="ba-point">{line.slice(2)}</p>
                ) : (
                  <p key={j} className={/^[A-ZÄÖÜ]/.test(line) && !/[.!?]$/.test(line) && line.length <= 42 ? "ba-sub" : undefined}>{line}</p>
                ),
              )}
            </div>
            {block.signs ? <SignRow line={block.signs} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function saveFile(file) {
  const a = document.createElement("a");
  a.href = file.url;
  a.download = file.name || "Datei";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function ChatFileDrawer({ file, open, onClose }) {
  const isPdf = String(file?.mime || "").includes("pdf") || String(file?.name || "").endsWith(".pdf");
  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={file?.title || "Datei"}
      kicker={isPdf ? "PDF" : "Word"}
      side="right"
      mode="overlay"
      className="source-viewer"
      ariaLabel="Chat-Datei"
      closeLabel="Zurück"
      headExtra={
        file?.url ? (
          <button type="button" className="ghost" onClick={() => saveFile(file)}>
            Speichern
          </button>
        ) : null
      }
    >
      {file?.url && isPdf ? (
        <iframe className="source-frame" title={file.title || "PDF"} src={file.url} />
      ) : (
        <article className="chat-file-sheet chat-file-a4">
          <A4Sheet text={file?.text || ""} />
        </article>
      )}
    </SideDrawer>
  );
}
