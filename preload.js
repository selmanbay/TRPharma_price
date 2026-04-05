const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('minimize'),
  maximize: () => ipcRenderer.send('maximize'),
  close: () => ipcRenderer.send('close'),
  quitApp: () => ipcRenderer.send('quit-app'),
  isMaximized: () => ipcRenderer.invoke('is-maximized'),
  getDepotCookies: (depotId) => ipcRenderer.invoke('get-depot-cookies', depotId),
  injectDepotCookies: (depotId, targetUrl) => ipcRenderer.invoke('inject-depot-cookies', depotId, targetUrl),
  openUrlInChrome: (url) => ipcRenderer.invoke('open-url-in-chrome', url),
  onMaximizeChange: (callback) => {
    ipcRenderer.on('maximize-change', (_event, isMaximized) => callback(isMaximized));
  },
  getAppVersion:   () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateStatus:  (cb) => ipcRenderer.on('update-status', (_event, payload) => cb(payload)),
});
