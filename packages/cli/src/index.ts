#!/usr/bin/env node

import path from 'node:path';

import { Command } from 'commander';
import { UNI_PAGES_JSON_FILE, UPW_CLI_DESCRIPTION, UPW_CLI_NAME } from './utils/constants.js';
import { PACKAGE_VERSION } from './utils/package-info.js';

import {
  buildUniPagesJsonFromUpwSource,
  initUpw,
  resolveProjectPaths,
  resolveUpwProjectPaths,
  watchUniPagesJsonFromUpwSource,
  type GeneratedUpwSourceFile,
} from '@uni-pages-weave/core';
import { logColors, logger } from '@uni-pages-weave/core/logger';

const program = new Command();

interface CommandOptions {
  force?: boolean;
}

function resolveCommandPaths(): {
  pagesJsonPath: string;
  upwSourceDir: string;
} {
  const project = resolveProjectPaths();

  return {
    pagesJsonPath: project.pagesJsonPath,
    upwSourceDir: project.upwSourceDir,
  };
}

function resolveBuildCommandPaths(): {
  pagesJsonPath: string;
  upwSourceDir: string;
} {
  const project = resolveUpwProjectPaths();

  return {
    pagesJsonPath: project.pagesJsonPath,
    upwSourceDir: project.upwSourceDir,
  };
}

function relativeDisplayPath(filePath: string): string {
  const relativePath = path.relative(process.cwd(), filePath) || path.basename(filePath);

  return relativePath.replace(/\\/gu, '/');
}

function generatedFileLabel(file: GeneratedUpwSourceFile): string {
  const label = file.kind.padEnd(6);

  if (file.kind === 'app') {
    return logColors.green(label);
  }

  if (file.kind === 'backup') {
    return logColors.yellow(label);
  }

  return logColors.cyan(label);
}

function logGeneratedFiles(files: GeneratedUpwSourceFile[]): void {
  logger.info(`Generated ${logColors.green(String(files.length))} file(s).`);

  for (const file of files) {
    console.log(`  ${generatedFileLabel(file)} ${logColors.dim(relativeDisplayPath(file.path))}`);
  }
}

program.name(UPW_CLI_NAME).description(UPW_CLI_DESCRIPTION).version(PACKAGE_VERSION);

program
  .command('init')
  .description(`initialize an upw workspace from uni-app ${UNI_PAGES_JSON_FILE}`)
  .option('-f, --force', 'regenerate upw files when an upw workspace already exists')
  .action((options: CommandOptions) => {
    const { pagesJsonPath, upwSourceDir } = resolveCommandPaths();

    const result = initUpw({
      force: options.force,
      input: pagesJsonPath,
      output: upwSourceDir,
    });

    logGeneratedFiles(result.generatedFiles);
    logger.info(`Run \`${UPW_CLI_NAME} watch\` to start watching upw files.`);
  });

program
  .command('build')
  .description(`build ${UNI_PAGES_JSON_FILE} from an upw workspace`)
  .action(() => {
    const { pagesJsonPath, upwSourceDir } = resolveBuildCommandPaths();

    const result = buildUniPagesJsonFromUpwSource({
      input: upwSourceDir,
      output: pagesJsonPath,
    });

    logger.info(`Built ${result.pages.length} page(s).`);
  });

program
  .command('watch')
  .description(`watch upw files and rebuild ${UNI_PAGES_JSON_FILE}`)
  .action(() => {
    const { pagesJsonPath, upwSourceDir } = resolveBuildCommandPaths();

    watchUniPagesJsonFromUpwSource({
      input: upwSourceDir,
      output: pagesJsonPath,
    });
  });

try {
  program.parse();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  logger.error(message);
  process.exit(1);
}
