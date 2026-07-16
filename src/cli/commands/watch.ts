import { resolveUpwProjectPaths, watchUniPagesJsonFromUpwSource } from '../../index.js';
import { UNI_PAGES_JSON_FILE } from '../../schemas/uni-pages.js';

export function runWatchCommand(): void {
  const project = resolveUpwProjectPaths();
  watchUniPagesJsonFromUpwSource({
    input: project.upwSourceDir,
    output: project.pagesJsonPath,
  });
}

export function watchCommandDescription(): string {
  return `watch upw files and rebuild ${UNI_PAGES_JSON_FILE}`;
}
