/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS production wrapper */
// Production start wrapper — sets env vars and launches the Next.js standalone server.
// Ensures static assets are symlinked into the standalone directory before starting.

const fs = require('fs');
const path = require('path');

const root = __dirname;
const standaloneDir = path.join(root, '.next', 'standalone', '.next');
const staticSrc = path.join(root, '.next', 'static');
const staticDst = path.join(standaloneDir, 'static');

// Copy static files if missing (required for standalone mode to serve JS chunks)
if (!fs.existsSync(staticDst)) {
  fs.cpSync(staticSrc, staticDst, { recursive: true });
}

// DATA_DIR: an explicitly set env var always wins (production compose sets DATA_DIR=/app/data).
// Only default when unset — same default as src/lib/data-dir.ts (<cwd>/data).
if (!process.env.DATA_DIR) {
  process.env.DATA_DIR = path.join(process.cwd(), 'data');
}
process.env.PORT = '3334'; // Internal port — Caddy proxies from 3333/80/443
process.env.HOSTNAME = '0.0.0.0';
require('./.next/standalone/server.js');
