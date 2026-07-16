import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

function sourcePath(...parts: string[]): string {
  return path.join(repoRoot, 'src', 'compiler', ...parts);
}

function assertSourceFileExists(...parts: string[]): void {
  const filePath = sourcePath(...parts);

  assert.equal(fs.existsSync(filePath), true, `${filePath} should exist`);
}

function assertSourceFileRemoved(...parts: string[]): void {
  const filePath = sourcePath(...parts);

  assert.equal(fs.existsSync(filePath), false, `${filePath} should be removed`);
}

test('compiler condition parsing is split behind a session seam', () => {
  assertSourceFileRemoved('load', 'condition-comments.ts');

  [
    'directives.ts',
    'line-index.ts',
    'strip.ts',
    'ast.ts',
    'blocks.ts',
    'patches.ts',
    'session.ts',
  ].forEach((fileName) => {
    assertSourceFileExists('conditions', fileName);
  });
});

test('condition session keeps implementation details in focused modules', () => {
  const session = fs.readFileSync(sourcePath('conditions', 'session.ts'), 'utf8');
  const implementationNames = [
    'function conditionDirectives',
    'function normalizePagesJsonComments',
    'function stripConditionalSectionsWithDirectives',
    'function stripConditionalSectionsForConditions',
    'function pageBlock',
    'function collectConditionalMemberPatches',
    'function parsePagesRoot',
  ];

  for (const name of implementationNames) {
    assert.equal(session.includes(name), false, `${name} should not live in session.ts`);
  }
});

test('upw to uni workspace construction owns grouping and validation modules', () => {
  assertSourceFileRemoved('transform', 'upw-to-uni-workspace.ts');

  [
    'build-render-workspace.ts',
    'collect-project.ts',
    'page-groups.ts',
    'validate-page-source.ts',
  ].forEach((fileName) => {
    assertSourceFileExists('upw-to-uni', fileName);
  });
});

test('pages json generation does not call back into the transform layer', () => {
  assertSourceFileRemoved('generate', 'condition-emitter.ts');
  assertSourceFileRemoved('generate', 'generate-pages-json.ts');
  assertSourceFileRemoved('generate', 'generate-upw-json.ts');
  assertSourceFileExists('generate', 'jsonc-emitter.ts');
  assertSourceFileExists('generate', 'pages-json.ts');
  assertSourceFileExists('generate', 'upw-json.ts');

  const renderer = fs.readFileSync(sourcePath('generate', 'pages-json.ts'), 'utf8');

  assert.equal(renderer.includes('../transform/upw-to-uni-workspace.js'), false);
});

test('compiler output files use sink-oriented names', () => {
  assertSourceFileRemoved('output', 'output-pages-json.ts');
  assertSourceFileRemoved('output', 'output-upw-workspace.ts');
  assertSourceFileRemoved('output', 'watch-pages-json.ts');

  assertSourceFileExists('output', 'pages-json-file.ts');
  assertSourceFileExists('output', 'upw-files.ts');
  assertSourceFileExists('output', 'watch.ts');
});
