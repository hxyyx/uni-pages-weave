import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  normalizePagesJsonComments,
  parseConditionBlocks,
  stripConditionalSections,
} from '../../../packages/core/src/parser/condition-parser.js';
import { caseFixture, readCases, requireArray, requireObject } from '../../support/cases.mjs';
import { readText, repoRoot } from '../../support/files.mjs';

const casesRoot = path.join(repoRoot, 'tests', 'unit', 'core', 'cases', 'condition-parser');

function assertContains(text: string, values: unknown, label: string): void {
  for (const value of requireArray(values ?? [], `${label}.contains`)) {
    assert.equal(text.includes(String(value)), true, `${label} should contain ${String(value)}`);
  }
}

function assertNotContains(text: string, values: unknown, label: string): void {
  for (const value of requireArray(values ?? [], `${label}.notContains`)) {
    assert.equal(text.includes(String(value)), false, `${label} should not contain ${String(value)}`);
  }
}

function inputFiles(testCase: Record<string, unknown>, caseDir: string): string[] {
  if (typeof testCase.input === 'string') {
    return [caseFixture(caseDir, testCase.input, `${testCase.name}.input`)];
  }

  return requireArray(testCase.inputs, `${testCase.name}.inputs`).map((input, index) =>
    caseFixture(caseDir, input, `${testCase.name}.inputs[${index}]`),
  );
}

for (const { caseDir, testCase } of readCases(casesRoot)) {
  test(testCase.name, () => {
    const expected = requireObject(testCase.expected, `${testCase.name}.expected`);

    if (testCase.kind === 'normalize-comments') {
      for (const inputFile of inputFiles(testCase, caseDir)) {
        const normalized = normalizePagesJsonComments(readText(inputFile));

        assertContains(normalized, expected.contains, testCase.name);
        assertNotContains(normalized, expected.notContains, testCase.name);
      }
      return;
    }

    if (testCase.kind === 'strip-conditional-sections') {
      const [inputFile] = inputFiles(testCase, caseDir);
      const stripped = stripConditionalSections(readText(inputFile));

      assertContains(stripped, expected.contains, testCase.name);
      assertNotContains(stripped, expected.notContains, testCase.name);
      return;
    }

    if (testCase.kind === 'parse-condition-blocks') {
      const [inputFile] = inputFiles(testCase, caseDir);
      const blocks = parseConditionBlocks(readText(inputFile));
      const expectedBlocks = requireArray(expected.blocks, `${testCase.name}.expected.blocks`);

      assert.deepEqual(
        blocks.map((block) => ({
          path:
            block.content && typeof block.content === 'object'
              ? (block.content as Record<string, unknown>).path
              : undefined,
          env: block.conditions[0]?.env,
        })),
        expectedBlocks,
      );
      return;
    }

    throw new Error(`${testCase.name} has unsupported kind: ${testCase.kind}`);
  });
}
