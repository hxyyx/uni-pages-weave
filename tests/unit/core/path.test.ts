import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  isPlatformPagePath,
  normalizePagePath,
  pagePathToWorkspaceFile,
} from '../../../packages/core/src/utils/path.js';

test('normalizePagePath removes relative and trailing separators', () => {
  assert.equal(normalizePagePath('./pages\\index\\index/'), 'pages/index/index');
});

test('isPlatformPagePath detects platform workspace pages', () => {
  assert.equal(isPlatformPagePath('platforms/mp-weixin/pages/index/index'), true);
  assert.equal(isPlatformPagePath('pages/platforms/mp-weixin/index'), false);
});

test('pagePathToWorkspaceFile maps page paths into UPW workspace files', () => {
  const root = path.join('tmp', 'upw');

  assert.equal(
    pagePathToWorkspaceFile(root, 'pages/index/index'),
    path.join(root, 'pages', 'index', 'index.upw.json'),
  );
  assert.equal(
    pagePathToWorkspaceFile(root, 'platforms/mp-weixin/pages/index/index'),
    path.join(root, 'platforms', 'mp-weixin', 'pages', 'index', 'index.upw.json'),
  );
});
