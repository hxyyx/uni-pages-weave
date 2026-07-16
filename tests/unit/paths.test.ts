import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { resolveProjectPaths, resolveUpwProjectPaths } from '../../src/index.js';
import { testDir as createTestDir } from '../support/fs.mjs';
import { writeJson } from '../support/json.mjs';

test('resolveProjectPaths detects cli src/pages.json layout', () => {
  const projectDir = createTestDir('unit-paths-cli');

  writeJson(path.join(projectDir, 'src', 'pages.json'), {
    pages: [{ path: 'pages/index/index' }],
  });

  assert.deepEqual(resolveProjectPaths(projectDir), {
    projectDir,
    layout: 'src',
    pagesJsonPath: path.join(projectDir, 'src', 'pages.json'),
    upwSourceDir: path.join(projectDir, 'src'),
  });
});

test('resolveProjectPaths detects hbuilderx root pages.json layout', () => {
  const projectDir = createTestDir('unit-paths-root');

  writeJson(path.join(projectDir, 'pages.json'), {
    pages: [{ path: 'pages/index/index' }],
  });

  assert.deepEqual(resolveProjectPaths(projectDir), {
    projectDir,
    layout: 'root',
    pagesJsonPath: path.join(projectDir, 'pages.json'),
    upwSourceDir: projectDir,
  });
});

test('resolveUpwProjectPaths detects src app.upw.json layout', () => {
  const projectDir = createTestDir('unit-paths-upw-src');

  writeJson(path.join(projectDir, 'src', 'app.upw.json'), {
    $upw: { homePath: 'pages/index/index' },
  });

  assert.deepEqual(resolveUpwProjectPaths(projectDir), {
    projectDir,
    layout: 'src',
    pagesJsonPath: path.join(projectDir, 'src', 'pages.json'),
    upwSourceDir: path.join(projectDir, 'src'),
  });
});
