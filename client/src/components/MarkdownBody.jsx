/**
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */
import { Children, memo, useMemo, useSyncExternalStore } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import {
  classifyLink,
  linkifyAnswer,
  looksLikeVaultFile,
  shortLinkLabel,
  siteLabel,
  sourceKind,
  sourceKindLabel,
  subscribeVaults,
  vaultsVersion,
} from "../utils/sourceLinks.js";
import { openVaultSource } from "../utils/sourceOpen.js";
import { splitByQuery } from "../utils/highlight.js";

// Stable identities — do not recreate per render (matters when text changes).
const REMARK_PLUGINS = [remarkGfm, remarkBreaks];

function vaultTitle(path) {
  const p = String(path || "");
  return p.split("/").pop() || p;
}

function flattenText(node) {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (typeof node === "object" && node.props) return flattenText(node.props.children);
  return "";
}

/** vaultopen:/obsidian: dürfen nicht an defaultUrlTransform sterben. */
function glyphUrlTransform(url) {
  const u = String(url || "");
  if (u.startsWith("vaultopen:") || /^obsidian:/i.test(u)) return u;
  return defaultUrlTransform(u);
}

/**
 * Suchtreffer als React-Knoten markieren (kein DOM-Hack).
 *
 * Vorher lief paintMarks() im Quellen-Fenster und ersetzte Text-Knoten im
 * von React gerenderten Baum. Beim Schliessen des Fensters versuchte React
 * danach, genau diesen Knoten zu entfernen — er existierte nicht mehr →
 * NotFoundError → die ganze UI wurde weiss. React-verwaltete Markierung
 * kann das nicht mehr ausloesen.
 */
function highlightNodes(children, query) {
  if (!String(query || "").trim()) return children;
  const walk = (node, keyPrefix) => {
    if (typeof node !== "string") return node;
    const parts = splitByQuery(node, query);
    if (parts.length === 1 && !parts[0].hit) return node;
    return parts.map((p, i) =>
      p.hit ? (
        <mark className="source-mark" key={`${keyPrefix}-m${i}`}>
          {p.text}
        </mark>
      ) : (
        p.text
      ),
    );
  };
  return Children.map(children, (child, i) => walk(child, `h${i}`));
}

function MdLink({ href, children, ...props }) {
  const origin = typeof globalThis !== "undefined" ? globalThis.location?.origin || "" : "";
  let hit = classifyLink(href, origin);
  if (hit.kind === "internal") {
    const t = flattenText(children).trim();
    if (looksLikeVaultFile(t)) hit = { kind: "vault", path: t };
    else if (/^https?:\/\//i.test(t)) hit = classifyLink(t, origin);
    // Eigener Vault-Proxy (/api/vault/file?path=…): Datei in Glyph öffnen,
    // nicht den Pfad anzeigen. Der Pfad steckt in der URL.
    if (hit.kind === "internal" && /^\/api\/vault\/file\?/i.test(String(href))) {
      try {
        const u = new URL(String(href), origin || "http://x");
        const p = u.searchParams.get("path");
        if (p) hit = { kind: "vault", path: p };
      } catch {
        /* kein gueltiger Pfad */
      }
    }
  }

  const raw = flattenText(children).trim();

  // Regel: Quellen sind überall Chips (Kürzel + Titel) — Antwort, Fließtext und
  // Dokument. Nie Fließtext-Links (Nutzer-Vorgabe 2026-10-02).
  if (hit.kind === "vault" && hit.path) {
    const label =
      raw === hit.path || raw.endsWith(hit.path) || looksLikeVaultFile(raw)
        ? vaultTitle(hit.path)
        : children;
    const title = `${vaultTitle(hit.path)} — in Glyph öffnen`;
    const onOpen = () => openVaultSource({ path: hit.path, title: vaultTitle(hit.path) });
    const kind = sourceKind({ path: hit.path });
    return (
      <button type="button" className="source-chip source-chip--inline" title={title} onClick={onOpen}>
        <span className={`source-chip-kind source-chip-kind--${kind}`} aria-hidden="true">
          {sourceKindLabel(kind)}
        </span>
        <span className="source-chip-name">{label}</span>
      </button>
    );
  }

  if (hit.kind === "web" && hit.url) {
    // Sichtbar nur die Domain. Der volle Pfad stand hier frueher mit und machte
    // die Zeile lang, ohne etwas zu erklaeren — er steht im Tooltip und im
    // Vorschaufenster, wo man dem Link auch folgen kann.
    const label =
      /^https?:\/\//i.test(raw) || raw === hit.url.replace(/^https?:\/\//i, "")
        ? siteLabel(hit.url)
        : children;
    const title = `${hit.url} — in Glyph öffnen`;
    const onOpen = (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      openVaultSource({
        kind: "web",
        url: hit.url,
        path: hit.url,
        title: shortLinkLabel(hit.url),
      });
    };
    // Kompakter Knopf ohne „WEB"-Kürzel: im Fließtext ist jedes Ziel eine
    // Web-Quelle — das Wort wäre nur Ballast (Nutzeroberfläche 2026-10-02).
    return (
      <a href={hit.url} className="source-chip source-chip--inline" title={title} onClick={onOpen}>
        <span className="source-chip-name">{label}</span>
      </a>
    );
  }

  if (hit.kind === "obsidian" || hit.kind === "hash") {
    const obs = hit.kind === "obsidian";
    return (
      <a href={href} className="source-chip source-chip--inline" {...props}>
        <span
          className={`source-chip-kind source-chip-kind--${obs ? "web" : "md"}`}
          aria-hidden="true"
        >
          {obs ? "OBS" : "#"}
        </span>
        <span className="source-chip-name">{children}</span>
      </a>
    );
  }

  return <span className="md-plain-link">{children}</span>;
}

const MD_BASE = {
  // Avoid huge default margins inside tight chat bubbles
  p: ({ children }) => <p className="md-p">{children}</p>,
  br: () => <br />,
  ul: ({ children }) => <ul className="md-list">{children}</ul>,
  ol: ({ children }) => <ol className="md-list md-list--ol">{children}</ol>,
  li: ({ children }) => <li className="md-li">{children}</li>,
  h1: ({ children }) => <h3 className="md-h">{children}</h3>,
  h2: ({ children }) => <h3 className="md-h">{children}</h3>,
  h3: ({ children }) => <h4 className="md-h md-h--sm">{children}</h4>,
  h4: ({ children }) => <h4 className="md-h md-h--sm">{children}</h4>,
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.includes("language-"));
    if (isBlock) {
      return (
        <code className={`md-code-block ${className || ""}`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="md-code-inline" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="md-pre">{children}</pre>,
  blockquote: ({ children }) => (
    <blockquote className="md-quote">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="md-table-wrap">
      <table className="md-table">{children}</table>
    </div>
  ),
};

/** Quellen überall als Chip-Buttons (Regel) — Antwort, Fließtext und Dokument. */
const MD_COMPONENTS = {
  ...MD_BASE,
  a: MdLink,
};

/** Komponenten mit Such-Highlight (nur im Quellen-Fenster genutzt). */
function highlightComponents(query) {
  if (!String(query || "").trim()) return MD_COMPONENTS;
  const hl = (Tag, className) =>
    function Highlighted({ children }) {
      return (
        <Tag className={className}>{highlightNodes(children, query)}</Tag>
      );
    };
  return {
    ...MD_COMPONENTS,
    p: hl("p", "md-p"),
    li: hl("li", "md-li"),
    h1: hl("h3", "md-h"),
    h2: hl("h3", "md-h"),
    h3: hl("h4", "md-h md-h--sm"),
    h4: hl("h4", "md-h md-h--sm"),
  };
}

/**
 * Chat markdown: GFM + single newlines as hard breaks (Enter in the composer).
 * Without remark-breaks, Markdown collapses "line1\\nline2" into one line.
 *
 * memo: streaming re-renders App for every chunk; only the message whose
 * `text` changed should re-parse. Older bubbles keep their last tree.
 */
const MarkdownBody = memo(function MarkdownBody({ text, highlight = "" }) {
  // Neu rendern, sobald die Vault-Namen geladen sind (sonst blieben Pfade mit
  // Leerzeichen in bereits gerenderten Nachrichten unverlinkt).
  const vaultsV = useSyncExternalStore(subscribeVaults, vaultsVersion);
  const source = useMemo(
    () => linkifyAnswer(text ?? ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, vaultsV],
  );
  const components = useMemo(
    () => highlightComponents(highlight),
    [highlight],
  );
  if (!source.trim()) {
    return <div className="md-body md-body--empty" />;
  }
  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        urlTransform={glyphUrlTransform}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
});

export { MarkdownBody };
