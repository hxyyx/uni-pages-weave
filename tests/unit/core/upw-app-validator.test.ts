import assert from 'node:assert/strict';
import test from 'node:test';

import { validateUpwAppConfig } from '../../../packages/core/src/validator/upw-app-validator.js';

test('validateUpwAppConfig requires homePath', () => {
  assert.throws(() => validateUpwAppConfig({}), /homePath must be a non-empty string/u);
});

test('validateUpwAppConfig rejects uni-app subPackages key', () => {
  assert.throws(
    () =>
      validateUpwAppConfig({
        homePath: 'pages/index/index',
        subPackages: [],
      }),
    /Use subpackages/u,
  );
});

test('validateUpwAppConfig validates UPW subpackages shape', () => {
  assert.throws(
    () =>
      validateUpwAppConfig({
        homePath: 'pages/index/index',
        subpackages: [{ name: 'account' }],
      }),
    /root must be a non-empty string/u,
  );
});

test('validateUpwAppConfig rejects app patches that add top-level properties', () => {
  assert.throws(
    () =>
      validateUpwAppConfig({
        homePath: 'pages/index/index',
        $upw: {
          patches: [
            {
              when: ['h5'],
              patch: {
                window: {
                  navigationBarTitleText: 'H5',
                },
              },
            },
          ],
        },
      }),
    /cannot add a conditionally compiled top-level property/u,
  );
});
