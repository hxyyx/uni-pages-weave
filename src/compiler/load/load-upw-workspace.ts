import fs from 'fs-extra';

import type { UpwAppSchema } from '../../schemas/upw.js';
import { UPW_APP_FILE } from '../../schemas/upw.js';
import { DEFAULT_TEXT_ENCODING } from '../../schemas/uni-pages.js';
import { isPlainObject } from '../../utils/object.js';
import { parseJsoncFragment } from '../utils/jsonc-fragment.js';
import {
  appUpwFile,
  collectUpwFiles,
  upwWatchPatterns,
} from '../utils/workspace-paths.js';

export interface BuildUniPagesJsonFromUpwSourceOptions {
  input: string;
  output: string;
}

export interface BuildUniPagesJsonFromUpwSourceContext {
  files: string[];
  input: string;
  output: string;
  sourceDir: string;
}

export interface UpwBuildContext {
  files: string[];
  output: string;
  sourceDir: string;
  watchPatterns: string[];
}

function readConfig(filePath: string): unknown {
  return parseJsoncFragment(fs.readFileSync(filePath, DEFAULT_TEXT_ENCODING), {
    label: filePath,
  });
}

export function readAppConfig(sourceDir: string): UpwAppSchema {
  const filePath = appUpwFile(sourceDir);

  if (!fs.existsSync(filePath)) {
    throw new Error(`${UPW_APP_FILE} is required under ${sourceDir}.`);
  }

  const config = readConfig(filePath);

  if (!isPlainObject(config)) {
    throw new Error(`${UPW_APP_FILE} must contain an object.`);
  }

  return config as UpwAppSchema;
}

export function readPageConfig(filePath: string): unknown {
  return readConfig(filePath);
}

export function resolveUpwToUniContext(
  options: BuildUniPagesJsonFromUpwSourceOptions,
): BuildUniPagesJsonFromUpwSourceContext {
  const sourceDir = options.input;
  const output = options.output;
  const files = collectUpwFiles(sourceDir);

  if (files.length === 0) {
    throw new Error(`No upw page files found under ${sourceDir}.`);
  }

  return {
    files,
    input: options.input,
    output,
    sourceDir,
  };
}

export function resolveUpwBuildContext(
  options: BuildUniPagesJsonFromUpwSourceOptions,
): UpwBuildContext {
  const context = resolveUpwToUniContext(options);

  return {
    files: context.files,
    output: context.output,
    sourceDir: context.sourceDir,
    watchPatterns: upwWatchPatterns(context.sourceDir),
  };
}
