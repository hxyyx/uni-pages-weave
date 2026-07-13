import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  isPlatformPagePath,
  normalizePagePath,
  pagePathToWorkspaceFile,
} from '../../../packages/core/src/workspace/upw-workspace-paths.js';
import { readCases, requireArray, requireObject, requireString } from '../../support/cases.mjs';
import { repoRoot } from '../../support/files.mjs';

const casesRoot = path.join(repoRoot, 'tests', 'unit', 'core', 'cases', 'path');

for (const { testCase } of readCases(casesRoot)) {
  test(testCase.name, () => {
    if (testCase.kind === 'normalize-page-path') {
      const input = requireObject(testCase.input, `${testCase.name}.input`);
      const expected = requireObject(testCase.expected, `${testCase.name}.expected`);

      assert.equal(
        normalizePagePath(requireString(input.path, `${testCase.name}.input.path`)),
        expected.path,
      );
      return;
    }

    if (testCase.kind === 'is-platform-page-path') {
      for (const item of requireArray(testCase.inputs, `${testCase.name}.inputs`)) {
        const input = requireObject(item, `${testCase.name}.inputs[]`);

        assert.equal(
          isPlatformPagePath(requireString(input.path, `${testCase.name}.inputs[].path`)),
          input.expected,
        );
      }
      return;
    }

    if (testCase.kind === 'page-path-to-workspace-file') {
      const input = requireObject(testCase.input, `${testCase.name}.input`);
      const root = path.join(
        ...requireArray(input.root, `${testCase.name}.input.root`).map((item) => String(item)),
      );

      for (const item of requireArray(input.pages, `${testCase.name}.input.pages`)) {
        const page = requireObject(item, `${testCase.name}.input.pages[]`);

        assert.equal(
          pagePathToWorkspaceFile(root, requireString(page.path, `${testCase.name}.input.pages[].path`)),
          path.join(
            ...requireArray(page.expected, `${testCase.name}.input.pages[].expected`).map((part) =>
              String(part),
            ),
          ),
        );
      }
      return;
    }

    throw new Error(`${testCase.name} has unsupported kind: ${testCase.kind}`);
  });
}
