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
  run('pnpm', ['publish', '--access', 'public', '--registry', NPM_REGISTRY, '--no-git-checks']);
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
