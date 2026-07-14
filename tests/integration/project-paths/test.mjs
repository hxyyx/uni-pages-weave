import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { resolveProjectPaths, resolveUpwProjectPaths } from '../../../packages/core/dist/index.js';
import { actualRoot, cleanDir, repoRoot } from '../../support/files.mjs';
import {
  caseFixture,
  readCases,
  requireObject,
  requireString,
  requireStringValue,
} from '../../support/cases.mjs';

const projectActualRoot = path.join(actualRoot, 'integration', 'project-paths');
const casesRoot = path.join(repoRoot, 'tests', 'integration', 'project-paths', 'cases');

function assertProjectPaths(projectDir, expected) {
  const paths = resolveProjectPaths(projectDir);

  assertResolvedPaths(paths, projectDir, expected);
}

function assertUpwProjectPaths(projectDir, expected) {
  const paths = resolveUpwProjectPaths(projectDir);

  assertResolvedPaths(paths, projectDir, expected);
}

function assertResolvedPaths(paths, projectDir, expected) {
  assert.equal(paths.projectDir, path.resolve(projectDir));
  assert.equal(paths.layout, expected.layout);
  assert.equal(paths.pagesJsonPath, path.join(projectDir, expected.pagesJsonPath));
  assert.equal(paths.upwSourceDir, path.join(projectDir, expected.upwSourceDir));
}

console.log('\nVerifying project path detection');

cleanDir(projectActualRoot);

for (const { caseDir, testCase } of readCases(casesRoot)) {
  if (testCase.kind !== 'project-paths' && testCase.kind !== 'upw-project-paths') {
    throw new Error(`${testCase.name} has unsupported kind: ${testCase.kind}`);
  }

  const projectDir = path.join(projectActualRoot, testCase.name);

  fs.cpSync(caseFixture(caseDir, testCase.fixture, `${testCase.name}.fixture`), projectDir, {
    recursive: true,
  });
  const expected = {
    ...requireObject(testCase.expected, `${testCase.name}.expected`),
    layout: requireString(testCase.expected?.layout, `${testCase.name}.expected.layout`),
    pagesJsonPath: requireString(
      testCase.expected?.pagesJsonPath,
      `${testCase.name}.expected.pagesJsonPath`,
    ),
    upwSourceDir: requireStringValue(
      testCase.expected?.upwSourceDir,
      `${testCase.name}.expected.upwSourceDir`,
    ),
  };

  if (testCase.kind === 'upw-project-paths') {
    assertUpwProjectPaths(projectDir, expected);
  } else {
    assertProjectPaths(projectDir, expected);
  }
}

console.log('Project path detection passed.');
