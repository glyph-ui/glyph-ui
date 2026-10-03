/**
 * Glyph identity: git commit count (integer, drift) + dotted mark (#0.9.0).
 * Injected at Vite build / dev from git + package.json.
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */
import { glyphBuildLabel } from "../../shared/buildMark.mjs";

export { glyphBuildLabel };

/** package.json semver — secondary to the build mark. @type {string} */
export const GLYPH_VERSION =
  typeof __GLYPH_VERSION__ !== "undefined" && __GLYPH_VERSION__
    ? String(__GLYPH_VERSION__)
    : "0.0.0-dev";

/**
 * Git commit count (`git rev-list --count HEAD`). Compare UI vs Bridge.
 * @type {number}
 */
export const GLYPH_BUILD =
  typeof __GLYPH_BUILD__ !== "undefined" && __GLYPH_BUILD__ != null
    ? Number(__GLYPH_BUILD__) || 0
    : 0;

/** Header mark: 90 → #0.9.0, 112 → #1.1.2. */
export const GLYPH_BUILD_LABEL = glyphBuildLabel(GLYPH_BUILD);

/**
 * Bauzeit des Bundles („02.10., 23:20"), beim Build eingebacken. Nur Anzeige —
 * macht sichtbar, welchen Build eine geöffnete Seite wirklich hat (Cache-Fall).
 * @type {string}
 */
export const GLYPH_BUILD_STAMP =
  typeof __GLYPH_STAMP__ !== "undefined" && __GLYPH_STAMP__
    ? String(__GLYPH_STAMP__)
    : "";
