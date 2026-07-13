import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  normalizeConditionalPatch,
  normalizeConditions,
  normalizeRequiredPlatformList,
} from '../../../packages/core/src/rules/upw-meta-rules.js';
import { readCases, requireArray, requireObject, requireString } from '../../support/cases.mjs';
import { repoRoot } from '../../support/files.mjs';

const casesRoot = path.join(repoRoot, 'tests', 'unit', 'core', 'cases', 'upw-meta-rules');

for (const { testCase } of readCases(casesRoot)) {
  test(testCase.name, () => {
    if (testCase.kind === 'normalize-required-platform-list') {
      const input = requireObject(testCase.input, `${testCase.name}.input`);
      const expected = requireObject(testCase.expected, `${testCase.name}.expected`);

      assert.deepEqual(
        normalizeRequiredPlatformList(
          requireArray(input.value, `${testCase.name}.input.value`),
          requireString(input.fieldPath, `${testCase.name}.input.fieldPath`),
        ),
        expected.value,
      );
      return;
    }

    if (testCase.kind === 'normalize-conditions-errors') {
      for (const [index, item] of requireArray(testCase.inputs, `${testCase.name}.inputs`).entries()) {
        const input = requireObject(item, `${testCase.name}.inputs[${index}]`);

        assert.throws(
          () =>
            normalizeConditions(
              input.value,
              requireString(input.fieldPath, `${testCase.name}.inputs[${index}].fieldPath`),
            ),
          new RegExp(requireString(input.errorPattern, `${testCase.name}.inputs[${index}].errorPattern`), 'u'),
        );
      }
      return;
    }

    if (testCase.kind === 'normalize-conditional-patch-errors') {
      for (const [index, item] of requireArray(testCase.inputs, `${testCase.name}.inputs`).entries()) {
        const input = requireObject(item, `${testCase.name}.inputs[${index}]`);

        assert.throws(
          () =>
            normalizeConditionalPatch(
              input.value,
              Number(input.index),
              requireString(input.label, `${testCase.name}.inputs[${index}].label`),
              requireString(
                input.fieldPathPrefix,
                `${testCase.name}.inputs[${index}].fieldPathPrefix`,
              ),
            ),
          new RegExp(requireString(input.errorPattern, `${testCase.name}.inputs[${index}].errorPattern`), 'u'),
        );
      }
      return;
    }

    throw new Error(`${testCase.name} has unsupported kind: ${testCase.kind}`);
  });
}
