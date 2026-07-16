import assert from 'node:assert/strict';

import { readJsonc } from './json.mjs';

function stable(value) {
  if (Array.isArray(value)) {
    return value.map(stable);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  }

  return value;
}

function subpackages(data) {
  if (Array.isArray(data.subPackages)) {
    return data.subPackages;
  }

  return Array.isArray(data.subpackages) ? data.subpackages : [];
}

function flattenPages(data) {
  return [
    ...(data.pages ?? []).map((page) => [`main:${page.path}`, stable(page)]),
    ...subpackages(data).flatMap((subpackage) =>
      (subpackage.pages ?? []).map((page) => [
        `sub:${subpackage.root}/${page.path}`,
        stable(page),
      ]),
    ),
  ];
}

function appConfig(data) {
  const output = { ...data };

  delete output.pages;
  delete output.subPackages;
  delete output.subpackages;

  return stable(output);
}

export function assertPagesJsonEquivalent(label, expectedFile, actualFile) {
  const expected = readJsonc(expectedFile);
  const actual = readJsonc(actualFile);

  assert.equal(actual.pages?.[0]?.path, expected.pages?.[0]?.path, `${label}: home page changed.`);
  assert.deepEqual(
    new Map(flattenPages(actual)),
    new Map(flattenPages(expected)),
    `${label}: page set or page config changed.`,
  );
  assert.deepEqual(appConfig(actual), appConfig(expected), `${label}: app config changed.`);
}

export function assertThrowsMessage(fn, pattern, label) {
  try {
    fn();
  } catch (error) {
    assert.match(error instanceof Error ? error.message : String(error), pattern, label);
    return;
  }

  throw new Error(`${label}: expected function to throw.`);
}
