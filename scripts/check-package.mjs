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
