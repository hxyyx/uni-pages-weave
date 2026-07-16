import type { UpwMeta } from '../../schemas/upw.js';
import { UPW_META_KEY } from '../../schemas/upw.js';
import { UNI_PAGE_PATH_KEY } from '../../schemas/uni-pages.js';
import { isPlainObject } from '../../utils/object.js';
import { validateUpwAppConfig } from '../../validators/upw-app.js';
import { validateUpwPageConfig } from '../../validators/upw-page.js';
import type {
  ParsedUniPagesJson,
  UniPagesAnalysis,
  UpwWorkspaceFiles,
  UpwWorkspacePageFile,
} from '../types.js';
import {
  appUpwFile,
  isPlatformPagePath,
  pagePathToWorkspaceFile,
} from '../utils/workspace-paths.js';
import {
  convertUniAppFragmentToUpwApp,
  convertUniPageFragmentToUpwPage,
} from '../utils/uni-page-fragments.js';
import {
  analyzeUniPagesJson,
  mergeUniPageUpwMeta,
  pagePatchesForPath,
} from '../analyze/analyze-uni-pages.js';
import { assertUnconditionalMainHomePage } from '../analyze/pages-json-format.js';

function pagePath(value: unknown): string | undefined {
  return isPlainObject(value) && typeof value[UNI_PAGE_PATH_KEY] === 'string'
    ? value[UNI_PAGE_PATH_KEY]
    : undefined;
}

export function composeUpwWorkspace(
  analysis: UniPagesAnalysis,
  output: string,
): UpwWorkspaceFiles {
  assertUnconditionalMainHomePage(analysis.data);

  const appFile = {
    path: appUpwFile(output),
    config: convertUniAppFragmentToUpwApp(analysis.data, {
      appPatches: analysis.appPatches,
      subPackages: analysis.subPackages,
    }),
  };
  const pageFiles: UpwWorkspacePageFile[] = [];

  for (const entry of [...analysis.pages, ...analysis.conditionalPages]) {
    const path = pagePath(entry.page);

    if (!path) {
      continue;
    }

    const outputFile = pagePathToWorkspaceFile(output, path);
    const forbidUpw = isPlatformPagePath(path);
    const patches = forbidUpw
      ? []
      : pagePatchesForPath(analysis.pagePatches, analysis.subPackages, path);
    const upw: UpwMeta | undefined = forbidUpw
      ? undefined
      : mergeUniPageUpwMeta(entry.upw, patches.length > 0 ? { patches } : undefined);
    const config = convertUniPageFragmentToUpwPage(entry.page, upw);

    pageFiles.push({
      config,
      forbidUpw,
      pagePath: path,
      path: outputFile,
    });
  }

  return { appFile, pageFiles };
}

export function validateGeneratedUpwWorkspace(workspace: UpwWorkspaceFiles): void {
  validateUpwAppConfig(workspace.appFile.config, { label: workspace.appFile.path });

  for (const file of workspace.pageFiles) {
    validateUpwPageConfig(file.config, {
      forbidUpw: file.forbidUpw,
      forbidUpwMessage: `${file.path} cannot define ${UPW_META_KEY} because platform-specific upw files cannot contain upw metadata.`,
      label: `Page "${file.pagePath}"`,
    });
  }
}

export function buildUpwWorkspaceFilesFromUniPagesJson(
  parsed: ParsedUniPagesJson,
  output: string,
): UpwWorkspaceFiles {
  const analysis = analyzeUniPagesJson(parsed);
  const workspace = composeUpwWorkspace(analysis, output);

  validateGeneratedUpwWorkspace(workspace);

  return workspace;
}
