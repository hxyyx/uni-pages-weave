import assert from 'node:assert/strict';
import path from 'node:path';

import {
  buildUniPagesJsonFromUpwSource,
  extractUpwSourceFromUniPagesJson,
  initUpw,
} from '../../src/index.js';
import { assertPagesJsonEquivalent, assertThrowsMessage } from '../support/assertions.mjs';
import { assertFileExists, readText, testDir, writeText } from '../support/fs.mjs';
import { readJsonc, writeJson } from '../support/json.mjs';

function writeBasicPagesJson(filePath: string): void {
  writeJson(filePath, {
    pages: [
      {
        path: 'pages/index/index',
        style: { navigationBarTitleText: 'Home' },
      },
      {
        path: 'pages/about/about',
        style: { navigationBarTitleText: 'About' },
      },
    ],
    tabBar: {
      list: [{ pagePath: 'pages/index/index', text: 'Home' }],
    },
  });
}

function writeConditionalPagesJson(filePath: string): void {
  writeText(
    filePath,
    `{
  "pages": [
    {
      "path": "pages/index/index",
      "style": {
        "navigationBarTitleText": "Home"
      }
    },
    // #ifdef H5
    {
      "path": "pages/h5/index",
      "style": {
        "navigationBarTitleText": "H5"
      }
    }
    // #endif
  ],
  // #ifdef MP-WEIXIN
  "usingComponents": {
    "x-card": "/components/card"
  }
  // #endif
}
`,
  );
}

function assertGeneratedUpwFiles(upwDir: string): void {
  assertFileExists(path.join(upwDir, 'app.upw.json'));
  assertFileExists(path.join(upwDir, 'pages', 'index', 'index.upw.json'));
}

console.log('\nVerifying lightweight compiler integration tests');

{
  const dir = testDir('integration-compiler-basic-roundtrip');
  const input = path.join(dir, 'pages.json');
  const upwDir = path.join(dir, 'upw');
  const output = path.join(dir, 'roundtrip-pages.json');

  writeBasicPagesJson(input);

  const result = extractUpwSourceFromUniPagesJson({ input, output: upwDir });

  assertGeneratedUpwFiles(upwDir);
  assert.equal(result.generatedFiles.some((file) => file.kind === 'app'), true);
  assert.equal(result.generatedFiles.some((file) => file.kind === 'page'), true);

  buildUniPagesJsonFromUpwSource({ input: upwDir, output });
  assertPagesJsonEquivalent('basic roundtrip', input, output);
}

{
  const dir = testDir('integration-compiler-conditional-roundtrip');
  const input = path.join(dir, 'pages.json');
  const upwDir = path.join(dir, 'upw');
  const output = path.join(dir, 'roundtrip-pages.json');

  writeConditionalPagesJson(input);
  extractUpwSourceFromUniPagesJson({ input, output: upwDir });
  buildUniPagesJsonFromUpwSource({ input: upwDir, output });

  assert.equal(readText(output).includes('#ifdef H5'), true);
  assert.equal(readText(output).includes('#ifdef MP-WEIXIN'), true);
  assertPagesJsonEquivalent('conditional roundtrip', input, output);
}

{
  const dir = testDir('integration-compiler-upw-to-uni');
  const upwDir = path.join(dir, 'upw');
  const output = path.join(dir, 'pages.json');

  writeJson(path.join(upwDir, 'app.upw.json'), {
    $upw: { homePath: 'pages/index/index' },
  });
  writeJson(path.join(upwDir, 'pages', 'index', 'index.upw.json'), {
    path: 'pages/index/index',
    style: { navigationBarTitleText: 'Home' },
  });

  buildUniPagesJsonFromUpwSource({ input: upwDir, output });

  assert.equal(readJsonc(output).pages[0].path, 'pages/index/index');
}

{
  const dir = testDir('integration-compiler-errors');
  const input = path.join(dir, 'pages.json');
  const upwDir = path.join(dir, 'upw');

  writeJson(input, { pages: [] });

  assertThrowsMessage(
    () => extractUpwSourceFromUniPagesJson({ input, output: upwDir }),
    /must define an unconditional main package home page/u,
    'empty pages.json should fail',
  );

  writeBasicPagesJson(input);
  initUpw({ input, output: upwDir });

  assertThrowsMessage(
    () => initUpw({ input, output: upwDir }),
    /upw files already exist/u,
    'init without force should refuse existing upw files',
  );

  assertThrowsMessage(
    () => {
      const missingAppDir = path.join(dir, 'missing-app-upw');

      writeJson(path.join(missingAppDir, 'pages', 'index', 'index.upw.json'), {
        path: 'pages/index/index',
      });

      buildUniPagesJsonFromUpwSource({ input: missingAppDir, output: input });
    },
    /app\.upw\.json is required/u,
    'missing app.upw.json should fail',
  );
}

console.log('Lightweight compiler integration tests passed.');
