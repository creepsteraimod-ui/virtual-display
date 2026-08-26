#!/usr/bin/bash
set -euo pipefail

pid_file="$HOME/.config/virtual-display/virtual-display.pid"
if [[ -r "$pid_file" ]]; then
  pid="$(<"$pid_file")"
  if [[ "$pid" =~ ^[0-9]+$ && -r "/proc/$pid/comm" ]] &&
    [[ "$(<"/proc/$pid/comm")" == virtual-display ]]; then
    kill "$pid" 2>/dev/null || true
    for _attempt in {1..20}; do
      [[ -e "/proc/$pid" ]] || break
      sleep 0.1
    done
    if [[ -e "/proc/$pid" ]]; then
      kill -KILL "$pid" 2>/dev/null || true
    fi
  fi
fi
rm -f "$pid_file"
rm -rf "$HOME/.local/lib/virtual-display"
rm -f "$HOME/.local/share/applications/io.virtualdisplay.Controller.desktop"
rm -f "$HOME/.config/autostart/io.virtualdisplay.Controller.desktop"
rm -f "$HOME/.local/share/icons/hicolor/scalable/apps/virtual-display.svg"

echo "Virtual Display application removed. The host's display provisioning was not changed."
