import { buildUniPagesJsonFromUpwSource, resolveUpwProjectPaths } from '../../index.js';
import { UNI_PAGES_JSON_FILE } from '../../schemas/uni-pages.js';
import { logger } from '../../utils/logger.js';

export function runBuildCommand(): void {
  const project = resolveUpwProjectPaths();
  const result = buildUniPagesJsonFromUpwSource({
    input: project.upwSourceDir,
    output: project.pagesJsonPath,
  });

  logger.info(`Built ${result.pages.length} page(s).`);
}

export function buildCommandDescription(): string {
  return `build ${UNI_PAGES_JSON_FILE} from an upw workspace`;
}
