# Lightweight Tests Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old monorepo-coupled test tree with a smaller, public-surface-oriented suite that is enough to protect the single `uni-pages-weave` package.

**Architecture:** The new tests form a lightweight pyramid: unit tests cover stable public exports and path resolution, integration tests cover the compiler behavior through `src/index.ts`, and e2e tests cover the real `upw` bin after build. The suite intentionally removes most deep internal tests and large fixture matrices; behavior that matters is represented by a few curated scenarios instead of exhaustive internal snapshots.

**Tech Stack:** Node.js built-in test runner, tsx, pnpm, TypeScript source imports, Node.js fs/path/child_process.

---

## Scope

In scope:
- Delete the old `tests/unit/core` deep-import tests.
- Delete the old bulky `tests/integration/compiler/cases` fixture matrix.
- Delete the old `tests/integration/project-paths/cases` fixture matrix.
- Delete the old `tests/e2e/cli/cases` fixture matrix.
- Replace support helpers with a small helper layer.
- Add a compact test suite around the root public API and built CLI bin.
- Make `pnpm run test`, `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run test:e2e`, and `pnpm run verify:full` pass.

Out of scope:
- Changing product behavior.
- Updating README or guide docs.
- Adding compatibility for `@uni-pages-weave/core` or `@uni-pages-weave/cli`.
- Recreating every old fixture as a new test.
- Testing every internal compiler phase directly.

## Current Problems To Remove

- Unit tests import old internal paths such as `packages/core/src/pages-config/...`.
- Integration tests import old dist paths such as `packages/core/dist/index.js`.
- E2E tests execute old CLI output at `packages/cli/dist/index.js`.
- Support helpers import dependency internals through `packages/core/node_modules/jsonc-parser`.
- The test tree is larger than the source tree: about 183 test files and fixtures for about 41 source files.
- Many tests protect implementation structure rather than user-visible behavior.

## New Test Shape

```text
tests/
  unit/
    public-api.test.ts
    paths.test.ts
  integration/
    compiler.test.ts
    test.mjs
  e2e/
    cli.test.mjs
  support/
    assertions.mjs
    fs.mjs
    json.mjs
```

## Coverage Contract

The new lightweight suite must protect these behaviors:

- Public API:
  - `extractUpwSourceFromUniPagesJson`
  - `initUpw`
  - `buildUniPagesJsonFromUpwSource`
  - `watchUniPagesJsonFromUpwSource`
  - `renderUpwToUniPagesJson`
  - `resolveProjectPaths`
  - `resolveUpwProjectPaths`
- Project layout detection:
  - CLI layout uses `src/pages.json`.
  - HBuilderX layout uses root `pages.json`.
  - UPW source layout is found from `src/app.upw.json` or root `app.upw.json`.
- Compiler happy paths:
  - `pages.json` to UPW source.
  - UPW source back to `pages.json`.
  - Round-trip preserves page set, home page, app config, and subpackage membership.
  - One conditional compilation scenario survives round-trip at a high level.
- Compiler error paths:
  - Empty or conditional-only `pages` cannot initialize UPW.
  - Missing `app.upw.json` cannot build `pages.json`.
  - `initUpw` refuses existing UPW files without `force`.
- CLI:
  - `upw --version` returns package version.
  - `upw --help` lists `init`, `build`, and `watch`.
  - `upw init` creates `app.upw.json` and page UPW files.
  - `upw build` recreates `pages.json` from UPW files.

## Deletion Policy

Delete these paths entirely:

```text
tests/unit/core/
tests/integration/compiler/cases/
tests/integration/project-paths/
tests/e2e/cli/
```

Delete these old support files after their replacements exist:

```text
tests/support/cases.mjs
tests/support/files.mjs
tests/support/jsonc.mjs
tests/support/pages-json.mjs
```

Keep:

```text
tests/clear.mjs
tests/integration/test.mjs
tests/e2e/test.mjs
```

Then rewrite `tests/integration/test.mjs` and `tests/e2e/test.mjs` as small aggregators.

---

### Task 1: Replace Test Support Helpers

**Files:**
- Delete: `tests/support/cases.mjs`
- Delete: `tests/support/files.mjs`
- Delete: `tests/support/jsonc.mjs`
- Delete: `tests/support/pages-json.mjs`
- Create: `tests/support/fs.mjs`
- Create: `tests/support/json.mjs`
- Create: `tests/support/assertions.mjs`

- [ ] **Step 1: Delete the old support helpers**

Run:

```powershell
git rm tests/support/cases.mjs tests/support/files.mjs tests/support/jsonc.mjs tests/support/pages-json.mjs
```

Expected:
- All four old helper files are staged for deletion.

- [ ] **Step 2: Create `tests/support/fs.mjs`**

Create `tests/support/fs.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const testTmpRoot = path.join(repoRoot, 'tmp', 'tests');

export function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

export function testDir(name) {
  const dir = path.join(testTmpRoot, name);

  cleanDir(dir);

  return dir;
}

export function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, 'utf8');
}

export function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

export function assertFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Expected file to exist: ${filePath}`);
  }
}
```

- [ ] **Step 3: Create `tests/support/json.mjs`**

Create `tests/support/json.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { parse, printParseErrorCode } from 'jsonc-parser';

export function readJsonc(filePath) {
  const errors = [];
  const text = fs.readFileSync(filePath, 'utf8');
  const value = parse(text, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  if (errors.length > 0) {
    const message = errors
      .map((error) => `${printParseErrorCode(error.error)} at ${error.offset}`)
      .join(', ');

    throw new Error(`Failed to parse ${filePath}: ${message}`);
  }

  return value;
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
```

- [ ] **Step 4: Create `tests/support/assertions.mjs`**

Create `tests/support/assertions.mjs`:

```js
import assert from 'node:assert/strict';

import { readJsonc } from './json.mjs';

function stable(value) {
  if (Array.isArray(value)) {
    return value.map(stable);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  }

  return value;
}

function subpackages(data) {
  if (Array.isArray(data.subPackages)) {
    return data.subPackages;
  }

  return Array.isArray(data.subpackages) ? data.subpackages : [];
}

function flattenPages(data) {
  return [
    ...(data.pages ?? []).map((page) => [`main:${page.path}`, stable(page)]),
    ...subpackages(data).flatMap((subpackage) =>
      (subpackage.pages ?? []).map((page) => [
        `sub:${subpackage.root}/${page.path}`,
        stable(page),
      ]),
    ),
  ];
}

function appConfig(data) {
  const output = { ...data };

  delete output.pages;
  delete output.subPackages;
  delete output.subpackages;

  return stable(output);
}

export function assertPagesJsonEquivalent(label, expectedFile, actualFile) {
  const expected = readJsonc(expectedFile);
  const actual = readJsonc(actualFile);

  assert.equal(actual.pages?.[0]?.path, expected.pages?.[0]?.path, `${label}: home page changed.`);
  assert.deepEqual(
    new Map(flattenPages(actual)),
    new Map(flattenPages(expected)),
    `${label}: page set or page config changed.`,
  );
  assert.deepEqual(appConfig(actual), appConfig(expected), `${label}: app config changed.`);
}

export function assertThrowsMessage(fn, pattern, label) {
  try {
    fn();
  } catch (error) {
    assert.match(error instanceof Error ? error.message : String(error), pattern, label);
    return;
  }

  throw new Error(`${label}: expected function to throw.`);
}
```

- [ ] **Step 5: Commit support helper replacement**

Run:

```powershell
git add tests/support
git commit -m "test: replace support helpers for single package"
```

Expected:
- Commit succeeds.

---

### Task 2: Replace Unit Tests With Public-Surface Tests

**Files:**
- Delete: `tests/unit/core/`
- Create: `tests/unit/public-api.test.ts`
- Create: `tests/unit/paths.test.ts`

- [ ] **Step 1: Delete old core unit tests**

Run:

```powershell
git rm -r tests/unit/core
$target = Resolve-Path -LiteralPath tests/unit/core -ErrorAction SilentlyContinue
if ($target) {
  if (-not $target.Path.StartsWith((Resolve-Path -LiteralPath .).Path, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove outside workspace: $($target.Path)"
  }
  Remove-Item -LiteralPath $target.Path -Recurse -Force
}
```

Expected:
- Old tracked deep-import unit tests and their case fixtures are staged for deletion.
- Any untracked files left under `tests/unit/core` are removed.

- [ ] **Step 2: Create `tests/unit/public-api.test.ts`**

Create `tests/unit/public-api.test.ts`:

```ts
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
```

- [ ] **Step 3: Create `tests/unit/paths.test.ts`**

Create `tests/unit/paths.test.ts`:

```ts
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { resolveProjectPaths, resolveUpwProjectPaths } from '../../src/index.js';
import { testDir as createTestDir } from '../support/fs.mjs';
import { writeJson } from '../support/json.mjs';

test('resolveProjectPaths detects cli src/pages.json layout', () => {
  const projectDir = createTestDir('unit-paths-cli');

  writeJson(path.join(projectDir, 'src', 'pages.json'), {
    pages: [{ path: 'pages/index/index' }],
  });

  assert.deepEqual(resolveProjectPaths(projectDir), {
    projectDir,
    layout: 'src',
    pagesJsonPath: path.join(projectDir, 'src', 'pages.json'),
    upwSourceDir: path.join(projectDir, 'src'),
  });
});

test('resolveProjectPaths detects hbuilderx root pages.json layout', () => {
  const projectDir = createTestDir('unit-paths-root');

  writeJson(path.join(projectDir, 'pages.json'), {
    pages: [{ path: 'pages/index/index' }],
  });

  assert.deepEqual(resolveProjectPaths(projectDir), {
    projectDir,
    layout: 'root',
    pagesJsonPath: path.join(projectDir, 'pages.json'),
    upwSourceDir: projectDir,
  });
});

test('resolveUpwProjectPaths detects src app.upw.json layout', () => {
  const projectDir = createTestDir('unit-paths-upw-src');

  writeJson(path.join(projectDir, 'src', 'app.upw.json'), {
    $upw: { homePath: 'pages/index/index' },
  });

  assert.deepEqual(resolveUpwProjectPaths(projectDir), {
    projectDir,
    layout: 'src',
    pagesJsonPath: path.join(projectDir, 'src', 'pages.json'),
    upwSourceDir: path.join(projectDir, 'src'),
  });
});
```

- [ ] **Step 4: Run unit tests**

Run:

```powershell
pnpm run test:unit
```

Expected:
- Unit tests pass.
- No output mentions `packages/core`.

- [ ] **Step 5: Commit unit test replacement**

Run:

```powershell
git add tests/unit
git commit -m "test: replace deep unit tests with public API checks"
```

Expected:
- Commit succeeds.

---

### Task 3: Replace Compiler Integration Tests With Curated Scenarios

**Files:**
- Delete: `tests/integration/compiler/`
- Create: `tests/integration/compiler.test.ts`

- [ ] **Step 1: Delete old compiler integration directory**

Run:

```powershell
git rm -r tests/integration/compiler
$target = Resolve-Path -LiteralPath tests/integration/compiler -ErrorAction SilentlyContinue
if ($target) {
  if (-not $target.Path.StartsWith((Resolve-Path -LiteralPath .).Path, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove outside workspace: $($target.Path)"
  }
  Remove-Item -LiteralPath $target.Path -Recurse -Force
}
```

Expected:
- Old tracked compiler runner and fixture matrix are staged for deletion.
- Any untracked files left under `tests/integration/compiler` are removed.

- [ ] **Step 2: Create `tests/integration/compiler.test.ts`**

Create `tests/integration/compiler.test.ts`:

```ts
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

function writeBasicPagesJson(filePath) {
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

function writeConditionalPagesJson(filePath) {
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

function assertGeneratedUpwFiles(upwDir) {
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
    pages: [],
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
    () => buildUniPagesJsonFromUpwSource({ input: path.join(dir, 'missing-upw'), output: input }),
    /No app\.upw\.json found/u,
    'missing app.upw.json should fail',
  );
}

console.log('Lightweight compiler integration tests passed.');
```

- [ ] **Step 3: Run compiler integration test**

Run:

```powershell
pnpm exec tsx ./tests/integration/compiler.test.ts
```

Expected:
- Command passes.
- Output includes `Lightweight compiler integration tests passed.`

- [ ] **Step 4: Commit compiler integration replacement**

Run:

```powershell
git add tests/integration
git commit -m "test: replace compiler matrix with lightweight integration scenarios"
```

Expected:
- Commit succeeds.

---

### Task 4: Replace Project Path Integration Matrix

**Files:**
- Delete: `tests/integration/project-paths/`
- Modify: `tests/integration/test.mjs`

- [ ] **Step 1: Delete old project path integration matrix**

Run:

```powershell
git rm -r tests/integration/project-paths
$target = Resolve-Path -LiteralPath tests/integration/project-paths -ErrorAction SilentlyContinue
if ($target) {
  if (-not $target.Path.StartsWith((Resolve-Path -LiteralPath .).Path, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove outside workspace: $($target.Path)"
  }
  Remove-Item -LiteralPath $target.Path -Recurse -Force
}
```

Expected:
- Old tracked project-path fixture matrix is staged for deletion.
- Any untracked files left under `tests/integration/project-paths` are removed.

- [ ] **Step 2: Replace integration aggregator**

Replace `tests/integration/test.mjs` with:

```js
import { spawnSync } from 'node:child_process';

const result = spawnSync('pnpm', ['exec', 'tsx', './tests/integration/compiler.test.ts'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
```

- [ ] **Step 3: Run integration tests**

Run:

```powershell
pnpm run test:integration
```

Expected:
- Integration tests pass.

- [ ] **Step 4: Commit integration aggregator cleanup**

Run:

```powershell
git add tests/integration
git commit -m "test: simplify integration test entrypoint"
```

Expected:
- Commit succeeds.

---

### Task 5: Replace CLI E2E Tests

**Files:**
- Delete: `tests/e2e/cli/`
- Modify: `tests/e2e/test.mjs`
- Create: `tests/e2e/cli.test.mjs`

- [ ] **Step 1: Delete old CLI E2E matrix**

Run:

```powershell
git rm -r tests/e2e/cli
$target = Resolve-Path -LiteralPath tests/e2e/cli -ErrorAction SilentlyContinue
if ($target) {
  if (-not $target.Path.StartsWith((Resolve-Path -LiteralPath .).Path, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove outside workspace: $($target.Path)"
  }
  Remove-Item -LiteralPath $target.Path -Recurse -Force
}
```

Expected:
- Old tracked CLI fixture matrix is staged for deletion.
- Any untracked files left under `tests/e2e/cli` are removed.

- [ ] **Step 2: Create `tests/e2e/cli.test.mjs`**

Create `tests/e2e/cli.test.mjs`:

```js
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { assertFileExists, readText, repoRoot, testDir } from '../support/fs.mjs';
import { assertPagesJsonEquivalent } from '../support/assertions.mjs';
import { writeJson } from '../support/json.mjs';

const cliBin = path.join(repoRoot, 'bin', 'index.js');

function runCli(projectDir, ...args) {
  return execFileSync(process.execPath, [cliBin, ...args], {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

console.log('\nVerifying lightweight CLI E2E tests');

{
  const dir = testDir('e2e-cli-shape');
  const version = runCli(dir, '--version').trim();
  const help = runCli(dir, '--help');

  assert.match(version, /^\d+\.\d+\.\d+$/u);
  assert.equal(help.includes('init'), true);
  assert.equal(help.includes('build'), true);
  assert.equal(help.includes('watch'), true);
}

{
  const dir = testDir('e2e-cli-init-build');
  const pagesJson = path.join(dir, 'src', 'pages.json');

  writeJson(pagesJson, {
    pages: [
      {
        path: 'pages/index/index',
        style: { navigationBarTitleText: 'Home' },
      },
    ],
  });

  const initOutput = runCli(dir, 'init');

  assert.equal(initOutput.includes('app'), true);
  assert.equal(initOutput.includes('page'), true);
  assertFileExists(path.join(dir, 'src', 'app.upw.json'));
  assertFileExists(path.join(dir, 'src', 'pages', 'index', 'index.upw.json'));

  const original = path.join(dir, 'original-pages.json');

  writeJson(original, {
    pages: [
      {
        path: 'pages/index/index',
        style: { navigationBarTitleText: 'Home' },
      },
    ],
  });

  runCli(dir, 'build');

  assert.equal(readText(pagesJson).includes('pages/index/index'), true);
  assertPagesJsonEquivalent('cli init/build', original, pagesJson);
}

console.log('Lightweight CLI E2E tests passed.');
```

- [ ] **Step 3: Replace E2E aggregator**

Replace `tests/e2e/test.mjs` with:

```js
import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['./tests/e2e/cli.test.mjs'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
```

- [ ] **Step 4: Build before running E2E**

Run:

```powershell
pnpm run build
pnpm run test:e2e
```

Expected:
- Build passes.
- E2E passes.
- Output includes `Lightweight CLI E2E tests passed.`

- [ ] **Step 5: Commit CLI E2E replacement**

Run:

```powershell
git add tests/e2e
git commit -m "test: replace cli matrix with lightweight e2e coverage"
```

Expected:
- Commit succeeds.

---

### Task 6: Update Test Scripts And Verify Full Gate

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Keep existing script names and make no package script changes**

Inspect `package.json`.

Expected scripts remain:

```json
{
  "test": "pnpm run test:unit && pnpm run test:integration && pnpm run test:e2e",
  "test:unit": "tsx --test \"tests/unit/**/*.test.ts\"",
  "test:integration": "node ./tests/integration/test.mjs",
  "test:e2e": "node ./tests/e2e/test.mjs",
  "verify:full": "pnpm run verify && pnpm run test"
}
```

If the scripts already match, do not edit `package.json`.

- [ ] **Step 2: Run old-path scan**

Run:

```powershell
rg -n "packages/core|packages/cli|@uni-pages-weave/(core|cli)|packages/core/node_modules" tests package.json
```

Expected:
- No output.

- [ ] **Step 3: Run unit tests**

Run:

```powershell
pnpm run test:unit
```

Expected:
- Unit tests pass.

- [ ] **Step 4: Run integration tests**

Run:

```powershell
pnpm run test:integration
```

Expected:
- Integration tests pass.

- [ ] **Step 5: Run e2e tests**

Run:

```powershell
pnpm run build
pnpm run test:e2e
```

Expected:
- Build passes.
- E2E tests pass.

- [ ] **Step 6: Run full verification**

Run:

```powershell
pnpm run verify:full
```

Expected:
- `pnpm run verify` passes.
- `pnpm run test` passes.
- `verify:full` exits with code 0.

- [ ] **Step 7: Commit final test gate cleanup if package scripts changed**

If `package.json` changed, run:

```powershell
git add package.json
git commit -m "test: keep full verification on lightweight suite"
```

Expected:
- Commit succeeds only if `package.json` changed.
- If `package.json` did not change, skip this commit.

---

### Task 7: Final Status Check

**Files:**
- No source files should change in this task.

- [ ] **Step 1: Inspect test tree size**

Run:

```powershell
@'
const fs = require('fs');
const path = require('path');
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}
for (const dir of ['tests/unit', 'tests/integration', 'tests/e2e', 'tests/support']) {
  const files = walk(dir);
  console.log(`${dir}: ${files.length} files`);
}
'@ | node
```

Expected:
- `tests/unit` has a small number of files.
- `tests/integration` has no large `cases` matrix.
- `tests/e2e` has no `cli/cases` matrix.

- [ ] **Step 2: Inspect git status**

Run:

```powershell
git status --short
```

Expected:
- Only unrelated pre-existing README/docs/test changes remain, or the tree is clean.
- No implementation files under `src/` changed.

- [ ] **Step 3: Inspect recent commits**

Run:

```powershell
git log --oneline -8
```

Expected:
- Recent commits include:
  - `test: replace support helpers for single package`
  - `test: replace deep unit tests with public API checks`
  - `test: replace compiler matrix with lightweight integration scenarios`
  - `test: simplify integration test entrypoint`
  - `test: replace cli matrix with lightweight e2e coverage`
  - Optional `test: keep full verification on lightweight suite`

- [ ] **Step 4: Report outcome**

Report:
- New test tree shape.
- Deleted old heavy paths.
- `pnpm run verify:full` result.
- Any residual risk from intentionally reduced coverage.

## Self-Review

Spec coverage:
- Lightweight option A is implemented by deleting deep unit tests and large fixture matrices.
- Public-surface orientation is implemented by importing from `../../src/index.js` and `../../../src/index.js`.
- The CLI still uses the real built bin through `bin/index.js`.
- Full verification is restored by Task 6.

Placeholder scan:
- No placeholder text is present.
- The plan names exact files, commands, expected outputs, and commit messages.

Type and path consistency:
- Public API imports use `src/index.js`.
- Support helper imports use `tests/support/*.mjs`.
- Old package paths are removed and scanned.

Residual risk:
- This intentionally reduces edge-case fixture coverage.
- Complex conditional comment equivalence is reduced to one high-level scenario.
- Future bug fixes should add one focused integration scenario instead of rebuilding the old matrix.
