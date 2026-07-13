import fs from 'node:fs';
import path from 'node:path';

import { readJsonc } from './jsonc.mjs';
import { actualRoot, resolveFixture } from './files.mjs';

export function findCaseFiles(dir) {
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

export function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

export function requireStringValue(value, label) {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string.`);
  }

  return value;
}

export function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value;
}

export function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value;
}

export function readCase(caseFile) {
  const testCase = readJsonc(caseFile);

  requireString(testCase.name, `${caseFile}.name`);
  requireString(testCase.kind, `${testCase.name}.kind`);

  return {
    caseDir: path.dirname(caseFile),
    caseFile,
    testCase,
  };
}

export function readCases(casesRoot) {
  const caseFiles = findCaseFiles(casesRoot).sort();

  if (caseFiles.length === 0) {
    throw new Error(`No case.json files found under ${casesRoot}.`);
  }

  return caseFiles.map(readCase);
}

export function actualCaseDir(casesRoot, actualBaseDir, testCase, caseFile) {
  const group = path.relative(casesRoot, path.dirname(caseFile)).split(path.sep)[0] ?? 'case';

  return path.join(actualBaseDir, group, testCase.name);
}

export function actualSuiteCaseDir(suiteName, testCase) {
  return path.join(actualRoot, suiteName, testCase.name);
}

export function caseFixture(caseDir, relativePath, label = 'fixture') {
  return resolveFixture(caseDir, requireString(relativePath, label));
}

export function withWorkingDirectory(dir, callback) {
  const previous = process.cwd();

  process.chdir(dir);

  try {
    return callback();
  } finally {
    process.chdir(previous);
  }
}

export function copyFixtureToActual(input, actualDir) {
  const copiedInput = path.join(actualDir, 'input', path.basename(input));

  fs.mkdirSync(path.dirname(copiedInput), { recursive: true });
  fs.copyFileSync(input, copiedInput);

  return copiedInput;
}
