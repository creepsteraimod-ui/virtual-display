#!/usr/bin/gjs

const { GLib } = imports.gi;

if (ARGV.length !== 2) {
  printerr("usage: generate-edid.js GENERATOR_ROOT OUTPUT_FILE");
  imports.system.exit(2);
}

function readText(path) {
  const [ok, bytes] = GLib.file_get_contents(path);
  if (!ok) throw new Error(`Unable to read ${path}`);
  return new TextDecoder().decode(bytes);
}

const generatorRoot = ARGV[0];
const outputFile = ARGV[1];
globalThis.window = globalThis;
eval(readText(`${generatorRoot}/assets/js/cta-861-g-vic.js`));
eval(readText(`${generatorRoot}/assets/js/edid-core.js`));

const settings = {
  defaultMode: { width: 3840, height: 2160, refresh: 60 },
  modes: [
    { width: 3840, height: 2160, refresh: 60 },
    { width: 2560, height: 1440, refresh: 60 },
    { width: 1920, height: 1080, refresh: 60 },
    { width: 1280, height: 800, refresh: 60 },
    { width: 1280, height: 720, refresh: 60 },
  ],
  audio: true,
  hdr: true,
  deepColor: true,
  vrr: false,
  dsc: false,
  listedModesOnly: false,
};

const result = globalThis.EdidCore.generateEdid(settings);
const validation = globalThis.EdidCore.validateEdid(result.bytes);
if (validation.issues.length > 0)
  throw new Error(`Invalid EDID: ${validation.issues.join("; ")}`);
if (result.warnings.length > 0)
  printerr(result.warnings.join("\n"));
GLib.file_set_contents(outputFile, new Uint8Array(result.bytes));
