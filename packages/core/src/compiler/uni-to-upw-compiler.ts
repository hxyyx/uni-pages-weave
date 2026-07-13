import path from 'node:path';

import fs from 'fs-extra';

import { UPW_CLI_NAME } from '../spec/upw-spec.js';
import { DEFAULT_TEXT_ENCODING, UNI_PAGES_JSON_BACKUP_FILE, UNI_PAGES_JSON_FILE } from '../spec/uni-pages-spec.js';
import { parsePagesSource } from '../parser/uni-pages-json-parser.js';
import { renderUpwJson } from '../renderer/upw-json-renderer.js';
import { buildUpwWorkspaceFilesFromUniPagesJson } from '../workspace/uni-pages-workspace.js';
import { appUpwFile, collectUpwFiles, ensureParentDir } from '../workspace/upw-workspace-paths.js';

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
}

interface PendingFile {
  path: string;
  content: string;
}

export function backupUniPagesJson(input: string): string {
  const backupFile = path.join(path.dirname(input), UNI_PAGES_JSON_BACKUP_FILE);

  fs.copyFileSync(input, backupFile);

  return backupFile;
}

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

function runUniToUpw(
  context: ExtractUpwSourceFromUniPagesJsonContext,
): ExtractUpwSourceFromUniPagesJsonResult {
  const { input, output } = context;
  const workspace = buildUpwWorkspaceFilesFromUniPagesJson(parsePagesSource(input), output);
  const files: string[] = [];
  const pendingFiles: PendingFile[] = [
    {
      path: workspace.appFile.path,
      content: renderUpwJson(workspace.appFile.config),
    },
    ...workspace.pageFiles.map((file) => ({
      path: file.path,
      content: renderUpwJson(file.config),
    })),
  ];

  for (const file of pendingFiles) {
    ensureParentDir(file.path);
    fs.writeFileSync(file.path, file.content, DEFAULT_TEXT_ENCODING);
    files.push(file.path);
  }

  const backupFile = backupUniPagesJson(input);

  files.push(backupFile);

  return { files };
}

export function extractUpwSourceFromUniPagesJson(
  options: ExtractUpwSourceFromUniPagesJsonOptions,
): ExtractUpwSourceFromUniPagesJsonResult {
  return runUniToUpw(resolveUniToUpwContext(options));
}

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
