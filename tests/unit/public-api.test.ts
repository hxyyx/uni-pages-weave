import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildUniPagesJsonFromUpwSource,
  extractUpwSourceFromUniPagesJson,
  initUpw,
  renderUpwToUniPagesJson,
  resolveProjectPaths,
  resolveUpwProjectPaths,
  watchUniPagesJsonFromUpwSource,
} from '../../src/index.js';

test('root public API exports stable package functions', () => {
  assert.equal(typeof extractUpwSourceFromUniPagesJson, 'function');
  assert.equal(typeof initUpw, 'function');
  assert.equal(typeof buildUniPagesJsonFromUpwSource, 'function');
  assert.equal(typeof watchUniPagesJsonFromUpwSource, 'function');
  assert.equal(typeof renderUpwToUniPagesJson, 'function');
  assert.equal(typeof resolveProjectPaths, 'function');
  assert.equal(typeof resolveUpwProjectPaths, 'function');
});
