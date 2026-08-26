class UnsupportedDisplayBackend {
  constructor(platform = process.platform) {
    this.platform = platform;
  }

  async getStatus() {
    return {
      platform: this.platform,
      supported: false,
      configured: false,
      enabled: false,
      error: `Virtual display control is not implemented for ${this.platform} yet.`,
    };
  }

  async setEnabled() {
    throw new Error(`Virtual display control is not implemented for ${this.platform} yet.`);
  }
}

module.exports = {UnsupportedDisplayBackend};
