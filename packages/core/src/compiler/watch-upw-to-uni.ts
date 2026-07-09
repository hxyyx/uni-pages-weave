import { watch, type FSWatcher } from 'chokidar';
import { UNI_PAGES_JSON_FILE } from '../internal/constants.js';

import {
  resolveUpwBuildContext,
  resolveUpwToUniContext,
  runUpwToUniBuild,
  type BuildUniPagesJsonFromUpwSourceOptions,
} from './upw-to-uni.js';
import { logger } from '../logger.js';

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
