import assert from 'node:assert/strict';
import test from 'node:test';

import {
  conditionsToUpwMeta,
  parseConditionEnv,
} from '../../../packages/core/src/utils/platform.js';

test('parseConditionEnv normalizes OR conditions', () => {
  assert.deepEqual(parseConditionEnv('MP-WEIXIN || H5'), ['mp-weixin', 'h5']);
});

test('parseConditionEnv rejects unsupported operators', () => {
  assert.throws(() => parseConditionEnv('MP-WEIXIN | H5'), /Use "\|\|" for OR/u);
  assert.throws(() => parseConditionEnv('MP-WEIXIN && H5'), /Only "\|\|" is supported/u);
});

test('conditionsToUpwMeta limits nested conditions to two layers', () => {
  assert.deepEqual(conditionsToUpwMeta([]), {});
  assert.throws(
    () =>
      conditionsToUpwMeta([
        { directive: 'ifdef', env: ['h5'] },
        { directive: 'ifdef', env: ['mp-weixin'] },
        { directive: 'ifndef', env: ['app-plus'] },
      ]),
    /at most two/u,
  );
});
