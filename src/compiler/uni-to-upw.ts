import fs from 'fs-extra';

import { UPW_CLI_NAME } from '../schemas/upw.js';
import { UNI_PAGES_JSON_FILE } from '../schemas/uni-pages.js';
import type { GeneratedUpwSourceFile, PlannedUpwSourceFile } from './types.js';
import { readUniPagesJson } from './load/load-uni-pages-json.js';
import { buildUpwWorkspaceFilesFromUniPagesJson } from './transform/uni-to-upw-workspace.js';
import {
  applyPlannedFiles,
  existingUpwFiles,
  formatExistingFiles,
  planUniToUpwFiles,
} from './output/upw-files.js';

export interface ExtractUpwSourceFromUniPagesJsonOptions {
  input: string;
  output: string;
}

export interface ExtractUpwSourceFromUniPagesJsonContext {
  input: string;
  output: string;
}

export interface ExtractUpwSourceFromUniPagesJsonResult {
  files: string[];
  generatedFiles: GeneratedUpwSourceFile[];
}

export interface InitUpwOptions extends ExtractUpwSourceFromUniPagesJsonOptions {
  force?: boolean;
}

export type InitUpwResult = ExtractUpwSourceFromUniPagesJsonResult;

export type { GeneratedUpwSourceFile, GeneratedUpwSourceFileKind } from './types.js';

export function resolveUniToUpwContext(
  options: ExtractUpwSourceFromUniPagesJsonOptions,
): ExtractUpwSourceFromUniPagesJsonContext {
  const { input, output } = options;

  if (!fs.existsSync(input)) {
    throw new Error(`No ${UNI_PAGES_JSON_FILE} found at ${input}.`);
  }

  return {
    input,
    output,
  };
}

function planFromContext(context: ExtractUpwSourceFromUniPagesJsonContext): PlannedUpwSourceFile[] {
  return planUniToUpwFiles(
    buildUpwWorkspaceFilesFromUniPagesJson(readUniPagesJson(context.input), context.output),
  );
}

export function extractUpwSourceFromUniPagesJson(
  options: ExtractUpwSourceFromUniPagesJsonOptions,
): ExtractUpwSourceFromUniPagesJsonResult {
  const context = resolveUniToUpwContext(options);

  return applyPlannedFiles(planFromContext(context), {
    rollbackBaseDir: context.output,
  });
}

export function initUpw(options: InitUpwOptions): InitUpwResult {
  const context = resolveUniToUpwContext(options);
  const existing = existingUpwFiles(context.output);

  if (existing.length > 0) {
    if (!options.force) {
      throw new Error(
        `upw files already exist under ${context.output}: ${formatExistingFiles(context.output, existing)}. ` +
          `Run \`${UPW_CLI_NAME} init --force\` to regenerate them.`,
      );
    }

    return applyPlannedFiles(planFromContext(context), {
      replaceFiles: existing,
      rollbackBaseDir: context.output,
    });
  }

  return applyPlannedFiles(planFromContext(context), {
    rollbackBaseDir: context.output,
  });
}
