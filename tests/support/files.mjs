import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readJsonc } from './jsonc.mjs';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const actualRoot = path.join(repoRoot, '.upw', 'tests');

export function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

export function assertFileExists(filePath, label = filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} does not exist: ${filePath}`);
  }
}

export function readText(filePath) {
  assertFileExists(filePath);
  return fs.readFileSync(filePath, 'utf8');
}

function walkFiles(dir, base = dir) {
  assertFileExists(dir);

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return walkFiles(fullPath, base);
    }

    if (!entry.isFile()) {
      return [];
    }

    return path.relative(base, fullPath).replace(/\\/gu, '/');
  });
}

function compareFile(actualFile, expectedFile) {
  const expected = readJsonc(expectedFile);
  const actual = readJsonc(actualFile);

  assert.deepEqual(actual, expected, `${actualFile} does not match ${expectedFile}`);
}

export function compareExpectedDirectory(actualDir, expectedDir) {
  const expectedFiles = walkFiles(expectedDir);

  if (expectedFiles.length === 0) {
    throw new Error(`Expected directory is empty: ${expectedDir}`);
  }

  for (const relativeFile of expectedFiles) {
    compareFile(path.join(actualDir, relativeFile), path.join(expectedDir, relativeFile));
  }
}

export function compareExpectedFile(actualFile, expectedFile) {
  compareFile(actualFile, expectedFile);
}

export function assertTextExpectations(actualBaseDir, expectationsFile) {
  const expectations = readJsonc(expectationsFile);

  if (!Array.isArray(expectations.files)) {
    throw new Error(`${expectationsFile} must define a files array.`);
  }

  for (const item of expectations.files) {
    if (typeof item.actual !== 'string' || !Array.isArray(item.contains)) {
      throw new Error(`${expectationsFile} contains an invalid text assertion.`);
    }

    const actualText = readText(path.join(actualBaseDir, item.actual));

    for (const expectedText of item.contains) {
      assert.equal(
        actualText.includes(expectedText),
        true,
        `${item.actual} does not contain expected text: ${expectedText}`,
      );
    }
  }
}

export function resolveFixture(baseDir, relativePath) {
  if (typeof relativePath !== 'string' || relativePath.trim() === '') {
    throw new Error(`Invalid fixture path: ${String(relativePath)}`);
  }

  return path.join(baseDir, relativePath);
}
