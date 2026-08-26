const {LinuxDisplayBackend} = require('./linux');
const {UnsupportedDisplayBackend} = require('./unsupported');

function createDisplayBackend(platform = process.platform) {
  return platform === 'linux'
    ? new LinuxDisplayBackend()
    : new UnsupportedDisplayBackend(platform);
}

module.exports = {createDisplayBackend};
