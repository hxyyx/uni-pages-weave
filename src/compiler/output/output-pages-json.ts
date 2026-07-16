import fs from 'fs-extra';

import { DEFAULT_TEXT_ENCODING } from '../../schemas/uni-pages.js';
import type { UpwProjectPageSource } from '../types.js';
import {
  type BuildUniPagesJsonFromUpwSourceContext,
  type BuildUniPagesJsonFromUpwSourceOptions,
  readAppConfig,
  readPageConfig,
  resolveUpwToUniContext,
} from '../load/load-upw-workspace.js';
import { renderUniPagesJsonWithConditionComments } from '../generate/generate-pages-json.js';
import { appUpwFile, ensureParentDir } from '../utils/workspace-paths.js';
import { buildUniPagesJsonWorkspaceFromUpwProject } from '../transform/upw-to-uni-workspace.js';

export interface BuildUniPagesJsonFromUpwSourceResult {
  pages: Record<string, unknown>[];
}

export function runUpwToUniBuild(
  context: BuildUniPagesJsonFromUpwSourceContext,
): BuildUniPagesJsonFromUpwSourceResult {
  const { files, output, sourceDir } = context;
  const appFile = appUpwFile(sourceDir);
  const app = readAppConfig(sourceDir);
  const pageSources: UpwProjectPageSource[] = files.map((file, readOrder) => ({
    data: readPageConfig(file),
    file,
    readOrder,
  }));
  const workspace = buildUniPagesJsonWorkspaceFromUpwProject({
    app,
    appFile,
    pageSources,
    sourceDir,
  });
  const content = renderUniPagesJsonWithConditionComments(
    workspace.app,
    workspace.appPatches,
    workspace.pages,
    workspace.subPackages,
    workspace.subPackagePages,
  );
  const pages = workspace.pages.map((entry) => entry.page);

  ensureParentDir(output);
  fs.writeFileSync(output, content, DEFAULT_TEXT_ENCODING);

  return { pages };
}

export function buildUniPagesJsonFromUpwSource(
  options: BuildUniPagesJsonFromUpwSourceOptions,
): BuildUniPagesJsonFromUpwSourceResult {
  return runUpwToUniBuild(resolveUpwToUniContext(options));
}
