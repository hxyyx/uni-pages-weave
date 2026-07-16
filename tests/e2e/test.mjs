import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['./tests/e2e/cli.test.mjs'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
