import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  conditionsToUpwMeta,
  parseConditionEnv,
} from '../../../packages/core/src/condition/condition-platform.js';
import { readCases, requireArray, requireObject, requireString } from '../../support/cases.mjs';
import { repoRoot } from '../../support/files.mjs';

const casesRoot = path.join(repoRoot, 'tests', 'unit', 'core', 'cases', 'platform');

for (const { testCase } of readCases(casesRoot)) {
  test(testCase.name, () => {
    if (testCase.kind === 'parse-condition-env') {
      const input = requireObject(testCase.input, `${testCase.name}.input`);
      const expected = requireObject(testCase.expected, `${testCase.name}.expected`);

      assert.deepEqual(
        parseConditionEnv(requireString(input.condition, `${testCase.name}.input.condition`)),
        expected.env,
      );
      return;
    }

    if (testCase.kind === 'parse-condition-env-list') {
      for (const item of requireArray(testCase.inputs, `${testCase.name}.inputs`)) {
        const input = requireObject(item, `${testCase.name}.inputs[]`);

        assert.deepEqual(
          parseConditionEnv(requireString(input.condition, `${testCase.name}.inputs[].condition`)),
          input.expected,
        );
      }
      return;
    }

    if (testCase.kind === 'conditions-to-upw-meta') {
      const input = requireObject(testCase.input, `${testCase.name}.input`);
      const expected = requireObject(testCase.expected, `${testCase.name}.expected`);

      assert.deepEqual(conditionsToUpwMeta(requireArray(input.valid, `${testCase.name}.input.valid`)), expected.valid);
      assert.throws(
        () => conditionsToUpwMeta(requireArray(input.invalid, `${testCase.name}.input.invalid`)),
        new RegExp(requireString(expected.errorPattern, `${testCase.name}.expected.errorPattern`), 'u'),
      );
      return;
    }

    throw new Error(`${testCase.name} has unsupported kind: ${testCase.kind}`);
  });
}
