#!/usr/bin/env node
/*
 * update.mjs — update this study app to the latest app template (code, styles,
 * build script, themes) from the learn-anything project, then rebuild.
 *
 * It overwrites ONLY the app shell — your study.config.json, content/, and saved
 * progress (which lives in your browser) are never touched. After it runs, just
 * reload index.html.
 *
 * Run:  node update.mjs
 * Requires Node >= 22 and a network connection.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = dirname(fileURLToPath(import.meta.url));
const BASE = 'https://raw.githubusercontent.com/makeit-run/learn-anything/main/plugins/learn/skills/anything/template';

// The app shell — NOT your study.config.json, content/, or generated data/.
const TEXT_FILES = [
  'index.html',
  'css/style.css',
  'js/store.js', 'js/db.js', 'js/app.js',
  'build/build.mjs', 'build/vendor/marked.esm.js',
  'vendor/sql-wasm.js',
  'update.mjs',
];
const BINARY_FILES = ['vendor/sql-wasm.wasm'];

async function grab(path, binary) {
  const res = await fetch(BASE + '/' + path, { cache: 'no-store' });
  if (!res.ok) throw new Error(path + ' → HTTP ' + res.status);
  return binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
}

console.log('Updating the app template from learn-anything…');
let n = 0;
try {
  for (const f of TEXT_FILES) {
    const content = await grab(f, false);
    const dest = join(ROOT, f);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content);
    console.log('  ✓ ' + f);
    n++;
  }
  for (const f of BINARY_FILES) {
    const buf = await grab(f, true);
    const dest = join(ROOT, f);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, buf);
    console.log('  ✓ ' + f);
    n++;
  }
} catch (err) {
  console.error('\n✗ Update failed: ' + err.message);
  console.error('  Check your connection and try again. Nothing was rebuilt.');
  process.exit(1);
}

console.log(`\nUpdated ${n} files. Rebuilding the database…\n`);
execFileSync('node', [join(ROOT, 'build', 'build.mjs')], { stdio: 'inherit' });
console.log('\n✅ App updated. Reload index.html — your content and progress are untouched.');
