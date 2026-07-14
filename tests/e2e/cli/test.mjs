import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  actualRoot,
  assertFileExists,
  cleanDir,
  compareExpectedFile,
  repoRoot,
} from '../../support/files.mjs';
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
const initWatchHint = 'Run `upw watch` to start watching upw files.';

function runCli(projectDir, ...args) {
  return execFileSync(process.execPath, [cliBin, ...args], {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function runCliFailure(projectDir, ...args) {
  try {
    runCli(projectDir, ...args);
  } catch (error) {
    return {
      stderr: error.stderr?.toString() ?? '',
      stdout: error.stdout?.toString() ?? '',
      status: error.status,
    };
  }

  throw new Error(`Expected CLI command to fail: ${args.join(' ')}`);
}

function assertCliCommandShape() {
  const rootHelp = runCli(e2eActualRoot, '--help');
  const buildHelp = runCli(e2eActualRoot, 'build', '--help');
  const buildWatchFailure = runCliFailure(e2eActualRoot, 'build', '--watch');
  const buildWatchOutput = `${buildWatchFailure.stdout}\n${buildWatchFailure.stderr}`;

  assert.equal(rootHelp.includes('watch'), true, 'root help should list the watch command.');
  assert.equal(
    buildHelp.includes('--watch'),
    false,
    'build help should not list the removed --watch option.',
  );
  assert.notEqual(buildWatchFailure.status, 0, 'build --watch should fail.');
  assert.match(buildWatchOutput, /unknown option/i, 'build --watch should be an unknown option.');
}

function assertCliRoundTrip(testCase, caseDir) {
  const projectDir = path.join(e2eActualRoot, testCase.name);
  const pagesJsonPath = requireString(testCase.pagesJsonPath, `${testCase.name}.pagesJsonPath`);
  const commands = requireArray(testCase.commands, `${testCase.name}.commands`);
  const expectedFiles = requireArray(testCase.expectedFiles, `${testCase.name}.expectedFiles`);

  fs.cpSync(caseFixture(caseDir, testCase.fixture, `${testCase.name}.fixture`), projectDir, {
    recursive: true,
  });
  const initOutput = runCli(projectDir, requireString(commands[0], `${testCase.name}.commands[0]`));

  assert.equal(
    initOutput.includes(initWatchHint),
    true,
    `${testCase.name} init output should include watch hint.`,
  );
  assert.equal(initOutput.includes('app'), true, `${testCase.name} init output should list app.`);
  assert.equal(initOutput.includes('page'), true, `${testCase.name} init output should list pages.`);
  assert.equal(
    initOutput.includes('backup'),
    true,
    `${testCase.name} init output should list backup.`,
  );

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
    assert.equal(
      initOutput.includes(
        requireStringValue(expectedFile, `${testCase.name}.expectedFiles[${index}]`),
      ),
      true,
      `${testCase.name} init output should include expected file ${index}.`,
    );
  }

  assert.equal(
    initOutput.includes(path.relative(projectDir, backup).replace(/\\/gu, '/')),
    true,
    `${testCase.name} init output should include backup path.`,
  );

  runCli(projectDir, requireString(commands[1], `${testCase.name}.commands[1]`));

  assertPagesJsonEquivalent(testCase.name, backup, pagesJson);
}

function assertCliBuildOnly(testCase, caseDir) {
  const projectDir = path.join(e2eActualRoot, testCase.name);
  const pagesJsonPath = requireString(testCase.pagesJsonPath, `${testCase.name}.pagesJsonPath`);
  const expectedPagesJson = requireString(
    testCase.expectedPagesJson,
    `${testCase.name}.expectedPagesJson`,
  );

  fs.cpSync(caseFixture(caseDir, testCase.fixture, `${testCase.name}.fixture`), projectDir, {
    recursive: true,
  });
  runCli(projectDir, 'build');

  compareExpectedFile(
    path.join(projectDir, pagesJsonPath),
    caseFixture(caseDir, expectedPagesJson, `${testCase.name}.expectedPagesJson`),
  );
}

console.log('\nVerifying CLI E2E smoke tests');

assert.equal(fs.existsSync(cliBin), true, `CLI build output does not exist: ${cliBin}`);
cleanDir(e2eActualRoot);
assertCliCommandShape();

for (const { caseDir, testCase } of readCases(casesRoot)) {
  if (testCase.kind === 'cli-roundtrip') {
    assertCliRoundTrip(testCase, caseDir);
    continue;
  }

  if (testCase.kind === 'cli-build-only') {
    assertCliBuildOnly(testCase, caseDir);
    continue;
  }

  throw new Error(`${testCase.name} has unsupported kind: ${testCase.kind}`);
}

console.log('CLI E2E smoke tests passed.');
