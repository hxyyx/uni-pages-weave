import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { spawnSync } from 'node:child_process';
import fs from 'fs-extra';

const REGISTRY = 'https://registry.npmjs.org/';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function packageDirs() {
  const roots = [path.resolve('packages')];
  const dirs = [];

  for (const root of roots) {
    if (!fs.existsSync(root)) {
      continue;
    }

    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        dirs.push(path.join(root, entry.name));
      }
    }
  }

  return dirs;
}

function workspacePackages() {
  return packageDirs()
    .map((dir) => {
      try {
        const manifest = readJson(path.join(dir, 'package.json'));

        return { dir, manifest };
      } catch {
        return undefined;
      }
    })
    .filter(Boolean);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const publishablePackages = workspacePackages()
  .filter((item) => !item.manifest.private)
  .sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));

if (publishablePackages.length === 0) {
  console.log('No publishable workspace packages found.');
  process.exit(0);
}

console.log('Select a package to publish:');

publishablePackages.forEach((item, index) => {
  console.log(`${index + 1}. ${item.manifest.name}@${item.manifest.version}`);
});

const rl = createInterface({ input, output });
const answer = await rl.question('Package number: ');
rl.close();

if (!answer.trim()) {
  console.log('Publish cancelled.');
  process.exit(0);
}

const selectedIndex = Number.parseInt(answer, 10) - 1;
const selectedPackage = publishablePackages[selectedIndex];

if (!selectedPackage) {
  console.error(`Invalid package selection: ${answer}`);
  process.exit(1);
}

const packageName = selectedPackage.manifest.name;

run('pnpm', ['--filter', packageName, 'build']);
run('pnpm', ['--filter', packageName, 'publish', '--access', 'public', '--registry', REGISTRY]);
