import path from 'node:path';

import type { GeneratedUpwSourceFile } from '../compiler/types.js';
import { logColors, logger } from '../utils/logger.js';

function relativeDisplayPath(filePath: string): string {
  const relativePath = path.relative(process.cwd(), filePath) || path.basename(filePath);

  return relativePath.replace(/\\/gu, '/');
}

function generatedFileLabel(file: GeneratedUpwSourceFile): string {
  const label = file.kind.padEnd(6);

  if (file.kind === 'app') {
    return logColors.green(label);
  }

  return logColors.cyan(label);
}

export function logGeneratedFiles(files: GeneratedUpwSourceFile[]): void {
  logger.info(`Generated ${logColors.green(String(files.length))} file(s).`);

  for (const file of files) {
    console.log(`  ${generatedFileLabel(file)} ${logColors.dim(relativeDisplayPath(file.path))}`);
  }
}
