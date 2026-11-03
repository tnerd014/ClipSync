// Electron Preload Script for ClipSync
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getLocalInfo: () => ipcRenderer.invoke('lan:get-info'),
  broadcast: (payload) => ipcRenderer.send('lan:broadcast', payload),
  onLanMessage: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('lan:message', handler);
    return () => ipcRenderer.removeListener('lan:message', handler);
  },
  onClientCount: (callback) => {
    const handler = (event, count) => callback(count);
    ipcRenderer.on('lan:client-count', handler);
    return () => ipcRenderer.removeListener('lan:client-count', handler);
  },
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  setAlwaysOnTop: (flag) => ipcRenderer.send('window:set-always-on-top', flag),
});
