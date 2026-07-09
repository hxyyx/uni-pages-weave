export {
  buildUniPagesJsonFromUpwSource,
  resolveUpwBuildContext,
} from './compiler/upw-to-uni.js';
export { watchUniPagesJsonFromUpwSource } from './compiler/watch-upw-to-uni.js';
export { extractUpwSourceFromUniPagesJson } from './compiler/uni-to-upw.js';
export { resolveProjectPaths } from './utils/project.js';
export type {
  BuildUniPagesJsonFromUpwSourceOptions,
  BuildUniPagesJsonFromUpwSourceResult,
  UpwBuildContext,
} from './compiler/upw-to-uni.js';
export type {
  ExtractUpwSourceFromUniPagesJsonOptions,
  ExtractUpwSourceFromUniPagesJsonResult,
} from './compiler/uni-to-upw.js';
export type { ProjectPaths, UniAppProjectMode } from './utils/project.js';
