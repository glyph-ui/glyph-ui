/**
 * Copyright (c) 2026 Alexander Hubert
 * SPDX-License-Identifier: MIT
 */
import { GlyphMark } from "./EgyptMarks.jsx";
import { TabletPhoto } from "./GraphFaces.jsx";

function IconSearch({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16.2 16.2L20.5 20.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconCompose({ size = 20 }) {
  /* Rectangle with pen — neue Session / compose */
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M13.2 8.3l2.5 2.5M8 16l.7-2.6 5.9-5.9a1.2 1.2 0 0 1 1.7 0l.9.9a1.2 1.2 0 0 1 0 1.7L11 15.3 8 16z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCommands({ size = 20 }) {
  /* ^_ — Befehle/Skills (analog Obsidian >_, passend zu ^_Code) */
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* caret ^ */}
      <path
        d="M4.75 14.25L9 8.5l4.25 5.75"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* underscore _ */}
      <path
        d="M14.25 16.75h5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Three nodes + sagging cables — Graph */
function IconLage({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="7" r="2.1" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="6.2" cy="17" r="2.1" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.8" cy="17" r="2.1" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M10.4 8.6C9 11.2 7.6 13.4 6.8 15.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M13.6 8.6C15 11.2 16.4 13.4 17.2 15.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Closed book — Kurzhandbuch (Leiste unten) */
function IconBook({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 4.75h9.25A2.25 2.25 0 0 1 18 7v12.25H8A1.5 1.5 0 0 0 6.5 20.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 4.75A1.75 1.75 0 0 0 4.75 6.5v12.5c0 .97.78 1.75 1.75 1.75H18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 8.5h5.5M9.5 12h5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Glyph mark — cartouche + Aten. Activity-calendar action is unchanged.
 */
function IconCalendar({ size = 20 }) {
  return <GlyphMark size={size} className="icon-glyph-mark" />;
}

function IconFolder({ size = 20 }) {
  return <TabletPhoto size={size} />;
}

/** Wiki / Info — circle with “i” (clearer than book/cabinet). */
function IconWiki({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="8.2" r="1.15" fill="currentColor" />
      <path
        d="M12 11.2v5.6"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconWorkspace({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10.5L12 4l8 6.5V19a1 1 0 0 1-1 1h-5v-5H10v5H5a1 1 0 0 1-1-1v-8.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTheme({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 4v16c4 0 7.5-3.6 7.5-8S16 4 12 4z" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

function IconMic({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3.5" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3.5M9 20.5h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Simple plus — attach / add in composer */
function IconPlus({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSpeaker({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9.5v5h3.2L12 18.5V5.5L7.2 9.5H4z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M15.2 9.2a3.2 3.2 0 0 1 0 5.6M17.6 7a5.6 5.6 0 0 1 0 10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCopy({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="8"
        y="8"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCheck({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSpeakerOff({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9.5v5h3.2L12 18.5V5.5L7.2 9.5H4z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/** Prefer browser-native MediaRecorder mime types that xAI STT accepts. */

function IconRefresh({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M19.5 12a7.5 7.5 0 1 1-2.1-5.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M19.5 5v4.5H15"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconStop({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

/** Aufladen: Schloss und Münze. Münze liegt auf --panel, damit sie das Schloss deckt. */
/** Papierkorb — „Gastzugang entfernen". */
function IconTrash({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 7l.8 11.4A1.7 1.7 0 0 0 9 20h6a1.7 1.7 0 0 0 1.7-1.6L17.5 7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.3 11v5M13.7 11v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Schlüssel — steht für „Kennwort ändern". Das Schloss war dafür falsch
 * belegt: es saß auf einem Knopf mit dem Titel „Aufladen" und öffnete einen
 * Dialog, der gleichzeitig Token-Pakete erklärte und das Passwort änderte.
 */
function IconKey({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8.4" cy="15.6" r="4.1" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M11.3 12.7 20 4m-3.1 3.1 2.5 2.5M14.6 9.4l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLock({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="2.75"
        y="10"
        width="12"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M5.5 10V7.7a3.25 3.25 0 0 1 6.5 0V10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="16.7" cy="16.15" r="5.35" fill="var(--panel)" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M16.7 13.15v6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Herz — „Spenden" (Web-Header): Glyph ist kostenlos nutzbar und wird über
 * Spenden finanziert. Gold-Akzent, siehe .pill-btn--donate in styles.css.
 */
function IconHeart({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Agent connected — chain link (status color via parent). */
function IconLink({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.5 14.5l5-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M11.2 16.8l-1.1 1.1a3.6 3.6 0 0 1-5.1-5.1l1.1-1.1M12.8 7.2l1.1-1.1a3.6 3.6 0 1 1 5.1 5.1l-1.1 1.1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Agent offline — broken link. */
function IconLinkOff({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.5 14.5l1.8-1.8M14.5 9.5l-1.2 1.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M11.2 16.8l-1.1 1.1a3.6 3.6 0 0 1-5.1-5.1l1.1-1.1M12.8 7.2l1.1-1.1a3.6 3.6 0 1 1 5.1 5.1l-1.1 1.1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 5l14 14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconRewind({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8.2 7.2L4.5 11l3.7 3.8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.2 11h8.1c3 0 5.4 2.1 5.4 4.8v.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Quellen-Fenster: Pfeil in Ablage — Datei herunterladen. */
function IconDownload({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4.5v10M12 14.5l-4-4M12 14.5l4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 19.5h15"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Quellen-Fenster: Ecken nach außen — volle Breite. */
function IconExpand({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14.5 4.5h5v5M9.5 19.5h-5v-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.5 4.5l-5.2 5.2M4.5 19.5l5.2-5.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Quellen-Fenster: Ecken nach innen — zurück zur Fensterbreite. */
function IconCollapse({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M19.5 9.5h-5v-5M4.5 14.5h5v5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 9.5l5-5M9.5 14.5l-5 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Quellen-Fenster: Textseite mit Zeilen — Textansicht (Web ohne iframe). */
function IconDocument({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M8.5 9h7M8.5 12.5h7M8.5 16h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Quellen-Fenster: Globus — ganze Seite im Browser öffnen. */
function IconGlobe({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M3.75 12h16.5M12 3.75c2.3 2.2 3.6 5.1 3.6 8.25S14.3 18.05 12 20.25c-2.3-2.2-3.6-5.1-3.6-8.25S9.7 5.95 12 3.75z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Quellen-Fenster: × — Fenster schließen. */
function IconClose({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Suche im Dokument: Chevron links/rechts — symmetrische Wurf-Buttons. */
function IconChevronLeft({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14.5 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevronRight({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.5 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export {
  IconSearch,
  IconCompose,
  IconCommands,
  IconLage,
  IconBook,
  IconCalendar,
  IconFolder,
  IconWiki,
  IconWorkspace,
  IconTheme,
  IconMic,
  IconPlus,
  IconSpeaker,
  IconSpeakerOff,
  IconCopy,
  IconCheck,
  IconRefresh,
  IconStop,
  IconLock,
  IconKey,
  IconHeart,
  IconTrash,
  IconLink,
  IconLinkOff,
  IconRewind,
  IconDownload,
  IconExpand,
  IconCollapse,
  IconClose,
  IconDocument,
  IconGlobe,
  IconChevronLeft,
  IconChevronRight,
};
