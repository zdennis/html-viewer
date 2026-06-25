#!/usr/bin/env node
'use strict';

/**
 * html-viewer CLI helper
 *
 * This script is the npm bin entry point. It launches the Electron app
 * passing through any arguments.
 *
 * Usage:
 *   html-viewer <file-or-url>
 *
 * Examples:
 *   html-viewer ~/Desktop/page.html
 *   html-viewer https://example.com
 *
 * When installed as a macOS app, you can also open files via:
 *   open -a "HTML Viewer" ~/Desktop/page.html
 */

const { spawnSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '-h' || args[0] === '--help' || args[0] === 'help') {
  console.log(`
Usage: html-viewer <file-or-url> [options]

Opens an HTML file or URL in an always-on-top viewer window.

Arguments:
  <file-or-url>              Path to a local HTML file or a URL (http/https)

Options:
  --exit-after-delay <secs>  Automatically quit after N seconds
  -h, --help                 Show this help message
  help                       Show this help message

Examples:
  html-viewer ~/Desktop/page.html
  html-viewer https://example.com
  html-viewer ~/Desktop/page.html --exit-after-delay 10
  `.trim());
  process.exit(0);
}

const electronBin = require('electron');
const appDir = path.join(__dirname);

const result = spawnSync(electronBin, [appDir, ...args], { stdio: 'inherit' });
// spawnSync sets error when the process couldn't be started at all (ENOENT etc.)
if (result.error) {
  console.error('Failed to launch html-viewer:', result.error.message);
  process.exit(1);
}
// Electron exits 0 on normal close, non-zero only on real errors
if (result.status !== 0 && result.status !== null) {
  process.exit(result.status);
}
