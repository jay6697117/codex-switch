#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_VERSION="${APP_VERSION:-0.1.0-dev}"
WAILS_CONFIG_PATH="${ROOT_DIR}/wails.json"
WAILS_CONFIG_BACKUP="$(mktemp)"

cp "${WAILS_CONFIG_PATH}" "${WAILS_CONFIG_BACKUP}"
cleanup() {
  mv "${WAILS_CONFIG_BACKUP}" "${WAILS_CONFIG_PATH}"
}
trap cleanup EXIT

python3 - "${WAILS_CONFIG_PATH}" "${APP_VERSION}" <<'PY'
import json
import pathlib
import sys

config_path = pathlib.Path(sys.argv[1])
app_version = sys.argv[2]

content = json.loads(config_path.read_text())
content.setdefault("info", {})
content["info"]["productVersion"] = app_version
config_path.write_text(json.dumps(content, indent=2) + "\n")
PY

(
  cd "${ROOT_DIR}/frontend"
  VITE_APP_VERSION="${APP_VERSION}" npm run build
)

wails build \
  -clean \
  -platform darwin/universal \
  -s \
  -ldflags "-X codex-switch/internal/buildinfo.Version=${APP_VERSION}"
