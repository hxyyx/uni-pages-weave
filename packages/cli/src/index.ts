#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { Command } from 'commander';
import { UNI_PAGES_JSON_FILE, UPW_CLI_DESCRIPTION, UPW_CLI_NAME } from './utils/constants.js';
import { PACKAGE_VERSION } from './utils/package-info.js';

import {
  buildUniPagesJsonFromUpwSource,
  extractUpwSourceFromUniPagesJson,
  resolveProjectPaths,
  watchUniPagesJsonFromUpwSource,
} from '@uni-pages-weave/core';
import { logger } from '@uni-pages-weave/core/logger';

const program = new Command();

interface CommandOptions {
  force?: boolean;
  watch?: boolean;
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

function walkUpwFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return walkUpwFiles(filePath);
    }

    return entry.isFile() && entry.name.endsWith('.upw.json') ? [filePath] : [];
  });
}

function existingUpwFiles(upwSourceDir: string): string[] {
  const appFile = path.join(upwSourceDir, 'app.upw.json');
  const files = fs.existsSync(appFile) ? [appFile] : [];

  return [
    ...files,
    ...walkUpwFiles(path.join(upwSourceDir, 'pages')),
    ...walkUpwFiles(path.join(upwSourceDir, 'platforms')),
  ];
}

program.name(UPW_CLI_NAME).description(UPW_CLI_DESCRIPTION).version(PACKAGE_VERSION);

program
  .command('init')
  .description(`initialize an upw workspace from uni-app ${UNI_PAGES_JSON_FILE}`)
  .option('-f, --force', 'regenerate upw files when an upw workspace already exists')
  .action((options: CommandOptions) => {
    const { pagesJsonPath, upwSourceDir } = resolveCommandPaths();
    const existing = existingUpwFiles(upwSourceDir);

    if (existing.length > 0 && !options.force) {
      throw new Error(
        `upw files already exist under ${upwSourceDir}. ` +
          `Run \`${UPW_CLI_NAME} init --force\` to regenerate them.`,
      );
    }

    if (existing.length > 0) {
      existing.forEach((file) => fs.rmSync(file, { force: true }));
    }

    const result = extractUpwSourceFromUniPagesJson({
      input: pagesJsonPath,
      output: upwSourceDir,
    });

    logger.info(`Generated ${result.files.length} file(s).`);
  });

program
  .command('build')
  .description(`build ${UNI_PAGES_JSON_FILE} from an upw workspace`)
  .option('-w, --watch', `watch upw files and rebuild ${UNI_PAGES_JSON_FILE}`)
  .action((options: CommandOptions) => {
    const { pagesJsonPath, upwSourceDir } = resolveCommandPaths();

    if (options.watch) {
      watchUniPagesJsonFromUpwSource({
        input: upwSourceDir,
        output: pagesJsonPath,
      });
      return;
    }

    const result = buildUniPagesJsonFromUpwSource({
      input: upwSourceDir,
      output: pagesJsonPath,
    });

    logger.info(`Built ${result.pages.length} page(s).`);
  });

try {
  program.parse();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  logger.error(message);
  process.exit(1);
}
