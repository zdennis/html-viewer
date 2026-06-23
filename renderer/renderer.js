const webview = document.getElementById('webview');
const shrinkBtn = document.getElementById('shrink-btn');
const expandOverlay = document.getElementById('expand-overlay');

let savedBounds = null;

// ── Load initial URL ────────────────────────────────────────────────────────

async function loadInitialUrl() {
  const targetUrl = await window.electronAPI.getUrl();
  if (targetUrl) {
    webview.src = targetUrl;
  }
}

loadInitialUrl();

// ── Listen for new URLs from main process (recent files, second-instance) ──

window.electronAPI.onLoadUrl((newUrl) => {
  webview.src = newUrl;
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
