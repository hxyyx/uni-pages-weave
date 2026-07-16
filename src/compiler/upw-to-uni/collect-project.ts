import type { UpwAppSchema } from '../../schemas/upw.js';
import type { UpwProjectPageSource } from '../types.js';
import {
  type BuildUniPagesJsonFromUpwSourceContext,
  readAppConfig,
  readPageConfig,
} from '../load/load-upw-workspace.js';
import { appUpwFile } from '../utils/workspace-paths.js';

export interface CollectedUpwProject {
  app: UpwAppSchema;
  appFile: string;
  pageSources: UpwProjectPageSource[];
  sourceDir: string;
}

export function collectUpwProjectSources(
  context: BuildUniPagesJsonFromUpwSourceContext,
): CollectedUpwProject {
  const { files, sourceDir } = context;
  const appFile = appUpwFile(sourceDir);
  const app = readAppConfig(sourceDir);
  const pageSources: UpwProjectPageSource[] = files.map((file, readOrder) => ({
    data: readPageConfig(file),
    file,
    readOrder,
  }));

  return {
    app,
    appFile,
    pageSources,
    sourceDir,
  };
}
