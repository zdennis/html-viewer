const webview = document.getElementById('webview');
const shrinkBtn = document.getElementById('shrink-btn');
const expandOverlay = document.getElementById('expand-overlay');
const titlebarLabel = document.getElementById('titlebar-label');

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

// ── Load initial URL ────────────────────────────────────────────────────────

async function loadInitialUrl() {
  const { url, raw } = await window.electronAPI.getUrl();
  if (url) {
    webview.src = url;
    updateTitle(url, raw);
  }
}

loadInitialUrl();

webview.addEventListener('did-finish-load', () => {
  webview.executeJavaScript('document.documentElement.scrollHeight').then(contentHeight => {
    if (contentHeight > 0) {
      window.electronAPI.resizeToContent(contentHeight);
    }
  }).catch(() => {});
});

// ── Listen for new URLs from main process (recent files, second-instance) ──

window.electronAPI.onLoadUrl(({ url: newUrl, raw }) => {
  webview.src = newUrl;
  updateTitle(newUrl, raw);
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

// ── Expand from corner ─────────────────────────────────────────────────────

expandOverlay.addEventListener('click', async () => {
  if (!savedBounds) return;

  await window.electronAPI.expandWindow(savedBounds);

  expandOverlay.classList.remove('visible');
  webview.style.display = '';
  shrinkBtn.style.display = '';
  savedBounds = null;
});
