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
import { readJsonc } from '../../support/jsonc.mjs';
import { assertPagesJsonEquivalent } from '../../support/pages-json.mjs';

const casesRoot = path.join(repoRoot, 'tests', 'integration', 'compiler', 'cases');
const caseActualRoot = path.join(actualRoot, 'integration', 'compiler');

function findCaseFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return findCaseFiles(fullPath);
    }

    return entry.isFile() && entry.name === 'case.json' ? [fullPath] : [];
  });
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function actualCaseDir(testCase, caseFile) {
  const group = path.relative(casesRoot, path.dirname(caseFile)).split(path.sep)[0] ?? 'case';

  return path.join(caseActualRoot, group, testCase.name);
}

function withWorkingDirectory(dir, callback) {
  const previous = process.cwd();

  process.chdir(dir);

  try {
    return callback();
  } finally {
    process.chdir(previous);
  }
}

function copyInputToActual(input, actualDir) {
  const copiedInput = path.join(actualDir, 'input', path.basename(input));

  fs.mkdirSync(path.dirname(copiedInput), { recursive: true });
  fs.copyFileSync(input, copiedInput);

  return copiedInput;
}

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
    resolveFixture(
      caseDir,
      requireString(testCase.expectedError, `${testCase.name}.expectedError`),
    ),
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
  const input = copyInputToActual(
    resolveFixture(caseDir, requireString(testCase.input, `${testCase.name}.input`)),
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
  const input = resolveFixture(caseDir, requireString(testCase.input, `${testCase.name}.input`));

  buildUniPagesJsonFromUpwSource({
    input,
    output: path.join(actualDir, requireString(actual.pages, `${testCase.name}.actual.pages`)),
  });

  compareSuccessOutputs(testCase, caseDir, actualDir);
}

function runUniToUpwErrorCase(testCase, caseDir, actualDir) {
  const input = copyInputToActual(
    resolveFixture(caseDir, requireString(testCase.input, `${testCase.name}.input`)),
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
  const input = resolveFixture(caseDir, requireString(testCase.input, `${testCase.name}.input`));
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

const caseFiles = findCaseFiles(casesRoot).sort();

if (caseFiles.length === 0) {
  throw new Error('No compiler integration cases found under tests/integration/compiler/cases.');
}

cleanDir(caseActualRoot);

for (const caseFile of caseFiles) {
  const caseDir = path.dirname(caseFile);
  const testCase = readJsonc(caseFile);

  requireString(testCase.name, `${caseFile}.name`);
  requireString(testCase.kind, `${testCase.name}.kind`);

  const actualDir = actualCaseDir(testCase, caseFile);

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
