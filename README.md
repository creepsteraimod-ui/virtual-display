# Virtual Display

Virtual Display is a standalone Electron tray application for enabling and
disabling an existing virtual monitor. The UI and backend boundary are
cross-platform; the first backend supports GNOME on Linux through `gdctl`.

The application does not install a virtual display driver and is not related
to Sunshine. Display provisioning is hardware- and operating-system-specific.

## Current support

- Linux with GNOME, Wayland, and `gdctl`.
- A virtual DRM connector supplied through the kernel's
  `drm.edid_firmware=CONNECTOR:FILE` argument.
- Exactly one active physical monitor. If multiple physical monitors are
  active, the application refuses to change the layout.

Windows and macOS backends are planned but not implemented.

## Build

Node.js 22.12 or newer is required. On immutable Bazzite systems, Node can be
installed through Linuxbrew without changing the base image.

```bash
brew install node
npm ci
npm test
npm run dist
```

The Linux build creates `dist/virtual-display-1.0.0-x86_64.AppImage`.

## Install

```bash
./scripts/install.sh
```

The installer copies the packaged AppImage under `~/.local/lib`, creates the
desktop launcher, starts the tray process, and enables launch after login. It
does not modify kernel arguments, GDM, Sunshine, Steam, or the host's monitor
configuration files.

## Use

The monitor icon appears in GNOME's top bar through the AppIndicator extension.
Its menu contains:

- **Open Virtual Display**
- **Enable Virtual Display** or **Disable Virtual Display**
- **Refresh**
- **Quit**

Closing the status window keeps the tray process running. Use **Quit** from the
tray menu to stop it.

## Uninstall

```bash
./scripts/rollback.sh
```

Uninstall removes only the application, launcher, icon, and autostart entry.
It intentionally leaves virtual-display drivers and kernel provisioning alone.

## EDID development

`build/generic-4k60.bin` is the EDID used while developing the original Linux
backend. Rebuild and validate it with:

```bash
./scripts/generate-edid.sh
```

Do not deploy an EDID unless `edid-decode --check` reports
`EDID conformity: PASS`. Installing EDID firmware is intentionally outside the
application installer because selecting and forcing a connector incorrectly
can make a login screen inaccessible.

## Project layout

- `app/`: Electron main process, renderer, preload bridge, and OS backends.
- `test/`: backend parser and safety tests.
- `scripts/`: application installation, removal, and EDID generation.
- `vendor/edid-generator/`: vendored EDID generator with its original license.

## License

Virtual Display is released under the MIT License. See `LICENSE` and
`THIRD_PARTY_NOTICES.md`.
