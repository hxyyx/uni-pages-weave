import { initUpw, resolveProjectPaths, type GeneratedUpwSourceFile } from '../../index.js';
import { UNI_PAGES_JSON_FILE } from '../../schemas/uni-pages.js';
import { UPW_CLI_NAME } from '../../schemas/upw.js';
import { logger } from '../../utils/logger.js';
import { logGeneratedFiles } from '../output.js';

export interface InitCommandOptions {
  force?: boolean;
}

export function runInitCommand(options: InitCommandOptions): void {
  const project = resolveProjectPaths();
  const result = initUpw({
    force: options.force,
    input: project.pagesJsonPath,
    output: project.upwSourceDir,
  });

  logGeneratedFiles(result.generatedFiles as GeneratedUpwSourceFile[]);
  logger.info(`Run \`${UPW_CLI_NAME} watch\` to start watching upw files.`);
}

export function initCommandDescription(): string {
  return `initialize an upw workspace from uni-app ${UNI_PAGES_JSON_FILE}`;
}
