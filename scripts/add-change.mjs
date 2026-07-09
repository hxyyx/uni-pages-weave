import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';

const CHANGESET_DIR = path.resolve('.changeset');

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
    .filter((item) => !item.manifest.private)
    .sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
}

function createChangesetId() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const random = crypto.randomUUID().split('-')[0];

  return `${timestamp}-${random}`;
}

const packages = workspacePackages();

if (packages.length === 0) {
  console.error('No publishable workspace packages found.');
  process.exit(1);
}

fs.ensureDirSync(CHANGESET_DIR);

const changesetId = createChangesetId();
const changesetPath = path.join(CHANGESET_DIR, `${changesetId}.md`);
const frontmatter = packages.map((item) => `"${item.manifest.name}": patch`).join('\n');
const content = `---\n${frontmatter}\n---\n\n<!-- 在这里填写本次变更说明。发布时会自动聚合到根 CHANGELOG.md。 -->\n`;

fs.writeFileSync(changesetPath, content);

console.log(`Created changeset: ${path.relative(process.cwd(), changesetPath)}`);
console.log('Edit this file and replace the comment with a non-empty change summary.');
