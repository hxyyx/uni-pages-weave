import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { resolveProjectPaths } from '../../../packages/core/dist/index.js';
import { actualRoot, cleanDir, repoRoot } from '../../support/files.mjs';

const projectActualRoot = path.join(actualRoot, 'integration', 'project-paths');
const fixturesRoot = path.join(repoRoot, 'tests', 'integration', 'project-paths', 'fixtures');

function assertProjectPaths(projectDir, expected) {
  const paths = resolveProjectPaths(projectDir);

  assert.equal(paths.projectDir, path.resolve(projectDir));
  assert.equal(paths.layout, expected.layout);
  assert.equal(paths.pagesJsonPath, path.join(projectDir, expected.pagesJsonPath));
  assert.equal(paths.upwSourceDir, path.join(projectDir, expected.upwSourceDir));
}

console.log('\nVerifying project path detection');

cleanDir(projectActualRoot);

const hbuildxProject = path.join(projectActualRoot, 'hbuildx');
fs.cpSync(path.join(fixturesRoot, 'hbuilderx'), hbuildxProject, { recursive: true });
assertProjectPaths(hbuildxProject, {
  layout: 'root',
  pagesJsonPath: 'pages.json',
  upwSourceDir: '',
});

const cliProject = path.join(projectActualRoot, 'cli');
fs.cpSync(path.join(fixturesRoot, 'cli'), cliProject, { recursive: true });
assertProjectPaths(cliProject, {
  layout: 'src',
  pagesJsonPath: path.join('src', 'pages.json'),
  upwSourceDir: 'src',
});

const mixedProject = path.join(projectActualRoot, 'mixed');
fs.cpSync(path.join(fixturesRoot, 'mixed'), mixedProject, { recursive: true });
assertProjectPaths(mixedProject, {
  layout: 'src',
  pagesJsonPath: path.join('src', 'pages.json'),
  upwSourceDir: 'src',
});

console.log('Project path detection passed.');
