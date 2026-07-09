import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  normalizePagesJsonComments,
  parseConditionBlocks,
  stripConditionalSections,
} from '../../../packages/core/src/parser/condition-parser.js';
import { readText, repoRoot } from '../../support/files.mjs';

const fixturesRoot = path.join(
  repoRoot,
  'tests',
  'unit',
  'core',
  'fixtures',
  'condition-parser',
);

function fixture(name: string): string {
  return readText(path.join(fixturesRoot, name));
}

test('normalizePagesJsonComments removes ordinary comments and preserves directives', () => {
  const normalized = normalizePagesJsonComments(fixture('comments.json'));

  assert.equal(normalized.includes('ordinary comment'), false);
  assert.equal(normalized.includes('// #ifdef H5'), true);
});

test('normalizePagesJsonComments rejects block comment directives', () => {
  assert.throws(() => normalizePagesJsonComments(fixture('block-directive.json')), /line comments/u);
});

test('stripConditionalSections removes conditional blocks', () => {
  const stripped = stripConditionalSections(fixture('conditional-sections.json'));

  assert.equal(stripped.includes('pages/index/index'), true);
  assert.equal(stripped.includes('pages/h5/index'), false);
});

test('parseConditionBlocks parses conditional page objects', () => {
  const blocks = parseConditionBlocks(fixture('conditional-page-block.json'));

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.content.path, 'pages/h5/index');
  assert.deepEqual(blocks[0]?.conditions[0]?.env, ['h5']);
});
