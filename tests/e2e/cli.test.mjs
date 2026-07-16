import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { assertPagesJsonEquivalent } from '../support/assertions.mjs';
import { assertFileExists, readText, repoRoot, testDir } from '../support/fs.mjs';
import { writeJson } from '../support/json.mjs';

const cliBin = path.join(repoRoot, 'bin', 'index.js');

function runCli(projectDir, ...args) {
  return execFileSync(process.execPath, [cliBin, ...args], {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

console.log('\nVerifying lightweight CLI E2E tests');

{
  const dir = testDir('e2e-cli-shape');
  const version = runCli(dir, '--version').trim();
  const help = runCli(dir, '--help');

  assert.match(version, /^\d+\.\d+\.\d+$/u);
  assert.equal(help.includes('init'), true);
  assert.equal(help.includes('build'), true);
  assert.equal(help.includes('watch'), true);
}

{
  const dir = testDir('e2e-cli-init-build');
  const pagesJson = path.join(dir, 'src', 'pages.json');

  writeJson(pagesJson, {
    pages: [
      {
        path: 'pages/index/index',
        style: { navigationBarTitleText: 'Home' },
      },
    ],
  });

  const initOutput = runCli(dir, 'init');

  assert.equal(initOutput.includes('app'), true);
  assert.equal(initOutput.includes('page'), true);
  assertFileExists(path.join(dir, 'src', 'app.upw.json'));
  assertFileExists(path.join(dir, 'src', 'pages', 'index', 'index.upw.json'));

  const original = path.join(dir, 'original-pages.json');

  writeJson(original, {
    pages: [
      {
        path: 'pages/index/index',
        style: { navigationBarTitleText: 'Home' },
      },
    ],
  });

  runCli(dir, 'build');

  assert.equal(readText(pagesJson).includes('pages/index/index'), true);
  assertPagesJsonEquivalent('cli init/build', original, pagesJson);
}

console.log('Lightweight CLI E2E tests passed.');
