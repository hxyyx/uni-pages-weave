# Single Package Packaging Scripts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert build, package validation, dry-run packing, and release scripts from the old monorepo package model to the new single `uni-pages-weave` package model.

**Architecture:** The root manifest owns all package metadata, public exports, bin registration, and lifecycle scripts. `tsup.config.ts` remains the build boundary for the library and CLI entry points, while `scripts/check-package.mjs` becomes the local package-artifact guard and `scripts/release.mjs` becomes a root-package-only release workflow. Tests remain wired but are not made part of the default phase-two packaging verification until the test tree is migrated.

**Tech Stack:** TypeScript, Node.js ESM, tsup, pnpm, npm registry CLI, @inquirer/prompts, fs-extra.

---

## Scope

In scope:
- Update root `package.json` scripts for a single publishable package.
- Replace monorepo version-sync checks with package artifact checks.
- Rewrite release automation to publish only `uni-pages-weave`.
- Keep `upw` registered through `bin/index.js`.
- Add explicit dry-run pack and CLI smoke commands.
- Keep existing `test:*` commands present for the next migration phase.

Out of scope:
- Updating tests to new `src` imports.
- Updating README or guide text from `@uni-pages-weave/cli` to `uni-pages-weave`.
- Adding compatibility packages or legacy import paths.
- Changing the source layout under `src`.
- Changing npm registry credentials or token policy.

## File Responsibilities

- `package.json`
  - Owns single package metadata, `exports`, `bin`, package files, lifecycle scripts, verification scripts, and release command names.
- `scripts/check-package.mjs`
  - Verifies the root manifest is internally consistent after `pnpm run build`.
  - Checks entry files from `main`, `module`, `types`, `exports`, and `bin`.
  - Checks package files include `bin`, `dist`, and `README.md`.
  - Checks the repo no longer exposes workspace packages under `packages/*/package.json`.
  - Checks `pnpm-workspace.yaml` is only a pnpm settings file and does not declare package globs.
- `scripts/release.mjs`
  - Runs release preflight checks.
  - Prompts for semver bump.
  - Checks npm auth and unpublished target version.
  - Updates the root package version.
  - Builds and validates release artifacts.
  - Runs `pnpm publish` for the root package only.
  - Merges release notes into `CHANGELOG.md`.
- `scripts/check-version-sync.mjs`
  - Removed because there are no package versions to synchronize.
- `eslint.config.js`
  - Includes `src/**/*.{js,mjs,ts}` and `scripts/**/*.mjs` as lint targets.
  - Removes the old `packages/*/src/**/*.{js,mjs,ts}` lint target.

## Target Package Scripts

`package.json` should expose these scripts after the change:

```json
{
  "scripts": {
    "build": "tsup",
    "verify": "pnpm run build && pnpm run lint && pnpm run package:check && pnpm run smoke:cli && pnpm run pack:dry",
    "verify:full": "pnpm run verify && pnpm run test",
    "test": "pnpm run test:unit && pnpm run test:integration && pnpm run test:e2e",
    "test:unit": "tsx --test \"tests/unit/**/*.test.ts\"",
    "test:integration": "node ./tests/integration/test.mjs",
    "test:e2e": "node ./tests/e2e/test.mjs",
    "test:clear": "node ./tests/clear.mjs",
    "lint": "eslint src scripts",
    "format": "prettier \"src/**/*.{js,mjs,cjs,ts,tsx,json,md}\" \"scripts/**/*.mjs\" --write",
    "format:check": "prettier \"src/**/*.{js,mjs,cjs,ts,tsx,json,md}\" \"scripts/**/*.mjs\" --check",
    "package:check": "node ./scripts/check-package.mjs",
    "pack:dry": "pnpm pack --dry-run",
    "smoke:cli": "node ./bin/index.js --version && node ./bin/index.js --help",
    "prepack": "pnpm run build && pnpm run package:check",
    "release": "node ./scripts/release.mjs"
  }
}
```

Rationale:
- `verify` is the phase-two package verification gate and intentionally avoids the existing tests because their imports still target the old package paths.
- `verify:full` preserves the full gate name for the next phase once tests are migrated.
- `package:check` replaces `version:check`.
- `prepack` catches accidental local packing without a build.
- `lint` and `format:check` include `scripts` because release/package scripts now carry meaningful package behavior.

---

### Task 1: Update Package Scripts

**Files:**
- Modify: `package.json`
- Modify: `eslint.config.js`

- [ ] **Step 1: Replace only the `scripts` block**

In `package.json`, replace the current `scripts` object with this exact object:

```json
{
  "build": "tsup",
  "verify": "pnpm run build && pnpm run lint && pnpm run package:check && pnpm run smoke:cli && pnpm run pack:dry",
  "verify:full": "pnpm run verify && pnpm run test",
  "test": "pnpm run test:unit && pnpm run test:integration && pnpm run test:e2e",
  "test:unit": "tsx --test \"tests/unit/**/*.test.ts\"",
  "test:integration": "node ./tests/integration/test.mjs",
  "test:e2e": "node ./tests/e2e/test.mjs",
  "test:clear": "node ./tests/clear.mjs",
  "lint": "eslint src scripts",
  "format": "prettier \"src/**/*.{js,mjs,cjs,ts,tsx,json,md}\" \"scripts/**/*.mjs\" --write",
  "format:check": "prettier \"src/**/*.{js,mjs,cjs,ts,tsx,json,md}\" \"scripts/**/*.mjs\" --check",
  "package:check": "node ./scripts/check-package.mjs",
  "pack:dry": "pnpm pack --dry-run",
  "smoke:cli": "node ./bin/index.js --version && node ./bin/index.js --help",
  "prepack": "pnpm run build && pnpm run package:check",
  "release": "node ./scripts/release.mjs"
}
```

- [ ] **Step 2: Run the scripts listing command**

In `eslint.config.js`, replace:

```js
const sourceFiles = ['packages/*/src/**/*.{js,mjs,ts}', 'src/**/*.{js,mjs,ts}'];
```

with:

```js
const sourceFiles = ['src/**/*.{js,mjs,ts}', 'scripts/**/*.mjs'];
```

- [ ] **Step 3: Run the scripts listing command**

Run:

```powershell
pnpm run
```

Expected:
- Output includes `package:check`, `pack:dry`, `smoke:cli`, `prepack`, `verify`, and `verify:full`.
- Output does not include `version:check`.

- [ ] **Step 4: Commit package script and lint target changes**

Run:

```powershell
git add package.json eslint.config.js
git commit -m "chore: update package scripts for single package"
```

Expected:
- Commit succeeds.

---

### Task 2: Replace Version Sync Script With Package Artifact Check

**Files:**
- Delete: `scripts/check-version-sync.mjs`
- Create: `scripts/check-package.mjs`

- [ ] **Step 1: Delete the obsolete version sync script**

Run:

```powershell
git rm scripts/check-version-sync.mjs
```

Expected:
- `scripts/check-version-sync.mjs` is staged for deletion.

- [ ] **Step 2: Create the package check script**

Create `scripts/check-package.mjs` with this content:

```js
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ROOT_MANIFEST = path.resolve(ROOT, 'package.json');
const PACKAGE_NAME = 'uni-pages-weave';
const REQUIRED_FILES = ['bin', 'dist', 'README.md'];
const EXPECTED_BIN = './bin/index.js';
const EXPECTED_REGISTRY = 'https://registry.npmjs.org/';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fail(messages) {
  console.error('Package check failed.');

  for (const message of messages) {
    console.error(`- ${message}`);
  }

  process.exit(1);
}

function assert(condition, message, messages) {
  if (!condition) {
    messages.push(message);
  }
}

function collectExportPaths(value) {
  if (typeof value === 'string') {
    return [value];
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.values(value).flatMap((item) => collectExportPaths(item));
}

function collectBinPaths(value) {
  if (typeof value === 'string') {
    return [value];
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.values(value).filter((item) => typeof item === 'string');
}

function packageEntryPaths(manifest) {
  return Array.from(
    new Set(
      [
        manifest.main,
        manifest.module,
        manifest.types,
        ...collectExportPaths(manifest.exports),
        ...collectBinPaths(manifest.bin),
      ].filter((entry) => typeof entry === 'string' && entry.startsWith('./')),
    ),
  );
}

function assertManifestShape(manifest, messages) {
  assert(manifest.name === PACKAGE_NAME, `package name must be ${PACKAGE_NAME}`, messages);
  assert(manifest.private !== true, 'package must be publishable', messages);
  assert(manifest.type === 'module', 'package type must be module', messages);
  assert(manifest.bin?.upw === EXPECTED_BIN, `bin.upw must be ${EXPECTED_BIN}`, messages);
  assert(manifest.main === './dist/index.cjs', 'main must be ./dist/index.cjs', messages);
  assert(manifest.module === './dist/index.js', 'module must be ./dist/index.js', messages);
  assert(manifest.types === './dist/index.d.ts', 'types must be ./dist/index.d.ts', messages);
  assert(
    manifest.publishConfig?.registry === EXPECTED_REGISTRY,
    `publishConfig.registry must be ${EXPECTED_REGISTRY}`,
    messages,
  );
  assert(manifest.publishConfig?.access === 'public', 'publishConfig.access must be public', messages);

  for (const file of REQUIRED_FILES) {
    assert(
      Array.isArray(manifest.files) && manifest.files.includes(file),
      `files must include ${file}`,
      messages,
    );
  }
}

function assertEntryFiles(manifest, messages) {
  for (const entryPath of packageEntryPaths(manifest)) {
    const filePath = path.resolve(ROOT, entryPath);
    assert(fs.existsSync(filePath), `${entryPath} must exist`, messages);
  }
}

function assertNoWorkspacePackages(messages) {
  const packagesDir = path.resolve(ROOT, 'packages');

  if (!fs.existsSync(packagesDir)) {
    return;
  }

  const packageManifests = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(packagesDir, entry.name, 'package.json'))
    .filter((filePath) => fs.existsSync(filePath));

  for (const filePath of packageManifests) {
    messages.push(`workspace package manifest must not exist: ${path.relative(ROOT, filePath)}`);
  }
}

function assertPnpmWorkspaceSettingsOnly(messages) {
  const workspaceFile = path.resolve(ROOT, 'pnpm-workspace.yaml');

  if (!fs.existsSync(workspaceFile)) {
    return;
  }

  const content = fs.readFileSync(workspaceFile, 'utf8');
  assert(!/^packages\s*:/m.test(content), 'pnpm-workspace.yaml must not declare package globs', messages);
}

const manifest = readJson(ROOT_MANIFEST);
const messages = [];

assertManifestShape(manifest, messages);
assertEntryFiles(manifest, messages);
assertNoWorkspacePackages(messages);
assertPnpmWorkspaceSettingsOnly(messages);

if (messages.length > 0) {
  fail(messages);
}

console.log(`${manifest.name}@${manifest.version} package metadata and entry files are valid.`);
```

- [ ] **Step 3: Run the check before building to confirm it protects artifacts**

Run:

```powershell
if (Test-Path dist) { Remove-Item -Recurse -Force dist }
pnpm run package:check
```

Expected:
- Command fails.
- Output includes missing `./dist/index.js`, `./dist/index.cjs`, or `./dist/index.d.ts`.

- [ ] **Step 4: Build and rerun the package check**

Run:

```powershell
pnpm run build
pnpm run package:check
```

Expected:
- `pnpm run build` succeeds.
- `pnpm run package:check` prints `uni-pages-weave@0.1.3 package metadata and entry files are valid.`

- [ ] **Step 5: Commit package check script**

Run:

```powershell
git add scripts/check-package.mjs scripts/check-version-sync.mjs
git commit -m "chore: add single package artifact check"
```

Expected:
- Commit succeeds.

---

### Task 3: Rewrite Release Script For Root Package Publishing

**Files:**
- Modify: `scripts/release.mjs`

- [ ] **Step 1: Replace the release script**

Replace the full contents of `scripts/release.mjs` with:

```js
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { input, select } from '@inquirer/prompts';
import fs from 'fs-extra';

const NPM_REGISTRY = 'https://registry.npmjs.org/';
const PACKAGE_NAME = 'uni-pages-weave';
const ROOT_MANIFEST = path.resolve('package.json');
const CHANGELOG = path.resolve('CHANGELOG.md');
const STABLE_SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 1}.`);
  }
}

function assertRootPackageConfig(manifest) {
  const errors = [];

  if (manifest.name !== PACKAGE_NAME) {
    errors.push(`package name must be ${PACKAGE_NAME}`);
  }

  if (manifest.private === true) {
    errors.push('package must be publishable');
  }

  if (manifest.bin?.upw !== './bin/index.js') {
    errors.push('bin.upw must be ./bin/index.js');
  }

  if (manifest.publishConfig?.registry !== NPM_REGISTRY) {
    errors.push(`publishConfig.registry must be ${NPM_REGISTRY}`);
  }

  if (manifest.publishConfig?.access !== 'public') {
    errors.push('publishConfig.access must be public');
  }

  if (errors.length === 0) {
    return;
  }

  console.error('Root package configuration is invalid.');

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  throw new Error('Root package configuration is invalid.');
}

function assertNpmAuth() {
  const result = spawnSync('npm', ['whoami', '--registry', NPM_REGISTRY], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status === 0) {
    console.log(`npm authenticated as ${result.stdout.trim()}.`);
    return;
  }

  console.error('No npm authentication found for the npm registry.');
  console.error('Configure npm auth with a token that can publish this package.');
  throw new Error('npm authentication is required before release.');
}

function bumpVersion(version, bump) {
  const match = version.match(STABLE_SEMVER);

  if (!match) {
    throw new Error(`Only stable SemVer versions are supported. Found: ${version}`);
  }

  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  const patch = Number.parseInt(match[3], 10);

  if (bump === 'major') {
    return `${major + 1}.0.0`;
  }

  if (bump === 'minor') {
    return `${major}.${minor + 1}.0`;
  }

  return `${major}.${minor}.${patch + 1}`;
}

function packageVersionExists(packageName, version) {
  const result = spawnSync(
    'npm',
    ['view', `${packageName}@${version}`, 'version', '--registry', NPM_REGISTRY, '--json'],
    {
      encoding: 'utf8',
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  if (result.status === 0) {
    return true;
  }

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

  if (output.includes('E404') || output.includes('404')) {
    return false;
  }

  console.error(`Could not check ${packageName}@${version} on npm registry.`);
  console.error(output.trim());
  throw new Error(`Could not check ${packageName}@${version} on npm registry.`);
}

function assertVersionIsUnpublished(packageName, version) {
  if (!packageVersionExists(packageName, version)) {
    return;
  }

  throw new Error(`${packageName}@${version} already exists on npm.`);
}

function snapshotManifest() {
  return fs.readFileSync(ROOT_MANIFEST, 'utf8');
}

function restoreManifest(snapshot) {
  fs.writeFileSync(ROOT_MANIFEST, snapshot);
}

function releaseNotePath(version) {
  return path.resolve(`release-notes-${version}.md`);
}

function createReleaseNote(version) {
  const filePath = releaseNotePath(version);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(
      filePath,
      `<!-- Fill in release notes for ${version}. Leave empty for no important changes. -->\n`,
    );
  }

  return filePath;
}

function readReleaseNoteBody(filePath) {
  if (!fs.existsSync(filePath)) {
    return '';
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

function updateChangelog(version, releaseNotes) {
  if (!releaseNotes) {
    return;
  }

  const entry = `## ${version}\n\n${releaseNotes}\n`;

  if (!fs.existsSync(CHANGELOG)) {
    fs.writeFileSync(CHANGELOG, `# Changelog\n\n${entry}`);
    return;
  }

  const current = fs.readFileSync(CHANGELOG, 'utf8').trimEnd();

  if (!current.startsWith('# Changelog')) {
    fs.writeFileSync(CHANGELOG, `# Changelog\n\n${entry}\n${current}\n`);
    return;
  }

  const firstLineBreak = current.indexOf('\n');

  if (firstLineBreak === -1) {
    fs.writeFileSync(CHANGELOG, `# Changelog\n\n${entry}`);
    return;
  }

  const header = current.slice(0, firstLineBreak).trimEnd();
  const rest = current.slice(firstLineBreak).trim();
  const next = rest ? `${header}\n\n${entry}\n${rest}\n` : `${header}\n\n${entry}`;

  fs.writeFileSync(CHANGELOG, next);
}

function publishRootPackage() {
  run('pnpm', [
    'publish',
    '--access',
    'public',
    '--registry',
    NPM_REGISTRY,
    '--no-git-checks',
  ]);
}

async function main() {
  const manifest = readJson(ROOT_MANIFEST);

  assertRootPackageConfig(manifest);

  console.log('Running release preflight checks...');
  run('pnpm', ['run', 'format:check']);
  run('pnpm', ['run', 'verify']);

  const bump = await select({
    message: `Select release type from ${manifest.version}`,
    choices: [
      { name: 'patch', value: 'patch', description: 'Bug fixes and small changes' },
      { name: 'minor', value: 'minor', description: 'Backward-compatible features' },
      { name: 'major', value: 'major', description: 'Breaking changes' },
    ],
  });
  const nextVersion = bumpVersion(manifest.version, bump);

  assertNpmAuth();
  assertVersionIsUnpublished(PACKAGE_NAME, nextVersion);

  const manifestSnapshot = snapshotManifest();
  let publishStarted = false;

  try {
    console.log(`Preparing release ${PACKAGE_NAME}@${nextVersion}.`);
    manifest.version = nextVersion;
    writeJson(ROOT_MANIFEST, manifest);

    const notePath = createReleaseNote(nextVersion);
    console.log(`Release notes file: ${path.relative(process.cwd(), notePath)}`);
    await input({
      message: 'Edit the release notes file, then press Enter to continue.',
    });

    run('pnpm', ['run', 'build']);
    run('pnpm', ['run', 'package:check']);
    run('pnpm', ['run', 'smoke:cli']);
    run('pnpm', ['run', 'pack:dry']);

    publishStarted = true;
    publishRootPackage();

    const releaseNotes = readReleaseNoteBody(notePath);
    updateChangelog(nextVersion, releaseNotes);
    fs.removeSync(notePath);

    if (releaseNotes) {
      console.log(`Merged release notes into CHANGELOG.md for ${nextVersion}.`);
    } else {
      console.log('Release notes were empty. CHANGELOG.md was not updated.');
    }

    console.log(`Release ${PACKAGE_NAME}@${nextVersion} completed.`);
  } catch (error) {
    if (!publishStarted) {
      restoreManifest(manifestSnapshot);
      console.error('Release failed before publishing. Restored package manifest version.');
      console.error('Release notes were kept for reuse if they were already created.');
    }

    throw error;
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
```

- [ ] **Step 2: Run static checks on the release script**

Run:

```powershell
pnpm run lint
pnpm run format:check
```

Expected:
- Both commands succeed.

- [ ] **Step 3: Commit release script rewrite**

Run:

```powershell
git add scripts/release.mjs
git commit -m "chore: release root package only"
```

Expected:
- Commit succeeds.

---

### Task 4: Verify The Single-Package Build And Pack Flow

**Files:**
- No source files should change in this task.

- [ ] **Step 1: Run the phase-two verification gate**

Run:

```powershell
pnpm run verify
```

Expected:
- `pnpm run build` succeeds.
- `pnpm run lint` succeeds.
- `pnpm run package:check` succeeds.
- `node ./bin/index.js --version` prints `0.1.3`.
- `node ./bin/index.js --help` prints command help.
- `pnpm pack --dry-run` lists package contents and exits successfully.

- [ ] **Step 2: Confirm full verification still fails or passes only based on deferred tests**

Run:

```powershell
pnpm run verify:full
```

Expected:
- If tests still reference old `packages/core` paths, this command fails in the test phase after `verify` succeeds.
- If tests have already been migrated by another change, this command passes.
- Do not fix tests in this plan.

- [ ] **Step 3: Check for remaining monorepo script references**

Run:

```powershell
rg -n "workspacePackages|packages/|@uni-pages-weave/(core|cli)|version:check|check-version-sync|PACKAGE_SCOPE|--dir" package.json scripts
```

Expected:
- No output for `workspacePackages`, `@uni-pages-weave/core`, `@uni-pages-weave/cli`, `version:check`, `check-version-sync`, or `PACKAGE_SCOPE`.
- `packages/` may appear only if a user-facing error message explicitly says workspace package manifests are disallowed.
- `--dir` should not appear in `scripts/release.mjs`.

- [ ] **Step 4: Commit verification cleanup if needed**

If Step 3 reveals script-only cleanup, apply the cleanup and run:

```powershell
pnpm run verify
git add package.json scripts
git commit -m "chore: clean up monorepo packaging references"
```

Expected:
- Commit succeeds only if cleanup was needed.
- If no cleanup was needed, skip this commit.

---

### Task 5: Final Status Check

**Files:**
- No source files should change in this task.

- [ ] **Step 1: Inspect the working tree**

Run:

```powershell
git status --short
```

Expected:
- Changes from this plan are committed.
- Existing docs/tests changes from the source-layout phase may still be present and should remain untouched.

- [ ] **Step 2: Inspect recent commits**

Run:

```powershell
git log --oneline -5
```

Expected:
- Recent commits include:
  - `chore: update package scripts for single package`
  - `chore: add single package artifact check`
  - `chore: release root package only`
  - Optional `chore: clean up monorepo packaging references`

- [ ] **Step 3: Report outcome**

Report:
- Whether `pnpm run verify` passed.
- Whether `pnpm run verify:full` failed because of deferred test migration or passed.
- Whether `pnpm pack --dry-run` listed only the expected root package files.
- Which commits were created.

## Self-Review

Spec coverage:
- Root package scripts are covered by Task 1.
- Artifact validation is covered by Task 2.
- Root-only release is covered by Task 3.
- Build, smoke, and dry-run packaging verification are covered by Task 4.
- Final status and deferred test boundary are covered by Task 5.

Placeholder scan:
- No placeholder tokens are present.
- Deferred tests are explicitly out of scope and have a verification expectation.

Type and command consistency:
- `package:check` consistently maps to `scripts/check-package.mjs`.
- `version:check` is removed from package scripts and release flow.
- Release uses the root package name `uni-pages-weave` and bin command `upw`.
