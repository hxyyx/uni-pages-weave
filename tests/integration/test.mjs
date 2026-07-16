import { spawnSync } from 'node:child_process';

const result = spawnSync('pnpm', ['exec', 'tsx', './tests/integration/compiler.test.ts'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
