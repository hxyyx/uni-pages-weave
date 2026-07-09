import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { input, select } from '@inquirer/prompts';
import fs from 'fs-extra';

const NPM_REGISTRY = 'https://registry.npmjs.org/';
const PACKAGE_SCOPE = '@uni-pages-weave/';
const ROOT_MANIFEST = path.resolve('package.json');
const CHANGELOG = path.resolve('CHANGELOG.md');
const RELEASE_NOTE_DIR = path.resolve('.upw');
const STABLE_SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

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
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function workspacePackages() {
  const packagesDir = path.resolve('packages');

  if (!fs.existsSync(packagesDir)) {
    return [];
  }

  return fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(packagesDir, entry.name);
      const manifestPath = path.join(dir, 'package.json');

      if (!fs.existsSync(manifestPath)) {
        return null;
      }

      return {
        dir,
        manifestPath,
        manifest: readJson(manifestPath),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
}

function assertPublishablePackageConfig(packages) {
  const invalidPackages = [];

  for (const item of packages) {
    const { manifest } = item;

    if (!manifest.name?.startsWith(PACKAGE_SCOPE)) {
      invalidPackages.push(`${manifest.name ?? item.dir}: name must start with ${PACKAGE_SCOPE}`);
    }

    if (manifest.publishConfig?.registry !== NPM_REGISTRY) {
      invalidPackages.push(`${manifest.name}: publishConfig.registry must be ${NPM_REGISTRY}`);
    }

    if (manifest.publishConfig?.access !== 'public') {
      invalidPackages.push(`${manifest.name}: publishConfig.access must be public`);
    }
  }

  if (invalidPackages.length > 0) {
    console.error('Publishable package configuration is invalid.');

    for (const message of invalidPackages) {
      console.error(`- ${message}`);
    }

    process.exit(1);
  }
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
  console.error('Configure npm auth with a global granular access token.');
  console.error('The token must have publish permission and Bypass 2FA enabled.');
  process.exit(1);
}

function bumpVersion(version, bump) {
  const match = version.match(STABLE_SEMVER);

  if (!match) {
    console.error(`Only stable SemVer versions are supported. Found: ${version}`);
    process.exit(1);
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

function syncInternalDependencies(manifest, internalPackageNames, version) {
  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = manifest[field];

    if (!dependencies || typeof dependencies !== 'object') {
      continue;
    }

    for (const packageName of internalPackageNames) {
      const current = dependencies[packageName];

      if (typeof current !== 'string' || current.startsWith('workspace:')) {
        continue;
      }

      dependencies[packageName] = version;
    }
  }
}

function syncVersions(rootManifest, packages, version) {
  const internalPackageNames = new Set(packages.map((item) => item.manifest.name));

  rootManifest.version = version;
  writeJson(ROOT_MANIFEST, rootManifest);

  for (const item of packages) {
    item.manifest.version = version;
    syncInternalDependencies(item.manifest, internalPackageNames, version);
    writeJson(item.manifestPath, item.manifest);
  }
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
  process.exit(result.status ?? 1);
}

function assertVersionIsUnpublished(packages, version) {
  const existingPackages = packages.filter((item) =>
    packageVersionExists(item.manifest.name, version),
  );

  if (existingPackages.length === 0) {
    return;
  }

  console.error(`Version ${version} already exists on npm for:`);

  for (const item of existingPackages) {
    console.error(`- ${item.manifest.name}`);
  }

  process.exit(1);
}

function releaseNotePath(version) {
  return path.join(RELEASE_NOTE_DIR, `release-notes-${version}.md`);
}

function createReleaseNote(version) {
  fs.ensureDirSync(RELEASE_NOTE_DIR);

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

function publishPackages(packages) {
  for (const item of packages) {
    console.log(`Publishing ${item.manifest.name}@${item.manifest.version}...`);
    run('pnpm', [
      '--dir',
      item.dir,
      'publish',
      '--access',
      'public',
      '--registry',
      NPM_REGISTRY,
      '--no-git-checks',
    ]);
  }
}

const rootManifest = readJson(ROOT_MANIFEST);
const allPackages = workspacePackages();
const publishablePackages = allPackages.filter((item) => !item.manifest.private);

if (publishablePackages.length === 0) {
  console.error('No publishable packages found under packages/.');
  process.exit(1);
}

assertPublishablePackageConfig(publishablePackages);
assertNpmAuth();

const bump = await select({
  message: `Select release type from ${rootManifest.version}`,
  choices: [
    { name: 'patch', value: 'patch', description: 'Bug fixes and small changes' },
    { name: 'minor', value: 'minor', description: 'Backward-compatible features' },
    { name: 'major', value: 'major', description: 'Breaking changes' },
  ],
});
const nextVersion = bumpVersion(rootManifest.version, bump);

console.log(`Preparing release ${nextVersion}.`);
syncVersions(rootManifest, publishablePackages, nextVersion);

const notePath = createReleaseNote(nextVersion);
console.log(`Release notes file: ${path.relative(process.cwd(), notePath)}`);
await input({
  message: 'Edit the release notes file, then press Enter to continue.',
});

run('pnpm', ['run', 'verify']);
assertVersionIsUnpublished(publishablePackages, nextVersion);
publishPackages(publishablePackages);

const releaseNotes = readReleaseNoteBody(notePath);
updateChangelog(nextVersion, releaseNotes);
fs.removeSync(notePath);

if (releaseNotes) {
  console.log(`Merged release notes into CHANGELOG.md for ${nextVersion}.`);
} else {
  console.log('Release notes were empty. CHANGELOG.md was not updated.');
}

console.log(`Release ${nextVersion} completed.`);
