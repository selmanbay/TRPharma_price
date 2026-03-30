const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('minimize'),
  maximize: () => ipcRenderer.send('maximize'),
  close: () => ipcRenderer.send('close'),
  isMaximized: () => ipcRenderer.invoke('is-maximized'),
  getDepotCookies: (depotId) => ipcRenderer.invoke('get-depot-cookies', depotId),
  injectDepotCookies: (depotId, targetUrl) => ipcRenderer.invoke('inject-depot-cookies', depotId, targetUrl),
  onMaximizeChange: (callback) => {
    ipcRenderer.on('maximize-change', (_event, isMaximized) => callback(isMaximized));
  },
});
