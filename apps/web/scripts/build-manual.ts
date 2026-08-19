/**
 * Regenera el HTML autocontenido en public/manual/manual-uso-syncvete.html
 *
 * npx tsx --tsconfig scripts/tsconfig.json scripts/build-manual.ts
 */
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { MANUAL_CSS } from '../src/components/manual/manual-css';
import { UserManual } from '../src/components/manual/user-manual';

const ASSETS: Array<[src: string, mime: string]> = [
  ['/manual/illustrations/cover.jpg', 'image/jpeg'],
  ['/manual/illustrations/agenda.jpg', 'image/jpeg'],
  ['/manual/illustrations/consulta.jpg', 'image/jpeg'],
  ['/manual/illustrations/pacientes.jpg', 'image/jpeg'],
  ['/manual/illustrations/caja.jpg', 'image/jpeg'],
  ['/manual/illustrations/config.jpg', 'image/jpeg'],
  ['/brand/logo.png', 'image/png'],
];

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(webRoot, 'public');
const outFile = path.join(publicDir, 'manual', 'manual-uso-syncvete.html');

function inlineAssets(html: string) {
  let out = html;
  for (const [src, mime] of ASSETS) {
    const buf = readFileSync(path.join(publicDir, src.replace(/^\//, '')));
    out = out.split(src).join(`data:${mime};base64,${buf.toString('base64')}`);
  }
  return out;
}

const body = renderToStaticMarkup(createElement(UserManual));
const html = `<!DOCTYPE html><html lang="es-AR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Manual de uso · SyncVete</title><style>${MANUAL_CSS}</style></head><body>${body}</body></html>`;

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, inlineAssets(html), 'utf8');
console.log(`Wrote ${outFile}`);
