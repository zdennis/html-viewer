# Contributing

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- npm

## Setup

```bash
git clone https://github.com/zdennis/html-viewer.git
cd html-viewer
npm install
npm run dev
```

## Project layout

| File | Purpose |
|---|---|
| `main.js` | Electron main process — window lifecycle, IPC handlers, file watching, menus |
| `renderer/renderer.js` | Renderer process — webview management, UI interactions, zoom, shrink/expand |
| `preload.js` | Context bridge between main and renderer; exposes `window.electronAPI` |
| `bin/html-viewer` | CLI entry point; spawns Electron with the correct arguments |

## Making changes

1. Fork the repo and create a branch: `git checkout -b your-feature`
2. Make your changes
3. Verify with `npm run dev`
4. Open a pull request against `main`

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
