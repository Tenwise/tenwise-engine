#!/bin/bash
# Runs Tenwise as a macOS login service (launchd): starts at login,
# restarts if it crashes. Usage: scripts/service.sh install|uninstall|restart|status|logs
set -euo pipefail

LABEL="app.tenwise.engine"
PORT="${PORT:-4317}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/tenwise"
NODE_BIN="$(command -v node)"
DOMAIN="gui/$(id -u)"

build() {
  (cd "$APP_DIR" && npm run build)
}

# After a pull that changed package-lock.json, install the dependencies it
# names before building. npm writes node_modules/.package-lock.json on every
# install, so a lockfile newer than it hasn't been installed yet.
sync_deps() {
  if [ "$APP_DIR/package-lock.json" -nt "$APP_DIR/node_modules/.package-lock.json" ]; then
    echo "Dependencies changed: running npm ci"
    (cd "$APP_DIR" && npm ci --no-audit --no-fund)
  fi
}

# Settings the server reads, carried into the service when they are set at
# install (launchd starts it without your shell's environment).
PASSED_ENV=(CHROME_PATH TENWISE_DATA_DIR OLLAMA_HOST)

xml_escape() {
  local s=$1
  s=${s//&/&amp;}; s=${s//</&lt;}; s=${s//>/&gt;}
  printf '%s' "$s"
}

passed_env() {
  local name
  for name in "${PASSED_ENV[@]}"; do
    if [ -n "${!name:-}" ]; then
      printf '    <key>%s</key><string>%s</string>\n' "$name" "$(xml_escape "${!name}")"
    fi
  done
}

write_plist() {
  mkdir -p "$LOG_DIR" "$(dirname "$PLIST")"
  cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$APP_DIR/server/index.js</string>
  </array>
  <key>WorkingDirectory</key><string>$APP_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key><string>$PORT</string>
    <key>HOST</key><string>127.0.0.1</string>
$(passed_env)
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG_DIR/out.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/err.log</string>
</dict>
</plist>
PLIST
}

case "${1:-}" in
  install)
    sync_deps
    build
    write_plist
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    launchctl bootstrap "$DOMAIN" "$PLIST"
    echo "Tenwise running at http://tenwise.localhost:$PORT"
    ;;
  uninstall)
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
    echo "Tenwise service removed"
    ;;
  restart)
    sync_deps
    build
    launchctl kickstart -k "$DOMAIN/$LABEL"
    echo "Rebuilt and restarted"
    ;;
  status)
    launchctl print "$DOMAIN/$LABEL" | grep -E "state|pid|last exit" || echo "Not installed"
    ;;
  logs)
    tail -n 50 -f "$LOG_DIR/out.log" "$LOG_DIR/err.log"
    ;;
  *)
    echo "Usage: $0 install|uninstall|restart|status|logs" >&2
    exit 1
    ;;
esac
