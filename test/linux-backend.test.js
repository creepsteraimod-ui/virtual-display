const test = require('node:test');
const assert = require('node:assert/strict');
const {LinuxDisplayBackend, parseDisplayState, parseVirtualConnector} = require('../app/platform/linux');

const GDCTL_OUTPUT = `Monitors:
├──Monitor DP-6 (Virtual Display)
│  └──Preferred mode
└──Monitor HDMI-3 (LG Electronics 34\")
   └──Current mode

Logical monitors:
└──Logical monitor #1
   ├──Primary: yes
   └──Monitors: (1)
       └──HDMI-3 (LG Electronics 34\")
`;

test('extracts the firmware connector from the kernel command line', () => {
  assert.equal(
    parseVirtualConnector('quiet drm.edid_firmware=DP-6:edid/virtual-display.bin video=DP-6:e'),
    'DP-6'
  );
});

test('recognizes a disabled virtual monitor and active physical monitor', () => {
  assert.deepEqual(parseDisplayState(GDCTL_OUTPUT, 'DP-6'), {
    monitors: ['DP-6', 'HDMI-3'],
    physicalConnectors: ['HDMI-3'],
    physicalConnector: 'HDMI-3',
    enabled: false,
  });
});

test('refuses to choose between multiple active physical monitors', async () => {
  const output = `${GDCTL_OUTPUT}\n└──Logical monitor #2\n   └──DP-1 (Second display)\n`;
  const backend = new LinuxDisplayBackend({
    readFile: async () => 'drm.edid_firmware=DP-6:edid/virtual.bin',
    run: async () => ({stdout: output}),
  });

  await assert.rejects(
    () => backend.setEnabled(true),
    /Multiple active physical monitors are not supported/
  );
});

test('recognizes an enabled virtual monitor', () => {
  const output = `${GDCTL_OUTPUT}\n└──Logical monitor #2\n   └──DP-6 (Virtual Display)\n`;
  assert.equal(parseDisplayState(output, 'DP-6').enabled, true);
});

test('enabling the display does not control unrelated services', async () => {
  const calls = [];
  let enabled = false;
  const backend = new LinuxDisplayBackend({
    readFile: async () => 'drm.edid_firmware=DP-6:edid/virtual.bin',
    run: async (command, args) => {
      calls.push([command, ...args]);
      if (args[0] === 'set')
        enabled = true;
      const suffix = enabled ? '\n└──Logical monitor #2\n   └──DP-6 (Virtual Display)\n' : '';
      return {stdout: command === 'gdctl' && args[0] === 'show' ? GDCTL_OUTPUT + suffix : ''};
    },
  });

  assert.equal((await backend.setEnabled(true)).enabled, true);
  assert.equal(calls.some(([command]) => command === 'systemctl'), false);
});
