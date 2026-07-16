#!/usr/bin/env node

import { Command } from 'commander';

import { UPW_CLI_DESCRIPTION, UPW_CLI_NAME } from '../schemas/upw.js';
import { logger } from '../utils/logger.js';
import { buildCommandDescription, runBuildCommand } from './commands/build.js';
import {
  initCommandDescription,
  runInitCommand,
  type InitCommandOptions,
} from './commands/init.js';
import { runWatchCommand, watchCommandDescription } from './commands/watch.js';
import { PACKAGE_VERSION } from './version.js';

const program = new Command();

program.name(UPW_CLI_NAME).description(UPW_CLI_DESCRIPTION).version(PACKAGE_VERSION);

program
  .command('init')
  .description(initCommandDescription())
  .option('-f, --force', 'regenerate upw files when an upw workspace already exists')
  .action((options: InitCommandOptions) => {
    runInitCommand(options);
  });

program
  .command('build')
  .description(buildCommandDescription())
  .action(() => {
    runBuildCommand();
  });

program
  .command('watch')
  .description(watchCommandDescription())
  .action(() => {
    runWatchCommand();
  });

try {
  program.parse();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  logger.error(message);
  process.exit(1);
}
