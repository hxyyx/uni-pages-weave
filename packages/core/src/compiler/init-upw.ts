import path from 'node:path';

import fs from 'fs-extra';
import { UPW_CLI_NAME } from '../internal/constants.js';
import { appUpwFile, collectUpwFiles } from '../utils/path.js';

import {
  extractUpwSourceFromUniPagesJson,
  resolveUniToUpwContext,
  type ExtractUpwSourceFromUniPagesJsonOptions,
  type ExtractUpwSourceFromUniPagesJsonResult,
} from './uni-to-upw.js';

export interface InitUpwOptions extends ExtractUpwSourceFromUniPagesJsonOptions {
  force?: boolean;
}

export type InitUpwResult = ExtractUpwSourceFromUniPagesJsonResult;

function existingUpwFiles(outDir: string): string[] {
  const appFile = appUpwFile(outDir);
  const files = fs.existsSync(appFile) ? [appFile] : [];

  return [...files, ...collectUpwFiles(outDir)];
}

function formatExistingFiles(outDir: string, files: string[]): string {
  const preview = files
    .slice(0, 5)
    .map((file) => path.relative(outDir, file) || path.basename(file));
  const suffix = files.length > preview.length ? ` and ${files.length - preview.length} more` : '';

  return `${preview.join(', ')}${suffix}`;
}

function removeExistingUpwFiles(files: string[]): void {
  for (const file of files) {
    fs.removeSync(file);
  }
}

export function initUpw(options: InitUpwOptions): InitUpwResult {
  const context = resolveUniToUpwContext(options);
  const existing = existingUpwFiles(context.output);

  if (existing.length > 0) {
    if (!options.force) {
      throw new Error(
        `UPW files already exist under ${context.output}: ${formatExistingFiles(context.output, existing)}. ` +
          `Run \`${UPW_CLI_NAME} init --force\` to regenerate them.`,
      );
    }

    removeExistingUpwFiles(existing);
  }

  return extractUpwSourceFromUniPagesJson(options);
}
