import { watch, type FSWatcher } from 'chokidar';
import fs from 'fs-extra';

import type { UpwAppSchema } from '../spec/upw-spec.js';
import { UPW_APP_FILE } from '../spec/upw-spec.js';
import { DEFAULT_TEXT_ENCODING, UNI_PAGES_JSON_FILE } from '../spec/uni-pages-spec.js';
import { parseJsoncFragment } from '../fragment/jsonc-fragment.js';
import { isPlainObject } from '../foundation/object.js';
import { logger } from '../logger.js';
import { renderUniPagesJsonWithConditionComments } from '../renderer/uni-pages-json-renderer.js';
import {
  buildUniPagesJsonWorkspaceFromUpwProject,
  type UpwProjectPageSource,
} from '../workspace/upw-workspace.js';
import {
  appUpwFile,
  collectUpwFiles,
  ensureParentDir,
  upwWatchPatterns,
} from '../workspace/upw-workspace-paths.js';

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

export interface BuildUniPagesJsonFromUpwSourceResult {
  pages: Record<string, unknown>[];
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

function readAppConfig(sourceDir: string): UpwAppSchema {
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

function readPageConfig(filePath: string): unknown {
  return readConfig(filePath);
}

export function resolveUpwToUniContext(
  options: BuildUniPagesJsonFromUpwSourceOptions,
): BuildUniPagesJsonFromUpwSourceContext {
  const sourceDir = options.input;
  const output = options.output;
  const files = collectUpwFiles(sourceDir);

  if (files.length === 0) {
    throw new Error(`No UPW page files found under ${sourceDir}.`);
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

export function runUpwToUniBuild(
  context: BuildUniPagesJsonFromUpwSourceContext,
): BuildUniPagesJsonFromUpwSourceResult {
  const { files, output, sourceDir } = context;
  const appFile = appUpwFile(sourceDir);
  const app = readAppConfig(sourceDir);
  const pageSources: UpwProjectPageSource[] = files.map((file, readOrder) => ({
    data: readPageConfig(file),
    file,
    readOrder,
  }));
  const workspace = buildUniPagesJsonWorkspaceFromUpwProject({
    app,
    appFile,
    pageSources,
    sourceDir,
  });
  const content = renderUniPagesJsonWithConditionComments(
    workspace.app,
    workspace.appPatches,
    workspace.pages,
    workspace.subPackages,
    workspace.subPackagePages,
  );
  const pages = workspace.pages.map((entry) => entry.page);

  ensureParentDir(output);
  fs.writeFileSync(output, content, DEFAULT_TEXT_ENCODING);

  return { pages };
}

export function buildUniPagesJsonFromUpwSource(
  options: BuildUniPagesJsonFromUpwSourceOptions,
): BuildUniPagesJsonFromUpwSourceResult {
  return runUpwToUniBuild(resolveUpwToUniContext(options));
}

export type WatchUniPagesJsonFromUpwSourceOptions = BuildUniPagesJsonFromUpwSourceOptions;

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function watchUniPagesJsonFromUpwSource(
  options: WatchUniPagesJsonFromUpwSourceOptions,
): FSWatcher {
  const context = resolveUpwBuildContext(options);
  const sourceDir = context.sourceDir;
  const patterns = context.watchPatterns;

  const run = () => {
    try {
      runUpwToUniBuild(resolveUpwToUniContext(options));
      logger.info(`Built ${UNI_PAGES_JSON_FILE} from ${sourceDir}.`);
    } catch (error) {
      logger.error(`Build failed: ${messageFromError(error)}`);
    }
  };

  const watcher = watch(patterns, {
    ignoreInitial: true,
  });

  watcher.on('add', run);
  watcher.on('change', run);
  watcher.on('unlink', run);
  run();
  logger.info(`Watching UPW files under ${sourceDir}.`);

  return watcher;
}
