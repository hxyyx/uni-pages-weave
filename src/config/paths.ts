import path from 'node:path';

import fs from 'fs-extra';

import { UPW_APP_FILE, UPW_TARGET_DIR } from '../schemas/upw.js';
import {
  DEFAULT_PROJECT_DIR,
  UNI_PAGES_JSON_FILE,
  UNI_PROJECT_MODE_CLI,
  UNI_PROJECT_MODE_HBUILDX,
  UNI_PROJECT_SRC_DIR,
} from '../schemas/uni-pages.js';

export type UniAppProjectLayout = 'root' | typeof UNI_PROJECT_SRC_DIR;
export type UniAppProjectMode = typeof UNI_PROJECT_MODE_HBUILDX | typeof UNI_PROJECT_MODE_CLI;

export interface ProjectPaths {
  projectDir: string;
  layout: UniAppProjectLayout;
  pagesJsonPath: string;
  upwSourceDir: string;
}

export interface ResolveUniAppProjectOptions {
  mode?: UniAppProjectMode;
  targetDir?: string;
}

export interface ResolveUpwProjectOptions {
  mode?: UniAppProjectMode;
}

function sourceDir(projectDir: string, layout: UniAppProjectLayout): string {
  return layout === UNI_PROJECT_SRC_DIR ? path.join(projectDir, UNI_PROJECT_SRC_DIR) : projectDir;
}

function upwSourceDir(projectDir: string, layout: UniAppProjectLayout, targetDir?: string): string {
  return targetDir
    ? path.join(path.resolve(targetDir), UPW_TARGET_DIR)
    : sourceDir(projectDir, layout);
}

function assertProjectMode(mode: unknown): asserts mode is UniAppProjectMode | undefined {
  if (mode !== undefined && mode !== UNI_PROJECT_MODE_HBUILDX && mode !== UNI_PROJECT_MODE_CLI) {
    throw new Error(
      `Invalid mode "${String(mode)}". Expected one of: ${UNI_PROJECT_MODE_HBUILDX}, ${UNI_PROJECT_MODE_CLI}.`,
    );
  }
}

function projectFromPagesJson(
  projectDir: string,
  pagesJsonPath: string,
  layout: UniAppProjectLayout,
  targetDir?: string,
): ProjectPaths {
  if (!fs.existsSync(pagesJsonPath)) {
    throw new Error(`No ${UNI_PAGES_JSON_FILE} found at ${pagesJsonPath}.`);
  }

  return {
    projectDir,
    pagesJsonPath,
    layout,
    upwSourceDir: upwSourceDir(projectDir, layout, targetDir),
  };
}

function projectFromAppUpw(projectDir: string, layout: UniAppProjectLayout): ProjectPaths {
  const inputDir = sourceDir(projectDir, layout);
  const appUpwPath = path.join(inputDir, UPW_APP_FILE);

  if (!fs.existsSync(appUpwPath)) {
    throw new Error(`No ${UPW_APP_FILE} found at ${appUpwPath}.`);
  }

  return {
    projectDir,
    pagesJsonPath: path.join(inputDir, UNI_PAGES_JSON_FILE),
    layout,
    upwSourceDir: inputDir,
  };
}

export function resolveProjectPaths(
  projectDir = DEFAULT_PROJECT_DIR,
  options: ResolveUniAppProjectOptions = {},
): ProjectPaths {
  assertProjectMode(options.mode);

  const resolvedProjectDir = path.resolve(projectDir);
  const srcPagesJson = path.join(resolvedProjectDir, UNI_PROJECT_SRC_DIR, UNI_PAGES_JSON_FILE);
  const rootPagesJson = path.join(resolvedProjectDir, UNI_PAGES_JSON_FILE);

  if (options.mode === UNI_PROJECT_MODE_CLI) {
    return projectFromPagesJson(
      resolvedProjectDir,
      srcPagesJson,
      UNI_PROJECT_SRC_DIR,
      options.targetDir,
    );
  }

  if (options.mode === UNI_PROJECT_MODE_HBUILDX) {
    return projectFromPagesJson(resolvedProjectDir, rootPagesJson, 'root', options.targetDir);
  }

  if (fs.existsSync(srcPagesJson)) {
    return {
      projectDir: resolvedProjectDir,
      pagesJsonPath: srcPagesJson,
      layout: UNI_PROJECT_SRC_DIR,
      upwSourceDir: upwSourceDir(resolvedProjectDir, UNI_PROJECT_SRC_DIR, options.targetDir),
    };
  }

  if (fs.existsSync(rootPagesJson)) {
    return {
      projectDir: resolvedProjectDir,
      pagesJsonPath: rootPagesJson,
      layout: 'root',
      upwSourceDir: upwSourceDir(resolvedProjectDir, 'root', options.targetDir),
    };
  }

  throw new Error(
    `No ${UNI_PAGES_JSON_FILE} found under ${resolvedProjectDir}. Expected ${UNI_PAGES_JSON_FILE} or ${UNI_PROJECT_SRC_DIR}/${UNI_PAGES_JSON_FILE}.`,
  );
}

export function resolveUpwProjectPaths(
  projectDir = DEFAULT_PROJECT_DIR,
  options: ResolveUpwProjectOptions = {},
): ProjectPaths {
  assertProjectMode(options.mode);

  const resolvedProjectDir = path.resolve(projectDir);
  const srcAppUpw = path.join(resolvedProjectDir, UNI_PROJECT_SRC_DIR, UPW_APP_FILE);
  const rootAppUpw = path.join(resolvedProjectDir, UPW_APP_FILE);

  if (options.mode === UNI_PROJECT_MODE_CLI) {
    return projectFromAppUpw(resolvedProjectDir, UNI_PROJECT_SRC_DIR);
  }

  if (options.mode === UNI_PROJECT_MODE_HBUILDX) {
    return projectFromAppUpw(resolvedProjectDir, 'root');
  }

  if (fs.existsSync(srcAppUpw)) {
    return projectFromAppUpw(resolvedProjectDir, UNI_PROJECT_SRC_DIR);
  }

  if (fs.existsSync(rootAppUpw)) {
    return projectFromAppUpw(resolvedProjectDir, 'root');
  }

  throw new Error(
    `No ${UPW_APP_FILE} found under ${resolvedProjectDir}. Expected ${UPW_APP_FILE} or ${UNI_PROJECT_SRC_DIR}/${UPW_APP_FILE}.`,
  );
}
