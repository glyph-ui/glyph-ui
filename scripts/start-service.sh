#!/bin/bash
# Start Glyph UI bridge + static UI as a background service.
# Designed for launchd: absolute paths, no TTY required.
# App launcher "Glyph" → http://localhost:5174/
#
# Copyright (c) 2026 Alexander Hubert — MIT License

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOME_DIR="${HOME:-$(eval echo ~)}"

# Prefer user-local and Homebrew paths without hardcoding a specific username.
export PATH="${HOME_DIR}/.local/bin:${HOME_DIR}/.grok/bin:/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:${PATH:-}"

# .env-Werte für die Pfade/Ports, die hier als Defaults gesetzt werden.
# Node's --env-file überschreibt bereits gesetzte Variablen NICHT — ohne dieses
# Vorlesen würde .env für PORT/HOST/... im Dienst wirkungslos bleiben.
env_from_file() {
  local key="$1" line val
  [[ -f "$ROOT/.env" ]] || return 0
  line="$(
    grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$ROOT/.env" 2>/dev/null |
      tail -n 1 || true
  )"
  [[ -n "$line" ]] || return 0
  val="${line#*=}"
  val="${val%$'\r'}"
  if [[ "$val" == \"*\" || "$val" == \'*\' ]]; then
    val="${val:1:${#val}-2}"
  fi
  printf '%s' "$val"
}

export NODE_ENV=production
[[ -n "${HOST:-}" ]] || HOST="$(env_from_file HOST)"
[[ -n "${PORT:-}" ]] || PORT="$(env_from_file PORT)"
[[ -n "${GLYPH_UI_STATE_DIR:-}" ]] || GLYPH_UI_STATE_DIR="$(env_from_file GLYPH_UI_STATE_DIR)"
[[ -n "${GLYPH_UI_CWD:-}" ]] || GLYPH_UI_CWD="$(env_from_file GLYPH_UI_CWD)"
[[ -n "${GROK_BIN:-}" ]] || GROK_BIN="$(env_from_file GROK_BIN)"

export HOST="${HOST:-127.0.0.1}"
# Match Safari Web App start_url (http://localhost:5174/)
export PORT="${PORT:-5174}"
export GLYPH_UI_STATE_DIR="${GLYPH_UI_STATE_DIR:-${HOME_DIR}/.glyph-ui}"

if [[ -z "${GROK_BIN:-}" ]]; then
  if [[ -x "${HOME_DIR}/.grok/bin/grok" ]]; then
    export GROK_BIN="${HOME_DIR}/.grok/bin/grok"
  else
    export GROK_BIN="$(command -v grok 2>/dev/null || echo grok)"
  fi
fi

export GLYPH_UI_CWD="${GLYPH_UI_CWD:-${ROOT}}"
export NO_COLOR=1

cd "$ROOT"

if [[ ! -d "$ROOT/client/dist" ]]; then
  echo "client/dist missing — run: npm run build" >&2
  exit 1
fi

if [[ ! -x "$GROK_BIN" ]] && ! command -v grok >/dev/null 2>&1; then
  echo "grok binary not found (set GROK_BIN or install grok in PATH)" >&2
  exit 1
fi

# Resolve node binary (portable).
if [[ -n "${NODE_BIN:-}" && -x "${NODE_BIN}" ]]; then
  NODE_EXEC="$NODE_BIN"
elif command -v node >/dev/null 2>&1; then
  NODE_EXEC="$(command -v node)"
elif [[ -x "${HOME_DIR}/.local/bin/node" ]]; then
  NODE_EXEC="${HOME_DIR}/.local/bin/node"
else
  echo "node not found in PATH" >&2
  exit 1
fi

# Free our port if a leftover bridge from a previous crash still holds it.
# shellcheck source=scripts/_release-own-port.sh
source "$ROOT/scripts/_release-own-port.sh"
release_own_port "$PORT" "$ROOT"

# Load project .env when present (Node 22+; optional — no fail if missing)
exec "$NODE_EXEC" --env-file-if-exists="$ROOT/.env" "$ROOT/server/index.js"
