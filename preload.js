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

  resizeToContent(contentHeight) {
    return ipcRenderer.invoke('resize-to-content', { contentHeight });
  },

  copyToClipboard(text) {
    return ipcRenderer.invoke('copy-to-clipboard', { text });
  },

  showContextMenu(selectionText) {
    return ipcRenderer.invoke('show-context-menu', { selectionText });
  },

  navBack() {
    return ipcRenderer.invoke('nav-back');
  },

  navForward() {
    return ipcRenderer.invoke('nav-forward');
  },

  onNavState(callback) {
    ipcRenderer.on('nav-state', (event, state) => callback(state));
  },

  onLoadUrl(callback) {
    ipcRenderer.on('load-url', (event, urlValue) => callback(urlValue));
  },
});
