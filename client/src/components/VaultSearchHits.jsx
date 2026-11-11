/**
 * Trefferliste der manuellen Ordner-Suche — einzeln zu- und abschaltbar.
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */
import { useEffect, useState } from "react";
import { hitId, hitKindLabel, hitVaultLabel } from "../utils/vaultSearch.js";
import { ComposerSheet } from "./ComposerSheet.jsx";

export function VaultSearchHits({
  query,
  hits = [],
  selectedIds,
  busy,
  error,
  fallback = "",
  onToggle,
  onDismiss,
  onSend,
  scope = "",
  onScopeBack,
  onOpenFile,
  onSearchFolder,
  collapsed = false,
  onExpand,
}) {
  const n = hits.length;
  const chosen = selectedIds instanceof Set ? selectedIds : new Set();
  const onCount = hits.filter((h) => chosen.has(hitId(h))).length;
  void fallback; // engine may still set KomNet/DGUV; sheet title is Hub+Copy

  // Altersanzeige: nur melden, wenn der semantische Index spürbar zurückliegt.
  const [indexInfo, setIndexInfo] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/search-status")
      .then((r) => r.json())
      .then((j) => {
        if (alive) setIndexInfo(j?.index || null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const alterTage =
    indexInfo?.alter_h != null ? Math.round(Number(indexInfo.alter_h) / 24) : null;
  const indexAlt = Boolean(indexInfo && (indexInfo.stale || Number(indexInfo.alter_h) > 24));
  const indexStand = indexInfo?.stand
    ? new Date(indexInfo.stand).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";
  const indexNote = indexAlt ? (
    <p className="composer-sheet-note">
      Such-Index Stand {indexStand}
      {alterTage ? ` (${alterTage} ${alterTage === 1 ? "Tag" : "Tage"} alt)` : ""} — wird
      automatisch nachgezogen.
    </p>
  ) : null;

  let body = null;
  if (busy) {
    body = <p className="composer-sheet-note">Suche…</p>;
  } else if (error) {
    body = <p className="composer-sheet-note composer-sheet-note--err">{error}</p>;
  } else if (n === 0) {
    body = (
      <p className="composer-sheet-note">
        Keine Treffer im Vault, KomNet oder DGUV.
      </p>
    );
  } else {
    body = (
      <>
        <p className="composer-sheet-note vault-hits-subtitle">
          Treffer aus der Vault-Suche — Datei öffnen, für den Kontext wählen
          oder im Ordner weitersuchen.
        </p>
        <ul className="vault-hits-list">
          {hits.map((h) => {
            const id = hitId(h);
            const on = chosen.has(id);
            const isFolder = h.kind === "folder";
            const folderPath = isFolder
              ? String(h.path || "")
              : String(h.path || "").slice(
                  0,
                  String(h.path || "").lastIndexOf("/"),
                );
            return (
              <li key={id} className="vault-hit-row">
                <button
                  type="button"
                  className={`vault-hit${on ? " is-on" : ""}`}
                  aria-pressed={on}
                  onClick={() => onToggle(id)}
                  title={
                    isFolder
                      ? "Für den Kontext wählen"
                      : "Für den Kontext wählen · Datei öffnen"
                  }
                >
                  <span className="vault-hit-pip" aria-hidden="true" />
                  <span className="vault-hit-body">
                    <span className="vault-hit-title">
                      {hitKindLabel(h)}
                      {hitVaultLabel(h) ? ` · ${hitVaultLabel(h)}` : ""}
                      {" · "}
                      {h.title}
                    </span>
                    {h.excerpt ? (
                      <span className="vault-hit-excerpt">{h.excerpt}</span>
                    ) : h.path && h.path !== h.title ? (
                      <span className="vault-hit-excerpt">{h.path}</span>
                    ) : (
                      <span className="vault-hit-excerpt">leer</span>
                    )}
                  </span>
                </button>
                <span className="vault-hit-actions">
                  {!isFolder && onOpenFile ? (
                    <button
                      type="button"
                      className="vault-hit-action"
                      title={`${h.title} öffnen`}
                      aria-label={`${h.title} öffnen`}
                      onClick={() => onOpenFile(h)}
                    >
                      Öffnen
                    </button>
                  ) : null}
                  {folderPath && onSearchFolder ? (
                    <button
                      type="button"
                      className="vault-hit-action"
                      title={`Im Ordner suchen: ${folderPath}`}
                      aria-label={`Im Ordner ${folderPath} suchen`}
                      onClick={() => onSearchFolder(folderPath)}
                    >
                      Im Ordner suchen
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <ComposerSheet
      label="Wo weitersuchen?"
      count={busy || !n ? null : `${onCount}/${n}`}
      current={query || null}
      collapsed={collapsed}
      onToggle={onExpand}
      onDismiss={onDismiss}
      dismissTitle={busy ? "Suche abbrechen" : "Treffer verwerfen"}
      dismissLabel={busy ? "Suche abbrechen" : "Treffer verwerfen"}
      ariaLabel="Wo weitersuchen?"
      footer={
        !busy && !error && n > 0 ? (
          <button
            type="button"
            className="composer-sheet-go"
            disabled={onCount === 0}
            onClick={onSend}
          >
            Mit Auswahl erneut fragen
          </button>
        ) : null
      }
    >
      {scope ? (
        <p className="composer-sheet-note vault-hits-scope">
          Im Ordner: <span className="vault-hits-scope-path">{scope}</span>
          {onScopeBack ? (
            <button
              type="button"
              className="ghost vault-hits-scope-back"
              onClick={onScopeBack}
            >
              Zurück
            </button>
          ) : null}
        </p>
      ) : null}
      {indexNote}
      {body}
    </ComposerSheet>
  );
}
