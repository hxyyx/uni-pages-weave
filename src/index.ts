export {
  buildUniPagesJsonFromUpwSource,
  resolveUpwBuildContext,
  watchUniPagesJsonFromUpwSource,
} from './compiler/upw-to-uni.js';
export { extractUpwSourceFromUniPagesJson, initUpw } from './compiler/uni-to-upw.js';
export { renderUpwToUniPagesJson } from './compiler/generate/generate-pages-json.js';
export { resolveProjectPaths, resolveUpwProjectPaths } from './config/paths.js';
export type {
  BuildUniPagesJsonFromUpwSourceOptions,
  BuildUniPagesJsonFromUpwSourceResult,
  UpwBuildContext,
  WatchUniPagesJsonFromUpwSourceOptions,
} from './compiler/upw-to-uni.js';
export type {
  ExtractUpwSourceFromUniPagesJsonOptions,
  ExtractUpwSourceFromUniPagesJsonResult,
  GeneratedUpwSourceFile,
  GeneratedUpwSourceFileKind,
  InitUpwOptions,
  InitUpwResult,
} from './compiler/uni-to-upw.js';
export type {
  RenderUpwToUniPagesJsonInput,
  RenderUpwWorkspaceData,
} from './compiler/generate/generate-pages-json.js';
export type {
  ProjectPaths,
  ResolveUpwProjectOptions,
  UniAppProjectMode,
} from './config/paths.js';
