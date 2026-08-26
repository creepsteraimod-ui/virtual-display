const fs = require('node:fs/promises');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');

const execFileAsync = promisify(execFile);
const runCommand = (command, args) => execFileAsync(command, args, {timeout: 10000});

function parseVirtualConnector(cmdline) {
  return cmdline.match(/drm\.edid_firmware=([^: ,]+):[^ ]+/)?.[1] ?? null;
}

function parseDisplayState(output, virtualConnector) {
  const logicalOutput = output.split(/^Logical monitors:/m)[1] ?? '';
  const monitors = [...output.matchAll(/Monitor ([^\s(]+)/g)].map(match => match[1]);
  const logicalMonitors = [...logicalOutput.matchAll(/[└├]──([A-Za-z0-9-]+) \(/g)]
    .map(match => match[1])
    .filter(Boolean);
  const physicalConnectors = [...new Set(
    logicalMonitors.filter(connector => connector !== virtualConnector)
  )];
  if (physicalConnectors.length === 0) {
    const availablePhysical = monitors.filter(connector => connector !== virtualConnector);
    if (availablePhysical.length === 1)
      physicalConnectors.push(availablePhysical[0]);
  }

  return {
    monitors: [...new Set(monitors)],
    physicalConnectors,
    physicalConnector: physicalConnectors.length === 1 ? physicalConnectors[0] : null,
    enabled: logicalOutput.includes(virtualConnector),
  };
}

class LinuxDisplayBackend {
  constructor({run = runCommand, readFile = fs.readFile} = {}) {
    this.run = run;
    this.readFile = readFile;
  }

  async getStatus() {
    try {
      const display = await this.getDisplayState();
      return {
        platform: 'linux',
        supported: true,
        configured: true,
        ...display,
      };
    } catch (error) {
      return {
        platform: 'linux',
        supported: true,
        configured: false,
        enabled: false,
        error: error.message,
      };
    }
  }

  async getDisplayState() {
    const cmdline = await this.readFile('/proc/cmdline', 'utf8');
    const virtualConnector = parseVirtualConnector(cmdline);
    if (!virtualConnector)
      throw new Error('Virtual display firmware is not configured in the kernel command line.');

    const {stdout} = await this.run('gdctl', ['show']);
    const state = parseDisplayState(stdout, virtualConnector);
    if (!state.monitors.includes(virtualConnector))
      throw new Error(`${virtualConnector} is not available to GNOME.`);
    if (state.physicalConnectors.length > 1)
      throw new Error('Multiple active physical monitors are not supported yet; no layout was changed.');
    if (!state.physicalConnector)
      throw new Error('No physical monitor is available.');

    return {virtualConnector, ...state};
  }

  async setEnabled(enabled) {
    const state = await this.getDisplayState();
    if (state.enabled !== enabled) {
      const args = [
        'set',
        '--logical-monitor', '--primary', '--monitor', state.physicalConnector, '--x', '0', '--y', '0',
      ];
      if (enabled) {
        args.push(
          '--logical-monitor', '--monitor', state.virtualConnector,
          '--right-of', state.physicalConnector
        );
      }
      await this.run('gdctl', args);
    }

    const result = await this.getDisplayState();
    if (result.enabled !== enabled)
      throw new Error(`GNOME did not ${enabled ? 'enable' : 'disable'} the virtual display.`);
    return {
      platform: 'linux',
      supported: true,
      configured: true,
      ...result,
    };
  }
}

module.exports = {LinuxDisplayBackend, parseDisplayState, parseVirtualConnector};
