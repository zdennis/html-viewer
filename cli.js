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

const { execFileSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '-h' || args[0] === '--help' || args[0] === 'help') {
  console.log(`
Usage: html-viewer <file-or-url>

Opens an HTML file or URL in an always-on-top viewer window.

Arguments:
  <file-or-url>   Path to a local HTML file or a URL (http/https)

Options:
  -h, --help      Show this help message
  help            Show this help message

Examples:
  html-viewer ~/Desktop/page.html
  html-viewer https://example.com
  `.trim());
  process.exit(0);
}

const electronBin = require.resolve('electron');
const appDir = path.join(__dirname);

try {
  execFileSync(electronBin, [appDir, ...args], { stdio: 'inherit' });
} catch (e) {
  process.exit(e.status || 1);
}
