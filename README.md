# html-viewer

An always-on-top macOS window for viewing HTML files, Markdown files, and URLs from the command line.

```bash
html-viewer ~/path/to/file.html
html-viewer ~/path/to/notes.md
html-viewer https://example.com
```

The window floats above all other windows, auto-sizes to fit the content (capped at 80% of screen height), and quits when you close it.

---

## Why this exists

When working with an LLM, I often want it to produce HTML content quickly and have one spot to view it. Instead of accumulating browser tabs, you get a dedicated viewer that stays on top, loads new content on command, and disappears when you're done with it.

---

## Installation

Requires [Node.js](https://nodejs.org) and [Electron](https://electronjs.org).

```bash
git clone git@github.com:zdennis/html-viewer.git
cd html-viewer
npm install
```

Then symlink the binary somewhere on your PATH:

```bash
ln -sf "$(pwd)/cli.js" ~/bin/html-viewer
chmod +x cli.js
```

---

## Usage

```bash
html-viewer <file-or-url> [options]
```

### Usage scenarios

```bash
# Open a local HTML file
html-viewer ~/Documents/report.html

# Open a Markdown file (rendered with GitHub-flavored styling)
html-viewer ~/Documents/notes.md

# Open a URL
html-viewer https://example.com

# Open a file, then auto-quit after 10 seconds
html-viewer ~/Documents/report.html --exit-after-delay 10
```

### Options

| Flag | Description |
|---|---|
| `--exit-after-delay <secs>` | Quit automatically after N seconds |
| `-h`, `--help`, `help` | Print usage and exit |

---

## Window behavior

**Title bar.** A slim custom title bar shows the app icon and the filename or hostname. Click the filename to copy the full path to your clipboard. A tooltip confirms the copy.

**Auto-height.** When a file loads, the window resizes to fit the content height, up to 80% of your screen height.

**Shrink to corner.** Click the `⊠` button (top-right of the window) to collapse the viewer to a 100x100 square that snaps to the upper-right corner of your screen. Click the square to expand back to its previous size and position.

**Recent files.** The last 10 opened files and URLs appear under **File > Recent Files** in the menu bar. Click any entry to reopen it. Use **Clear Recent Files** to reset the list.

**Single instance.** Launching `html-viewer` with a new file while the viewer is already open loads the new file in the existing window rather than opening a second one.

---

## Development

```bash
npm run dev
```

This sets `NODE_ENV=development`, which adds a **DEV** badge to the dock icon so you can tell the dev instance apart from a production build.

To build a distributable `.app`:

```bash
npm run build
```

---

## Keyboard shortcuts

Standard macOS shortcuts work inside the webview: `Cmd+R` reloads, `Cmd+Ctrl+F` toggles fullscreen.

`Cmd+Opt+'` toggles all html-viewer windows visible/hidden globally — works even when the app is not focused.
