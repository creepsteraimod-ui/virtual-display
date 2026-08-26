const elements = {
  error: document.querySelector('#error'),
  launchAtLogin: document.querySelector('#launch-at-login'),
  physicalName: document.querySelector('#physical-name'),
  platform: document.querySelector('#platform'),
  stateCopy: document.querySelector('#state-copy'),
  stateTitle: document.querySelector('#state-title'),
  toggle: document.querySelector('#display-toggle'),
  virtualMonitor: document.querySelector('#virtual-monitor'),
  virtualName: document.querySelector('#virtual-name'),
};

let currentStatus;

function showError(error) {
  elements.error.hidden = false;
  elements.error.textContent = error.message ?? String(error);
}

function render(status) {
  currentStatus = status;
  elements.platform.textContent = status.platform;
  elements.stateTitle.textContent = status.enabled ? 'Display online' : 'Display offline';
  elements.stateCopy.textContent = status.enabled
    ? 'The isolated virtual output is ready to use.'
    : 'Your physical monitor remains the only active desktop.';
  elements.toggle.classList.toggle('active', status.enabled);
  elements.toggle.disabled = !status.configured;
  elements.virtualMonitor.classList.toggle('active', status.enabled);
  elements.virtualName.textContent = status.virtualConnector ?? 'Virtual display';
  elements.physicalName.textContent = status.physicalConnector ?? 'Physical display';
  elements.error.hidden = !status.error;
  elements.error.textContent = status.error ?? '';
}

async function refresh() {
  elements.toggle.disabled = true;
  try {
    render(await window.virtualDisplay.getStatus());
  } catch (error) {
    showError(error);
  }
}

elements.toggle.addEventListener('click', async () => {
  elements.toggle.disabled = true;
  try {
    render(await window.virtualDisplay.setEnabled(!currentStatus.enabled));
  } catch (error) {
    await refresh();
    showError(error);
  }
});

elements.launchAtLogin.addEventListener('change', async () => {
  try {
    const settings = await window.virtualDisplay.setLaunchAtLogin(elements.launchAtLogin.checked);
    elements.launchAtLogin.checked = settings.launchAtLogin;
  } catch (error) {
    elements.launchAtLogin.checked = !elements.launchAtLogin.checked;
    showError(error);
  }
});

document.querySelector('#refresh').addEventListener('click', refresh);
document.querySelector('#display-settings').addEventListener('click', async () => {
  try {
    await window.virtualDisplay.openDisplaySettings();
  } catch (error) {
    showError(error);
  }
});
window.virtualDisplay.onStatus(render);
window.virtualDisplay.getSettings()
  .then(settings => {
    elements.launchAtLogin.checked = settings.launchAtLogin;
  })
  .catch(showError);
refresh();
