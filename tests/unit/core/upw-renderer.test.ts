import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { renderUpwToUniPagesJson } from '../../../packages/core/src/index.js';
import { readCases, requireArray, requireObject } from '../../support/cases.mjs';
import { repoRoot } from '../../support/files.mjs';

const casesRoot = path.join(repoRoot, 'tests', 'unit', 'core', 'cases', 'upw-renderer');

function assertContains(output: string, values: unknown, label: string): void {
  for (const value of requireArray(values ?? [], `${label}.contains`)) {
    assert.equal(output.includes(String(value)), true, `${label} should contain ${String(value)}`);
  }
}

function assertNotContains(output: string, values: unknown, label: string): void {
  for (const value of requireArray(values ?? [], `${label}.notContains`)) {
    assert.equal(
      output.includes(String(value)),
      false,
      `${label} should not contain ${String(value)}`,
    );
  }
}

for (const { testCase } of readCases(casesRoot)) {
  test(testCase.name, () => {
    if (testCase.kind !== 'render-upw-to-uni') {
      throw new Error(`${testCase.name} has unsupported kind: ${testCase.kind}`);
    }

    const input = requireObject(testCase.input, `${testCase.name}.input`);
    const expected = requireObject(testCase.expected, `${testCase.name}.expected`);
    const output = renderUpwToUniPagesJson(
      requireObject(input.render, `${testCase.name}.input.render`),
    );

    assertContains(output, expected.contains, testCase.name);
    assertNotContains(output, expected.notContains, testCase.name);
  });
}
