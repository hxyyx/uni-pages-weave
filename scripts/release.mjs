import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { select } from '@inquirer/prompts';
import fs from 'fs-extra';

const CHANGESET_DIR = path.resolve('.changeset');
const ROOT_CHANGELOG = path.resolve('CHANGELOG.md');
const STABLE_SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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
      const manifest = readJson(manifestPath);

      return { dir, manifestPath, manifest };
    })
    .sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
}

function assertVersionSync(rootManifest, packages) {
  const mismatches = packages.filter((item) => item.manifest.version !== rootManifest.version);

  if (mismatches.length > 0) {
    console.error(`Version mismatch. Root package version is ${rootManifest.version}.`);

    for (const item of mismatches) {
      console.error(`- ${item.manifest.name}: ${item.manifest.version}`);
    }

    process.exit(1);
  }
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

function pendingChangesetFiles() {
  if (!fs.existsSync(CHANGESET_DIR)) {
    return [];
  }

  return fs
    .readdirSync(CHANGESET_DIR)
    .filter((name) => name.endsWith('.md'))
    .map((name) => path.join(CHANGESET_DIR, name))
    .sort((left, right) => left.localeCompare(right));
}

function parseChangeset(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  const body = match ? match[1] : raw;
  const meaningfulBody = body.replace(/<!--[\s\S]*?-->/g, '').trim();

  return { filePath, raw, body, meaningfulBody };
}

function rewriteChangesets(files, packages, bump) {
  const frontmatter = packages.map((item) => `"${item.manifest.name}": ${bump}`).join('\n');

  for (const file of files) {
    const parsed = parseChangeset(file);
    const body = parsed.body.trim();
    const nextContent = `---\n${frontmatter}\n---\n\n${body}\n`;

    fs.writeFileSync(file, nextContent);
  }
}

function runChangesetVersion() {
  const command = 'changeset';
  const result = spawnSync(command, ['version'], {
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

function extractVersionEntry(changelogPath, version) {
  if (!fs.existsSync(changelogPath)) {
    throw new Error(`Expected package changelog was not generated: ${changelogPath}`);
  }

  const content = fs.readFileSync(changelogPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === `## ${version}`);

  if (startIndex === -1) {
    throw new Error(`Could not find ${version} entry in ${changelogPath}.`);
  }

  let endIndex = lines.length;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      endIndex = index;
      break;
    }
  }

  return lines
    .slice(startIndex + 1, endIndex)
    .join('\n')
    .trim();
}

function writeRootChangelog(version, entry) {
  if (!entry.trim()) {
    console.error('Generated changelog entry is empty.');
    process.exit(1);
  }

  const versionEntry = `## ${version}\n\n${entry.trim()}\n`;

  if (!fs.existsSync(ROOT_CHANGELOG)) {
    fs.writeFileSync(ROOT_CHANGELOG, `# Changelog\n\n${versionEntry}`);
    return;
  }

  const current = fs.readFileSync(ROOT_CHANGELOG, 'utf8').trimEnd();

  if (current.startsWith('# Changelog')) {
    const firstLineBreak = current.indexOf('\n');

    if (firstLineBreak === -1) {
      fs.writeFileSync(ROOT_CHANGELOG, `# Changelog\n\n${versionEntry}`);
      return;
    }

    const header = current.slice(0, firstLineBreak).trimEnd();
    const rest = current.slice(firstLineBreak).trim();
    const next = rest ? `${header}\n\n${versionEntry}\n${rest}\n` : `${header}\n\n${versionEntry}`;

    fs.writeFileSync(ROOT_CHANGELOG, next);
    return;
  }

  fs.writeFileSync(ROOT_CHANGELOG, `# Changelog\n\n${versionEntry}\n${current}\n`);
}

function removePackageChangelogs(packages) {
  for (const item of packages) {
    fs.removeSync(path.join(item.dir, 'CHANGELOG.md'));
  }
}

function syncRootVersion(version) {
  const rootManifestPath = path.resolve('package.json');
  const rootManifest = readJson(rootManifestPath);
  rootManifest.version = version;
  writeJson(rootManifestPath, rootManifest);
}

const allowedArgs = new Set(['--no-publish']);
const unknownArgs = process.argv.slice(2).filter((arg) => !allowedArgs.has(arg));

if (unknownArgs.length > 0) {
  console.error(`Unknown argument(s): ${unknownArgs.join(', ')}`);
  console.error('This release script only supports interactive version selection.');
  process.exit(1);
}

const rootManifest = readJson(path.resolve('package.json'));
const packages = workspacePackages();
const publishablePackages = packages.filter((item) => !item.manifest.private);

if (publishablePackages.length === 0) {
  console.error('No publishable workspace packages found.');
  process.exit(1);
}

assertVersionSync(rootManifest, packages);

const changesetFiles = pendingChangesetFiles();

if (changesetFiles.length === 0) {
  console.error('No pending changesets found. Run `npm run changeset:add` first.');
  process.exit(1);
}

const parsedChangesets = changesetFiles.map(parseChangeset);
const emptyChangesets = parsedChangesets.filter((item) => item.meaningfulBody.length === 0);

if (emptyChangesets.length > 0) {
  console.error('Every changeset must contain a non-empty change summary.');

  for (const item of emptyChangesets) {
    console.error(`- ${path.relative(process.cwd(), item.filePath)}`);
  }

  process.exit(1);
}

const bump = await select({
  message: 'Select release version bump',
  choices: [
    { name: 'patch', value: 'patch', description: 'Bug fixes and small changes' },
    { name: 'minor', value: 'minor', description: 'Backward-compatible features' },
    { name: 'major', value: 'major', description: 'Breaking changes' },
  ],
});
const nextVersion = bumpVersion(rootManifest.version, bump);
const representativePackage =
  publishablePackages.find((item) => item.manifest.name === '@uni-pages-weave/core') ??
  publishablePackages[0];

rewriteChangesets(changesetFiles, publishablePackages, bump);
runChangesetVersion();

const generatedEntry = extractVersionEntry(
  path.join(representativePackage.dir, 'CHANGELOG.md'),
  nextVersion,
);

syncRootVersion(nextVersion);
writeRootChangelog(nextVersion, generatedEntry);
removePackageChangelogs(packages);

console.log(`Prepared release ${nextVersion}.`);

if (process.argv.includes('--no-publish')) {
  console.log('Release files are ready. Publish was not run because --no-publish was provided.');
}
