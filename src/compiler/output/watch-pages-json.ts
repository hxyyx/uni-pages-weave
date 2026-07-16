import { watch, type FSWatcher } from 'chokidar';

import { UNI_PAGES_JSON_FILE } from '../../schemas/uni-pages.js';
import { logger } from '../../utils/logger.js';
import {
  type BuildUniPagesJsonFromUpwSourceOptions,
  resolveUpwBuildContext,
  resolveUpwToUniContext,
} from '../load/load-upw-workspace.js';
import { runUpwToUniBuild } from './output-pages-json.js';

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
  logger.info(`Watching upw files under ${sourceDir}.`);

  return watcher;
}
