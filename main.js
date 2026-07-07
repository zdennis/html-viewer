'use strict';

const { app, BrowserWindow, clipboard, ipcMain, Menu, nativeImage, screen, shell } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

const RECENT_MAX = 10;

let mainWindow = null;
let targetUrl = null;

// ── Navigation history ─────────────────────────────────────────────────────

const navHistory = [];   // array of { url, raw }
let navIndex = -1;       // current position in history

function navState() {
  return { canBack: navIndex > 0, canForward: navIndex < navHistory.length - 1 };
}

function pushNav(resolved, raw) {
  // Truncate forward history when a new file is loaded
  navHistory.splice(navIndex + 1);
  navHistory.push({ url: resolved, raw });
  navIndex = navHistory.length - 1;
}

function sendNavState() {
  if (mainWindow) mainWindow.webContents.send('nav-state', navState());
}

// ── CLI arg helpers ────────────────────────────────────────────────────────

function parseExitAfterDelay(argv) {
  const idx = argv.indexOf('--exit-after-delay');
  if (idx === -1) return null;
  const val = parseInt(argv[idx + 1], 10);
  return isNaN(val) ? null : val;
}

function parseSessionName(argv) {
  const flag = argv.find(a => a.startsWith('--viewer-session='));
  return flag ? flag.slice('--viewer-session='.length) : 'default';
}

function parseFileArg(argv) {
  // Skip the value that follows --session or -s so it isn't mistaken for a file path
  const skip = new Set();
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === '--session' || argv[i] === '-s') && argv[i + 1]) {
      skip.add(argv[i + 1]);
    }
  }
  return argv.find(a => !a.startsWith('-') && a !== __dirname && !skip.has(a)) || null;
}

const sessionName = parseSessionName(process.argv);

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
      label: 'Edit',
      submenu: [
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' },
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
        { type: 'separator' },
        {
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+0',
          click() { if (mainWindow) mainWindow.webContents.send('zoom', 'reset'); },
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click() { if (mainWindow) mainWindow.webContents.send('zoom', 'in'); },
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click() { if (mainWindow) mainWindow.webContents.send('zoom', 'out'); },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Window management ──────────────────────────────────────────────────────

function loadUrlInWindow(raw, isNavigation = false) {
  const resolved = resolveTarget(raw);
  if (!resolved) return;
  targetUrl = resolved;
  rawTarget = raw;
  if (!isNavigation) {
    pushNav(resolved, raw);
    addRecent(raw);
    buildMenu();
  }
  if (mainWindow) {
    mainWindow.webContents.send('load-url', { url: resolved, raw });
    sendNavState();
  }
}

function createWindow(initialTarget) {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  // Resolve before the window loads so get-url IPC finds it immediately
  if (initialTarget) {
    targetUrl = resolveTarget(initialTarget);
    rawTarget = initialTarget;
    pushNav(targetUrl, initialTarget);
    addRecent(initialTarget);
    buildMenu();
  }

  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    x: Math.round((sw - 900) / 2),
    y: Math.round((sh - 700) / 2),
    alwaysOnTop: true,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 8, y: 8 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.once('did-finish-load', () => sendNavState());

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── IPC handlers ───────────────────────────────────────────────────────────

let rawTarget = null;

ipcMain.handle('get-url', () => ({ url: targetUrl, raw: rawTarget, navState: navState(), sessionName }));

ipcMain.handle('nav-back', () => {
  if (navIndex <= 0) return;
  navIndex--;
  const { url, raw } = navHistory[navIndex];
  targetUrl = url;
  rawTarget = raw;
  if (mainWindow) {
    mainWindow.webContents.send('load-url', { url, raw });
    sendNavState();
  }
});

ipcMain.handle('nav-forward', () => {
  if (navIndex >= navHistory.length - 1) return;
  navIndex++;
  const { url, raw } = navHistory[navIndex];
  targetUrl = url;
  rawTarget = raw;
  if (mainWindow) {
    mainWindow.webContents.send('load-url', { url, raw });
    sendNavState();
  }
});

ipcMain.handle('get-recent-files', () => loadRecent());

ipcMain.handle('copy-to-clipboard', (event, { text }) => {
  clipboard.writeText(text);
});

ipcMain.handle('show-context-menu', (event, { selectionText }) => {
  const hasSelection = selectionText && selectionText.trim().length > 0;
  const template = [
    {
      label: 'Copy',
      enabled: hasSelection,
      click() {
        if (hasSelection) clipboard.writeText(selectionText);
      },
    },
    { type: 'separator' },
    { label: 'Select All', click() { event.sender.selectAll(); } },
  ];
  const menu = Menu.buildFromTemplate(template);
  const win = BrowserWindow.fromWebContents(event.sender);
  menu.popup({ window: win });
});

ipcMain.handle('window-shrink', (event, { x, y, width, height }) => {
  if (!mainWindow) return;
  const display = screen.getDisplayNearestPoint({ x, y });
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
  const MARGIN = 8;
  const SIZE = 100;

  const nx = dx + dw - SIZE - MARGIN;
  const ny = dy + MARGIN;

  mainWindow.setBounds({ x: Math.round(nx), y: Math.round(ny), width: SIZE, height: SIZE });
});

ipcMain.handle('resize-to-content', (event, { contentHeight }) => {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
  const maxHeight = Math.round(display.workArea.height * 0.8);
  const newHeight = Math.min(contentHeight, maxHeight);
  mainWindow.setBounds({ ...bounds, height: newHeight });
});

ipcMain.handle('window-expand', (event, { x, y, width, height }) => {
  if (!mainWindow) return;
  mainWindow.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });
});

// ── App lifecycle ──────────────────────────────────────────────────────────

app.setAboutPanelOptions({
  applicationName: 'HTML Viewer',
  applicationVersion: '0.7.0',
});

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    // argv contains [electronBinary, appDir, ...userArgs]; skip both leading paths
    const raw = parseFileArg(argv.slice(2));
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
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      if (process.env.NODE_ENV === 'development') {
        app.dock.setIcon(icon);
        app.dock.setBadge('DEV');
      } else {
        app.dock.setIcon(icon);
      }
    }

    const userArgs = process.argv.slice(2);
    const rawArg = parseFileArg(userArgs);
    const exitDelay = parseExitAfterDelay(userArgs);
    buildMenu();
    createWindow(rawArg || null);

    if (exitDelay !== null) {
      setTimeout(() => app.quit(), exitDelay * 1000);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(null);
    });
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
