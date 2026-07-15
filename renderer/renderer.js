const webview = document.getElementById('webview');
const shrinkBtn = document.getElementById('shrink-btn');
const expandOverlay = document.getElementById('expand-overlay');
const titlebarLabel = document.getElementById('titlebar-label');
const sessionBadge = document.getElementById('session-badge');
const navBackBtn = document.getElementById('nav-back');
const navForwardBtn = document.getElementById('nav-forward');
const notFound = document.getElementById('not-found');
const notFoundPath = document.getElementById('not-found-path');

let currentRawPath = null;

function updateTitle(url, rawPath) {
  if (!url) return;
  currentRawPath = rawPath || url;
  try {
    const u = new URL(url);
    const name = u.protocol === 'file:'
      ? decodeURIComponent(u.pathname.split('/').pop())
      : u.hostname;
    titlebarLabel.textContent = name || 'HTML Viewer';
  } catch (_) {
    titlebarLabel.textContent = 'HTML Viewer';
  }
}

const copyTooltip = document.getElementById('copy-tooltip');
let tooltipTimer = null;

titlebarLabel.addEventListener('click', async (e) => {
  if (!currentRawPath) return;
  const text = currentRawPath.startsWith('file://')
    ? decodeURIComponent(new URL(currentRawPath).pathname)
    : currentRawPath;

  await window.electronAPI.copyToClipboard(text);

  // Position tooltip near the click
  copyTooltip.style.left = `${e.clientX}px`;
  copyTooltip.style.top = `${e.clientY + 16}px`;
  copyTooltip.classList.add('visible');

  if (tooltipTimer) clearTimeout(tooltipTimer);
  tooltipTimer = setTimeout(() => {
    copyTooltip.classList.remove('visible');
  }, 500);
});

let savedBounds = null;

// ── Nav state ──────────────────────────────────────────────────────────────

function applyNavState({ canBack, canForward }) {
  navBackBtn.disabled = !canBack;
  navForwardBtn.disabled = !canForward;
}

// ── Nav popup ──────────────────────────────────────────────────────────────

const navPopup = document.getElementById('nav-popup');
const LONG_PRESS_MS = 400;

function closeNavPopup() {
  navPopup.classList.remove('visible');
  navPopup.innerHTML = '';
}

async function showNavPopup(btn, direction) {
  const { history, index } = await window.electronAPI.getNavHistory();
  if (history.length === 0) return;

  navPopup.innerHTML = '';

  // For back: show entries before current (oldest→newest), most recent at top
  // For forward: show entries after current (next→last)
  let items;
  if (direction === 'back') {
    items = history.slice(0, index).map((raw, i) => ({ raw, histIndex: i })).reverse();
  } else {
    items = history.slice(index + 1).map((raw, i) => ({ raw, histIndex: index + 1 + i }));
  }

  if (items.length === 0) return;

  items.forEach(({ raw, histIndex }) => {
    const el = document.createElement('div');
    el.className = 'nav-popup-item' + (histIndex === index ? ' current' : '');
    const label = raw.startsWith('file://')
      ? decodeURIComponent(raw.replace(/^file:\/\//, '').split('/').pop())
      : raw.split('/').pop() || raw;
    el.textContent = label;
    el.title = raw;
    el.addEventListener('mousedown', async (e) => {
      e.stopPropagation();
      closeNavPopup();
      await window.electronAPI.navJump(histIndex);
    });
    navPopup.appendChild(el);
  });

  // Position below the button
  const rect = btn.getBoundingClientRect();
  navPopup.style.top = `${rect.bottom + 4}px`;
  navPopup.style.left = `${rect.left}px`;
  navPopup.classList.add('visible');
}

document.addEventListener('mousedown', (e) => {
  if (!navPopup.contains(e.target)) closeNavPopup();
});

function attachNavBtn(btn, direction, navFn) {
  let pressTimer = null;
  let didLongPress = false;

  btn.addEventListener('mousedown', () => {
    didLongPress = false;
    pressTimer = setTimeout(() => {
      didLongPress = true;
      showNavPopup(btn, direction);
    }, LONG_PRESS_MS);
  });

  btn.addEventListener('mouseup', () => {
    clearTimeout(pressTimer);
  });

  btn.addEventListener('mouseleave', () => {
    clearTimeout(pressTimer);
  });

  btn.addEventListener('click', async () => {
    if (didLongPress) return;
    await navFn();
  });
}

attachNavBtn(navBackBtn, 'back', () => window.electronAPI.navBack());
attachNavBtn(navForwardBtn, 'forward', () => window.electronAPI.navForward());

window.electronAPI.onNavState(applyNavState);

// ── Load initial URL ────────────────────────────────────────────────────────

function showNotFound(rawPath) {
  notFoundPath.textContent = rawPath || '';
  notFound.style.display = 'flex';
  webview.style.display = 'none';
}

function hideNotFound() {
  notFound.style.display = 'none';
  webview.style.display = '';
}

function isMarkdownFile(raw) {
  return raw && /\.md$/i.test(raw.split('?')[0]);
}

async function loadUrl(resolvedUrl, raw) {
  if (isMarkdownFile(raw)) {
    const filePath = decodeURIComponent(new URL(resolvedUrl).pathname);
    const html = await window.electronAPI.renderMarkdown(filePath);
    webview.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  } else {
    webview.src = resolvedUrl;
  }
}

async function loadInitialUrl() {
  const { url, raw, navState, sessionName } = await window.electronAPI.getUrl();
  if (navState) applyNavState(navState);
  if (sessionName) sessionBadge.textContent = sessionName;
  if (url) {
    updateTitle(url, raw);
    await loadUrl(url, raw);
  }
}

loadInitialUrl();

webview.addEventListener('context-menu', (e) => {
  window.electronAPI.showContextMenu(e.params.selectionText || '');
});


webview.addEventListener('did-finish-load', () => {
  hideNotFound();
  webview.executeJavaScript('document.documentElement.scrollHeight').then(contentHeight => {
    if (contentHeight > 0) {
      window.electronAPI.resizeToContent(contentHeight);
    }
  }).catch(() => {});
});

webview.addEventListener('did-fail-load', (e) => {
  if (e.errorCode === -3) return; // aborted/cancelled, not an error
  showNotFound(currentRawPath);
});

// ── Listen for new URLs from main process (recent files, second-instance) ──

window.electronAPI.onLoadUrl(async ({ url: newUrl, raw }) => {
  hideNotFound();
  updateTitle(newUrl, raw);
  await loadUrl(newUrl, raw);
  // If we're in shrunken state, expand back
  if (expandOverlay.classList.contains('visible')) {
    expandOverlay.classList.remove('visible');
    webview.style.display = '';
    shrinkBtn.style.display = '';
  }
});

// ── Shrink to corner ───────────────────────────────────────────────────────

shrinkBtn.addEventListener('click', async () => {
  const bounds = {
    x: window.screenX,
    y: window.screenY,
    width: window.outerWidth,
    height: window.outerHeight,
  };
  savedBounds = bounds;

  await window.electronAPI.shrinkWindow(bounds);

  webview.style.display = 'none';
  shrinkBtn.style.display = 'none';
  expandOverlay.classList.add('visible');
});

// ── Zoom ───────────────────────────────────────────────────────────────────

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 5.0;

function applyZoom(direction) {
  const current = webview.getZoomFactor();
  let next;
  if (direction === 'in')    next = Math.min(ZOOM_MAX, Math.round((current + ZOOM_STEP) * 10) / 10);
  else if (direction === 'out')  next = Math.max(ZOOM_MIN, Math.round((current - ZOOM_STEP) * 10) / 10);
  else                           next = 1.0;
  webview.setZoomFactor(next);
}

window.electronAPI.onZoom(applyZoom);

window.electronAPI.onReload(() => {
  webview.reload();
});

// Keyboard shortcuts (supplement the menu accelerators for the webview context)
window.addEventListener('keydown', (e) => {
  if (!e.metaKey && !e.ctrlKey) return;
  if (e.key === '=' || e.key === '+') { e.preventDefault(); applyZoom('in'); }
  else if (e.key === '-')             { e.preventDefault(); applyZoom('out'); }
  else if (e.key === '0')             { e.preventDefault(); applyZoom('reset'); }
  else if (e.key === 'r')             { e.preventDefault(); webview.reload(); }
});

// ── Expand from corner ─────────────────────────────────────────────────────

expandOverlay.addEventListener('click', async () => {
  if (!savedBounds) return;

  await window.electronAPI.expandWindow(savedBounds);

  expandOverlay.classList.remove('visible');
  webview.style.display = '';
  shrinkBtn.style.display = '';
  savedBounds = null;
});
