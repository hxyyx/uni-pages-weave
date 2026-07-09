import path from 'node:path';
import fs from 'fs-extra';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
      const manifest = readJson(path.join(dir, 'package.json'));

      return { dir, manifest };
    })
    .sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
}

const rootManifest = readJson(path.resolve('package.json'));
const expectedVersion = rootManifest.version;
const mismatches = workspacePackages().filter(
  (item) => !item.manifest.private && item.manifest.version !== expectedVersion,
);

if (mismatches.length > 0) {
  console.error(`Version mismatch. Root package version is ${expectedVersion}.`);

  for (const item of mismatches) {
    console.error(`- ${item.manifest.name}: ${item.manifest.version}`);
  }

  process.exit(1);
}

console.log(`All package versions are in sync at ${expectedVersion}.`);
