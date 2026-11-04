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
  onClientConnected: (callback) => {
    const handler = (event, info) => callback(info);
    ipcRenderer.on('lan:client-connected', handler);
    return () => ipcRenderer.removeListener('lan:client-connected', handler);
  },
  setPin: (newPin) => ipcRenderer.invoke('lan:set-pin', newPin),
  regeneratePin: () => ipcRenderer.invoke('lan:regenerate-pin'),
  onPortUpdated: (callback) => {
    const handler = (event, port) => callback(port);
    ipcRenderer.on('lan:port-updated', handler);
    return () => ipcRenderer.removeListener('lan:port-updated', handler);
  },
  onPinUpdated: (callback) => {
    const handler = (event, pin) => callback(pin);
    ipcRenderer.on('lan:pin-updated', handler);
    return () => ipcRenderer.removeListener('lan:pin-updated', handler);
  },
  minimize: () => ipcRenderer.send('window:minimize'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  closeWindow: () => ipcRenderer.send('window:close'),
  setAlwaysOnTop: (flag) => ipcRenderer.send('window:set-always-on-top', flag),
  toggleAlwaysOnTop: (flag) => ipcRenderer.invoke('window:toggle-always-on-top', flag),
  toggleWidgetMode: (isWidget) => ipcRenderer.invoke('window:toggle-widget-mode', isWidget),
  snapWindow: (layout) => ipcRenderer.send('window:snap', layout),
});
