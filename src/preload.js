const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ideaStore', {
  load: () => ipcRenderer.invoke('store:load'),
  save: (state) => ipcRenderer.invoke('store:save', state),
  path: () => ipcRenderer.invoke('store:path')
});
