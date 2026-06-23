'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getUrl() {
    return ipcRenderer.invoke('get-url');
  },

  shrinkWindow(bounds) {
    return ipcRenderer.invoke('window-shrink', bounds);
  },

  expandWindow(bounds) {
    return ipcRenderer.invoke('window-expand', bounds);
  },

  getRecentFiles() {
    return ipcRenderer.invoke('get-recent-files');
  },

  onLoadUrl(callback) {
    ipcRenderer.on('load-url', (event, urlValue) => callback(urlValue));
  },
});
