import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { validateUpwAppConfig } from '../../../packages/core/src/rules/upw-app-rules.js';
import { readCases, requireArray, requireObject, requireString } from '../../support/cases.mjs';
import { repoRoot } from '../../support/files.mjs';

const casesRoot = path.join(repoRoot, 'tests', 'unit', 'core', 'cases', 'upw-app-rules');

function assertErrorCase(item: unknown, label: string): void {
  const input = requireObject(item, label);

  assert.throws(
    () => validateUpwAppConfig(requireObject(input.config, `${label}.config`)),
    new RegExp(requireString(input.errorPattern, `${label}.errorPattern`), 'u'),
  );
}

for (const { testCase } of readCases(casesRoot)) {
  test(testCase.name, () => {
    if (testCase.kind === 'validate-upw-app') {
      const input = requireObject(testCase.input, `${testCase.name}.input`);
      const expected = requireObject(testCase.expected, `${testCase.name}.expected`);
      const result = validateUpwAppConfig(
        requireObject(input.config, `${testCase.name}.input.config`),
      );

      if (Object.prototype.hasOwnProperty.call(expected, 'homePath')) {
        assert.equal(result.homePath, expected.homePath);
      }

      if (Object.prototype.hasOwnProperty.call(expected, 'patch')) {
        assert.deepEqual(result.patches?.[0]?.patch, expected.patch);
      }
      return;
    }

    if (testCase.kind === 'validate-upw-app-errors') {
      requireArray(testCase.inputs, `${testCase.name}.inputs`).forEach((item, index) =>
        assertErrorCase(item, `${testCase.name}.inputs[${index}]`),
      );
      return;
    }

    throw new Error(`${testCase.name} has unsupported kind: ${testCase.kind}`);
  });
}
