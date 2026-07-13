#!/usr/bin/env node

import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';

const currentDir = dirname(fileURLToPath(import.meta.url));
const entry = resolve(currentDir, '../dist/index.js');

if (!fs.existsSync(entry)) {
  console.error(
    'upw CLI has not been built yet. Run `pnpm --filter @uni-pages-weave/cli build` first.',
  );
  process.exit(1);
}

await import(pathToFileURL(entry).href);
