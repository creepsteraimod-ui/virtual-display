#!/usr/bin/bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(dirname -- "$script_dir")"
app_image="$(compgen -G "$project_dir/dist/virtual-display-*-x86_64.AppImage" | sort -V | tail -n 1 || true)"

if [[ -z "$app_image" ]]; then
  echo "No packaged tray app found. Run npm install && npm run dist first." >&2
  exit 1
fi

install_dir="$HOME/.local/lib/virtual-display"
applications_dir="$HOME/.local/share/applications"
autostart_dir="$HOME/.config/autostart"
icons_dir="$HOME/.local/share/icons/hicolor/scalable/apps"
mkdir -p "$install_dir" "$applications_dir" "$autostart_dir" "$icons_dir" "$HOME/.local/state"

installed_app="$install_dir/virtual-display.AppImage"
install -m 0755 "$app_image" "$installed_app"

stop_running_app() {
  local pid_file="$HOME/.config/virtual-display/virtual-display.pid"
  [[ -r "$pid_file" ]] || return 0
  local pid
  pid="$(<"$pid_file")"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 0
  [[ -r "/proc/$pid/comm" ]] || return 0
  [[ "$(<"/proc/$pid/comm")" == virtual-display ]] || return 0
  kill "$pid" 2>/dev/null || true
  for _attempt in {1..20}; do
    [[ -e "/proc/$pid" ]] || break
    sleep 0.1
  done
  if [[ -e "/proc/$pid" ]]; then
    kill -KILL "$pid" 2>/dev/null || true
  fi
  rm -f "$pid_file"
}

desktop_entry="[Desktop Entry]
Type=Application
Name=Virtual Display
Comment=Control the virtual monitor
Exec=$installed_app
Icon=virtual-display
Terminal=false
Categories=Utility;Settings;
StartupNotify=true"

printf '%s\n' "$desktop_entry" > "$applications_dir/io.virtualdisplay.Controller.desktop"
printf '%s\nX-GNOME-Autostart-enabled=true\n' "$desktop_entry" \
  > "$autostart_dir/io.virtualdisplay.Controller.desktop"
install -m 0644 "$project_dir/assets/tray.svg" \
  "$icons_dir/virtual-display.svg"

old_app="$HOME/.local/lib/sunshine-virtual-display/sunshine-virtual-display.AppImage"
pkill -f "$old_app" 2>/dev/null || true
rm -rf "$HOME/.local/lib/sunshine-virtual-display"
rm -f "$applications_dir/io.sunshine.VirtualDisplay.desktop"
rm -f "$autostart_dir/io.sunshine.VirtualDisplay.desktop"
rm -f "$icons_dir/sunshine-virtual-display.svg"

stop_running_app
sleep 2
nohup "$installed_app" --hidden > "$HOME/.local/state/virtual-display.log" 2>&1 &

echo "Virtual Display installed and started."
