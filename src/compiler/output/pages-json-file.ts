import fs from 'fs-extra';

import { DEFAULT_TEXT_ENCODING } from '../../schemas/uni-pages.js';
import {
  type BuildUniPagesJsonFromUpwSourceContext,
  type BuildUniPagesJsonFromUpwSourceOptions,
  resolveUpwToUniContext,
} from '../load/load-upw-workspace.js';
import { renderUniPagesJsonWithConditionComments } from '../generate/pages-json.js';
import { ensureParentDir } from '../utils/workspace-paths.js';
import { buildUniPagesJsonWorkspaceFromUpwProject } from '../upw-to-uni/build-render-workspace.js';
import { collectUpwProjectSources } from '../upw-to-uni/collect-project.js';

export interface BuildUniPagesJsonFromUpwSourceResult {
  pages: Record<string, unknown>[];
}

export function runUpwToUniBuild(
  context: BuildUniPagesJsonFromUpwSourceContext,
): BuildUniPagesJsonFromUpwSourceResult {
  const { output } = context;
  const workspace = buildUniPagesJsonWorkspaceFromUpwProject(collectUpwProjectSources(context));
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
