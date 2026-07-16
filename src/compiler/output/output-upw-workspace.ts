import path from 'node:path';

import fs from 'fs-extra';

import { DEFAULT_TEXT_ENCODING } from '../../schemas/uni-pages.js';
import type {
  GeneratedUpwSourceFile,
  PlannedUpwSourceFile,
  UpwWorkspaceFiles,
} from '../types.js';
import { renderUpwJson } from '../generate/generate-upw-json.js';
import { appUpwFile, collectUpwFiles, ensureParentDir } from '../utils/workspace-paths.js';
import type { ExtractUpwSourceFromUniPagesJsonResult } from '../uni-to-upw.js';

export function planUniToUpwFiles(workspace: UpwWorkspaceFiles): PlannedUpwSourceFile[] {
  return [
    {
      kind: 'app',
      path: workspace.appFile.path,
      content: renderUpwJson(workspace.appFile.config),
    },
    ...workspace.pageFiles.map((file) => ({
      kind: 'page' as const,
      path: file.path,
      content: renderUpwJson(file.config),
    })),
  ];
}

export function resultFromPlan(
  plan: PlannedUpwSourceFile[],
): ExtractUpwSourceFromUniPagesJsonResult {
  const generatedFiles: GeneratedUpwSourceFile[] = plan.map((file) => ({
    kind: file.kind,
    path: file.path,
  }));

  return {
    files: generatedFiles.map((file) => file.path),
    generatedFiles,
  };
}

function writePlannedFile(file: PlannedUpwSourceFile): void {
  ensureParentDir(file.path);
  fs.writeFileSync(file.path, file.content, DEFAULT_TEXT_ENCODING);
}

interface BackupEntry {
  backup: string;
  file: string;
  root: string;
}

function uniqueFiles(files: string[]): string[] {
  return Array.from(new Set(files.map((file) => path.resolve(file))));
}

function createBackupRoot(baseDir: string): string {
  fs.ensureDirSync(baseDir);

  return fs.mkdtempSync(path.join(baseDir, '.upw-init-backup-'));
}

function backupExistingFiles(files: string[], baseDir: string, backups: BackupEntry[]): void {
  const existing = uniqueFiles(files).filter((file) => fs.existsSync(file));

  if (existing.length === 0) {
    return;
  }

  const root = createBackupRoot(baseDir);

  existing.forEach((file, index) => {
    const backup = path.join(root, String(index), path.basename(file));

    ensureParentDir(backup);
    fs.moveSync(file, backup, { overwrite: true });

    backups.push({ backup, file, root });
  });
}

function restoreBackups(backups: BackupEntry[]): void {
  for (const entry of backups.slice().reverse()) {
    if (!fs.existsSync(entry.backup)) {
      continue;
    }

    fs.removeSync(entry.file);
    ensureParentDir(entry.file);
    fs.moveSync(entry.backup, entry.file, { overwrite: true });
  }
}

function cleanupBackups(backups: BackupEntry[]): void {
  for (const root of new Set(backups.map((entry) => entry.root))) {
    fs.removeSync(root);
  }
}

function removeWrittenFiles(files: string[]): void {
  for (const file of files.slice().reverse()) {
    fs.removeSync(file);
  }
}

export function applyPlannedFiles(
  plan: PlannedUpwSourceFile[],
  options: {
    replaceFiles?: string[];
    rollbackBaseDir: string;
  },
): ExtractUpwSourceFromUniPagesJsonResult {
  const plannedPaths = plan.map((file) => file.path);
  const backups: BackupEntry[] = [];
  const written: string[] = [];

  try {
    backupExistingFiles(
      [...(options.replaceFiles ?? []), ...plannedPaths],
      options.rollbackBaseDir,
      backups,
    );

    for (const file of plan) {
      writePlannedFile(file);
      written.push(file.path);
    }
  } catch (error) {
    removeWrittenFiles(written);
    restoreBackups(backups);
    cleanupBackups(backups);
    throw error;
  }

  cleanupBackups(backups);

  return resultFromPlan(plan);
}

export function existingUpwFiles(outDir: string): string[] {
  const appFile = appUpwFile(outDir);
  const files = fs.existsSync(appFile) ? [appFile] : [];

  return [...files, ...collectUpwFiles(outDir)];
}

export function formatExistingFiles(outDir: string, files: string[]): string {
  const preview = files
    .slice(0, 5)
    .map((file) => path.relative(outDir, file) || path.basename(file));
  const suffix = files.length > preview.length ? ` and ${files.length - preview.length} more` : '';

  return `${preview.join(', ')}${suffix}`;
}
