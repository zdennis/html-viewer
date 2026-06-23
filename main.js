'use strict';

const { app, BrowserWindow, ipcMain, Menu, screen, shell } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

const RECENT_MAX = 10;

let mainWindow = null;
let targetUrl = null;

// ── Recent files (manual JSON, no electron-store) ──────────────────────────

function recentFilePath() {
  return path.join(app.getPath('userData'), 'recent.json');
}

function loadRecent() {
  try {
    const data = fs.readFileSync(recentFilePath(), 'utf8');
    return JSON.parse(data);
  } catch (_) {
    return [];
  }
}

function saveRecent(list) {
  try {
    fs.writeFileSync(recentFilePath(), JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save recent files:', e);
  }
}

function addRecent(entry) {
  let list = loadRecent();
  // Remove duplicates
  list = list.filter(item => item !== entry);
  list.unshift(entry);
  if (list.length > RECENT_MAX) list = list.slice(0, RECENT_MAX);
  saveRecent(list);
  return list;
}

// ── URL helpers ────────────────────────────────────────────────────────────

function resolveTarget(raw) {
  if (!raw) return null;
  // Already a URL with a scheme
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(raw)) return raw;
  // Treat as file path
  const abs = path.resolve(raw);
  return url.pathToFileURL(abs).href;
}

// ── Menu builder ───────────────────────────────────────────────────────────

function buildMenu() {
  const recent = loadRecent();

  const recentItems = recent.length
    ? [
        ...recent.map(entry => ({
          label: entry.length > 60 ? '…' + entry.slice(-57) : entry,
          click() {
            loadUrlInWindow(entry);
          },
        })),
        { type: 'separator' },
        {
          label: 'Clear Recent Files',
          click() {
            saveRecent([]);
            buildMenu();
          },
        },
      ]
    : [{ label: 'No Recent Files', enabled: false }];

  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Recent Files',
          submenu: recentItems,
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        ...(process.env.NODE_ENV === 'development' || process.argv.includes('--dev')
          ? [
              {
                label: 'Toggle DevTools',
                accelerator: 'CmdOrCtrl+Option+I',
                click(_, win) {
                  if (win) win.webContents.toggleDevTools();
                },
              },
            ]
          : []),
        { role: 'reload' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Window management ──────────────────────────────────────────────────────

function loadUrlInWindow(rawTarget) {
  const resolved = resolveTarget(rawTarget);
  if (!resolved) return;
  targetUrl = resolved;
  addRecent(rawTarget);
  buildMenu();
  if (mainWindow) {
    mainWindow.webContents.send('load-url', resolved);
  }
}

function createWindow(initialTarget) {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    x: Math.round((sw - 900) / 2),
    y: Math.round((sh - 700) / 2),
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.once('did-finish-load', () => {
    if (initialTarget) {
      const resolved = resolveTarget(initialTarget);
      targetUrl = resolved;
      addRecent(initialTarget);
      buildMenu();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── IPC handlers ───────────────────────────────────────────────────────────

ipcMain.handle('get-url', () => targetUrl);

ipcMain.handle('get-recent-files', () => loadRecent());

ipcMain.handle('window-shrink', (event, { x, y, width, height }) => {
  if (!mainWindow) return;
  const display = screen.getDisplayNearestPoint({ x, y });
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
  const MARGIN = 8;
  const SIZE = 50;

  // Determine nearest corner based on window center
  const cx = x + width / 2;
  const cy = y + height / 2;
  const midX = dx + dw / 2;
  const midY = dy + dh / 2;

  let nx, ny;
  if (cx <= midX && cy <= midY) {
    // top-left
    nx = dx + MARGIN;
    ny = dy + MARGIN;
  } else if (cx > midX && cy <= midY) {
    // top-right
    nx = dx + dw - SIZE - MARGIN;
    ny = dy + MARGIN;
  } else if (cx <= midX && cy > midY) {
    // bottom-left
    nx = dx + MARGIN;
    ny = dy + dh - SIZE - MARGIN;
  } else {
    // bottom-right
    nx = dx + dw - SIZE - MARGIN;
    ny = dy + dh - SIZE - MARGIN;
  }

  mainWindow.setBounds({ x: Math.round(nx), y: Math.round(ny), width: SIZE, height: SIZE });
});

ipcMain.handle('window-expand', (event, { x, y, width, height }) => {
  if (!mainWindow) return;
  mainWindow.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });
});

// ── App lifecycle ──────────────────────────────────────────────────────────

app.setAboutPanelOptions({
  applicationName: 'HTML Viewer',
  applicationVersion: '1.0.0',
});

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    // argv[0] = electron, argv[1] = script, argv[2..] = user args
    const raw = argv.slice(2).find(a => !a.startsWith('-'));
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (raw) loadUrlInWindow(raw);
    }
  });

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (mainWindow) {
      loadUrlInWindow(filePath);
    } else {
      // Store for after ready
      app.once('ready', () => createWindow(filePath));
    }
  });

  app.whenReady().then(() => {
    const rawArg = process.argv.slice(2).find(a => !a.startsWith('-'));
    buildMenu();
    createWindow(rawArg || null);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(null);
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
