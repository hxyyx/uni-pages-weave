import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeConditionalPatch,
  normalizeConditions,
  normalizeRequiredPlatformList,
} from '../../../packages/core/src/validator/upw-meta-validator.js';

test('normalizeRequiredPlatformList trims, lowercases, and deduplicates platforms', () => {
  assert.deepEqual(normalizeRequiredPlatformList([' H5 ', 'h5', 'MP-WEIXIN'], 'field'), [
    'h5',
    'mp-weixin',
  ]);
});

test('normalizeRequiredPlatformList rejects invalid lists', () => {
  assert.throws(() => normalizeRequiredPlatformList([], 'field'), /at least one platform/u);
  assert.throws(() => normalizeRequiredPlatformList([''], 'field'), /non-empty platform/u);
});

test('normalizeConditions rejects more than two layers', () => {
  assert.throws(
    () =>
      normalizeConditions(
        [{ when: ['h5'] }, { unless: ['mp-weixin'] }, { when: ['app-plus'] }],
        'field',
      ),
    /at most two/u,
  );
});

test('normalizeConditionalPatch requires a condition field', () => {
  assert.throws(
    () => normalizeConditionalPatch({ patch: { style: {} } }, 0, 'page.upw.json', '$upw.patches'),
    /must define conditions, when, or unless/u,
  );
});
