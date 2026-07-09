import fs from 'node:fs';

import { actualRoot } from './support/files.mjs';

fs.rmSync(actualRoot, { recursive: true, force: true });
console.log(`Cleared test artifacts: ${actualRoot}`);
