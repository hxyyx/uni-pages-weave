import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { actualRoot, assertFileExists, cleanDir, repoRoot } from '../../support/files.mjs';
import {
  caseFixture,
  readCases,
  requireArray,
  requireString,
  requireStringValue,
} from '../../support/cases.mjs';
import { assertPagesJsonEquivalent } from '../../support/pages-json.mjs';

const cliBin = path.join(repoRoot, 'packages', 'cli', 'dist', 'index.js');
const casesRoot = path.join(repoRoot, 'tests', 'e2e', 'cli', 'cases');
const e2eActualRoot = path.join(actualRoot, 'e2e', 'cli');

function runCli(projectDir, ...args) {
  execFileSync(process.execPath, [cliBin, ...args], {
    cwd: projectDir,
    stdio: 'pipe',
  });
}

function assertCliRoundTrip(testCase, caseDir) {
  const projectDir = path.join(e2eActualRoot, testCase.name);
  const pagesJsonPath = requireString(testCase.pagesJsonPath, `${testCase.name}.pagesJsonPath`);
  const commands = requireArray(testCase.commands, `${testCase.name}.commands`);
  const expectedFiles = requireArray(testCase.expectedFiles, `${testCase.name}.expectedFiles`);

  fs.cpSync(caseFixture(caseDir, testCase.fixture, `${testCase.name}.fixture`), projectDir, {
    recursive: true,
  });
  runCli(projectDir, requireString(commands[0], `${testCase.name}.commands[0]`));

  const pagesJson = path.join(projectDir, pagesJsonPath);
  const backup = path.join(path.dirname(pagesJson), 'pages.json.bak');

  assertFileExists(backup, `${testCase.name} backup`);

  for (const [index, expectedFile] of expectedFiles.entries()) {
    assertFileExists(
      path.join(
        projectDir,
        requireStringValue(expectedFile, `${testCase.name}.expectedFiles[${index}]`),
      ),
      `${testCase.name} expected file ${index}`,
    );
  }

  runCli(projectDir, requireString(commands[1], `${testCase.name}.commands[1]`));

  assertPagesJsonEquivalent(testCase.name, backup, pagesJson);
}

console.log('\nVerifying CLI E2E smoke tests');

assert.equal(fs.existsSync(cliBin), true, `CLI build output does not exist: ${cliBin}`);
cleanDir(e2eActualRoot);

for (const { caseDir, testCase } of readCases(casesRoot)) {
  if (testCase.kind !== 'cli-roundtrip') {
    throw new Error(`${testCase.name} has unsupported kind: ${testCase.kind}`);
  }

  assertCliRoundTrip(testCase, caseDir);
}

console.log('CLI E2E smoke tests passed.');
