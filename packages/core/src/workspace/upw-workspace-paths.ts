import path from 'node:path';

import fs from 'fs-extra';

import {
  UPW_APP_FILE,
  UPW_PAGE_EXTENSION,
  UPW_PAGE_FILE_GLOB,
  UPW_PAGE_FILE_PATTERN,
  UPW_PAGES_DIR,
  UPW_PLATFORMS_DIR,
} from '../spec/upw-spec.js';

export function normalizePagePath(pagePath: string): string {
  return pagePath
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/\/+$/, '');
}

export function isPlatformPagePath(pagePath: string): boolean {
  return normalizePagePath(pagePath).startsWith(`${UPW_PLATFORMS_DIR}/`);
}

export function isPlatformWorkspaceFile(rootDir: string, filePath: string): boolean {
  return isPlatformPagePath(path.relative(rootDir, filePath));
}

export function pagePathToWorkspaceFile(rootDir: string, pagePath: string): string {
  const normalized = normalizePagePath(pagePath);
  const pagePrefix = `${UPW_PAGES_DIR}/`;
  const platformPrefix = `${UPW_PLATFORMS_DIR}/`;
  const pageRelativePath = normalized.startsWith(pagePrefix)
    ? normalized.slice(pagePrefix.length)
    : normalized;
  const outputPath = isPlatformPagePath(normalized)
    ? path.join(UPW_PLATFORMS_DIR, ...normalized.slice(platformPrefix.length).split('/'))
    : path.join(UPW_PAGES_DIR, ...pageRelativePath.split('/'));

  return path.join(rootDir, outputPath) + UPW_PAGE_EXTENSION;
}

export function appUpwFile(rootDir: string): string {
  return path.join(rootDir, UPW_APP_FILE);
}

export function ensureParentDir(filePath: string): void {
  fs.ensureDirSync(path.dirname(filePath));
}

function collectUpwFilesRecursive(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectUpwFilesRecursive(fullPath));
    } else if (entry.name !== UPW_APP_FILE && UPW_PAGE_FILE_PATTERN.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

export function collectUpwFiles(dir: string): string[] {
  return [
    ...collectUpwFilesRecursive(path.join(dir, UPW_PAGES_DIR)),
    ...collectUpwFilesRecursive(path.join(dir, UPW_PLATFORMS_DIR)),
  ].sort();
}

export function upwWatchPatterns(rootDir: string): string[] {
  return [
    appUpwFile(rootDir),
    path.join(rootDir, UPW_PAGES_DIR, '**', UPW_PAGE_FILE_GLOB),
    path.join(rootDir, UPW_PLATFORMS_DIR, '**', UPW_PAGE_FILE_GLOB),
  ];
}


