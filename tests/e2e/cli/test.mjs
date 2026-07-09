import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { actualRoot, assertFileExists, cleanDir, repoRoot } from '../../support/files.mjs';
import { assertPagesJsonEquivalent } from '../../support/pages-json.mjs';

const cliBin = path.join(repoRoot, 'packages', 'cli', 'dist', 'index.js');
const fixturesRoot = path.join(repoRoot, 'tests', 'e2e', 'cli', 'fixtures');
const e2eActualRoot = path.join(actualRoot, 'e2e', 'cli');

function runCli(projectDir, ...args) {
  execFileSync(process.execPath, [cliBin, ...args], {
    cwd: projectDir,
    stdio: 'pipe',
  });
}

function assertCliRoundTrip({ fixtureName, projectName, pagesJsonPath, upwSourceDir }) {
  const projectDir = path.join(e2eActualRoot, projectName);

  fs.cpSync(path.join(fixturesRoot, fixtureName), projectDir, { recursive: true });

  runCli(projectDir, 'init');

  const pagesJson = path.join(projectDir, pagesJsonPath);
  const backup = path.join(path.dirname(pagesJson), 'pages.json.bak');

  assertFileExists(backup, `${projectName} backup`);
  assertFileExists(path.join(projectDir, upwSourceDir, 'app.upw.json'), `${projectName} app`);
  assertFileExists(
    path.join(projectDir, upwSourceDir, 'pages', 'index', 'index.upw.json'),
    `${projectName} page`,
  );

  runCli(projectDir, 'build');

  assertPagesJsonEquivalent(projectName, backup, pagesJson);
}

console.log('\nVerifying CLI E2E smoke tests');

assert.equal(fs.existsSync(cliBin), true, `CLI build output does not exist: ${cliBin}`);
cleanDir(e2eActualRoot);

assertCliRoundTrip({
  fixtureName: 'hbuilderx-basic',
  projectName: 'hbuilderx-basic',
  pagesJsonPath: 'pages.json',
  upwSourceDir: '',
});

assertCliRoundTrip({
  fixtureName: 'cli-basic',
  projectName: 'cli-basic',
  pagesJsonPath: path.join('src', 'pages.json'),
  upwSourceDir: 'src',
});

console.log('CLI E2E smoke tests passed.');
