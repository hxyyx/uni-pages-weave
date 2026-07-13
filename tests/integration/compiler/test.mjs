import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildUniPagesJsonFromUpwSource,
  extractUpwSourceFromUniPagesJson,
} from '../../../packages/core/dist/index.js';
import {
  actualRoot,
  assertFileExists,
  assertTextExpectations,
  cleanDir,
  compareExpectedDirectory,
  compareExpectedFile,
  repoRoot,
  resolveFixture,
} from '../../support/files.mjs';
import {
  actualCaseDir,
  caseFixture,
  copyFixtureToActual,
  readCases,
  requireString,
  withWorkingDirectory,
} from '../../support/cases.mjs';
import { readJsonc } from '../../support/jsonc.mjs';
import { assertPagesJsonEquivalent } from '../../support/pages-json.mjs';

const casesRoot = path.join(repoRoot, 'tests', 'integration', 'compiler', 'cases');
const caseActualRoot = path.join(actualRoot, 'integration', 'compiler');

function assertPagesJsonBackup(input) {
  const backup = path.join(path.dirname(input), 'pages.json.bak');

  assertFileExists(backup, `${input} backup`);
  assert.equal(fs.readFileSync(backup, 'utf8'), fs.readFileSync(input, 'utf8'));
}

function assertNoPagesJsonBackup(input) {
  const backup = path.join(path.dirname(input), 'pages.json.bak');

  assert.equal(fs.existsSync(backup), false, `${input} backup should not exist.`);
}

function readExpectedErrorPattern(testCase, caseDir) {
  const expectedError = readJsonc(
    caseFixture(caseDir, testCase.expectedError, `${testCase.name}.expectedError`),
  );

  if (typeof expectedError.messagePattern !== 'string') {
    throw new Error(`${testCase.name} expected error must define messagePattern.`);
  }

  return new RegExp(expectedError.messagePattern, 'u');
}

function compareSuccessOutputs(testCase, caseDir, actualDir) {
  const actual = testCase.actual ?? {};
  const expected = testCase.expected ?? {};

  if (expected.upw) {
    compareExpectedDirectory(
      path.join(actualDir, requireString(actual.upw, `${testCase.name}.actual.upw`)),
      resolveFixture(caseDir, expected.upw),
    );
  }

  if (expected.pages) {
    compareExpectedFile(
      path.join(actualDir, requireString(actual.pages, `${testCase.name}.actual.pages`)),
      resolveFixture(caseDir, expected.pages),
    );
  }

  if (expected.text) {
    assertTextExpectations(actualDir, resolveFixture(caseDir, expected.text));
  }
}

function runSuccessCase(testCase, caseDir, actualDir) {
  const actual = testCase.actual ?? {};
  const input = copyFixtureToActual(
    caseFixture(caseDir, testCase.input, `${testCase.name}.input`),
    actualDir,
  );
  const upwDir = path.join(actualDir, requireString(actual.upw, `${testCase.name}.actual.upw`));
  const pagesOutput =
    testCase.kind === 'roundtrip'
      ? path.join(actualDir, requireString(actual.pages, `${testCase.name}.actual.pages`))
      : path.join(actualDir, 'roundtrip', 'pages.json');

  readJsonc(input);
  withWorkingDirectory(actualDir, () => {
    extractUpwSourceFromUniPagesJson({ input, output: upwDir });
  });
  assertPagesJsonBackup(input);

  if (testCase.roundtrip === false) {
    compareSuccessOutputs(testCase, caseDir, actualDir);
    return;
  }

  buildUniPagesJsonFromUpwSource({
    input: upwDir,
    output: pagesOutput,
  });

  assertPagesJsonEquivalent(testCase.name, input, pagesOutput);
  compareSuccessOutputs(testCase, caseDir, actualDir);
}

function runUpwToUniSuccessCase(testCase, caseDir, actualDir) {
  const actual = testCase.actual ?? {};
  const input = caseFixture(caseDir, testCase.input, `${testCase.name}.input`);

  buildUniPagesJsonFromUpwSource({
    input,
    output: path.join(actualDir, requireString(actual.pages, `${testCase.name}.actual.pages`)),
  });

  compareSuccessOutputs(testCase, caseDir, actualDir);
}

function runUniToUpwErrorCase(testCase, caseDir, actualDir) {
  const input = copyFixtureToActual(
    caseFixture(caseDir, testCase.input, `${testCase.name}.input`),
    actualDir,
  );
  const messagePattern = readExpectedErrorPattern(testCase, caseDir);

  readJsonc(input);

  try {
    withWorkingDirectory(actualDir, () => {
      extractUpwSourceFromUniPagesJson({
        input,
        output: path.join(actualDir, 'upw'),
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    assert.match(message, messagePattern, `${testCase.name} error mismatch.`);
    assertNoPagesJsonBackup(input);
    return;
  }

  throw new Error(`${testCase.name} expected an error, but conversion succeeded.`);
}

function runUpwToUniErrorCase(testCase, caseDir, actualDir) {
  const input = caseFixture(caseDir, testCase.input, `${testCase.name}.input`);
  const messagePattern = readExpectedErrorPattern(testCase, caseDir);

  try {
    buildUniPagesJsonFromUpwSource({
      input,
      output: path.join(actualDir, 'pages.json'),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    assert.match(message, messagePattern, `${testCase.name} error mismatch.`);
    return;
  }

  throw new Error(`${testCase.name} expected an error, but conversion succeeded.`);
}

const cases = readCases(casesRoot);

cleanDir(caseActualRoot);

for (const { caseDir, caseFile, testCase } of cases) {
  const actualDir = actualCaseDir(casesRoot, caseActualRoot, testCase, caseFile);

  console.log(`\nVerifying scenario fixture: ${testCase.name}`);
  cleanDir(actualDir);

  if (testCase.kind === 'uni-to-upw' || testCase.kind === 'roundtrip') {
    runSuccessCase(testCase, caseDir, actualDir);
    continue;
  }

  if (testCase.kind === 'upw-to-uni') {
    runUpwToUniSuccessCase(testCase, caseDir, actualDir);
    continue;
  }

  if (testCase.kind === 'uni-to-upw-error') {
    runUniToUpwErrorCase(testCase, caseDir, actualDir);
    continue;
  }

  if (testCase.kind === 'upw-to-uni-error') {
    runUpwToUniErrorCase(testCase, caseDir, actualDir);
    continue;
  }

  throw new Error(`${testCase.name} has unsupported kind: ${testCase.kind}`);
}

console.log('\nSingle-scenario cases passed.');
