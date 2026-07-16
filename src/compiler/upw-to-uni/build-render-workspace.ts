import type { UpwAppSchema, UpwPageSchema } from '../../schemas/upw.js';
import { UPW_META_KEY } from '../../schemas/upw.js';
import { validateUpwAppConfig, type ValidatedUpwAppConfig } from '../../validators/upw-app.js';
import type {
  OutputPage,
  RenderUpwWorkspaceData,
  UniPagesJsonRenderWorkspace,
  UpwProjectPageSource,
} from '../types.js';
import { isPlatformWorkspaceFile } from '../utils/workspace-paths.js';
import { convertUpwPageFragmentToUniPageEntry } from '../utils/upw-page-fragments.js';
import {
  readSubPackages,
  sortMainPageEntries,
  sortSubPackagePageEntries,
} from '../analyze/analyze-upw-workspace.js';
import { addValidatedPageToGroups, createPageGroups } from './page-groups.js';
import { validatePageSourcePath } from './validate-page-source.js';

function buildRenderWorkspace(options: {
  app: UpwAppSchema;
  appValidation: ValidatedUpwAppConfig;
  label: string;
  mainPages: OutputPage[];
  platformPages: OutputPage[];
  subPackagePages: Map<string, OutputPage[]>;
}): UniPagesJsonRenderWorkspace {
  const subPackages = readSubPackages(options.app);
  const orderedPageEntries = sortMainPageEntries(
    options.app,
    options.mainPages,
    options.platformPages,
    options.appValidation.homePath,
    options.label,
  );

  return {
    app: options.app,
    appPatches: options.appValidation.patches ?? [],
    pages: orderedPageEntries,
    subPackages,
    subPackagePages: sortSubPackagePageEntries(options.subPackagePages),
  };
}

export function buildUniPagesJsonWorkspaceFromUpwData(
  data: RenderUpwWorkspaceData,
  label: string,
): UniPagesJsonRenderWorkspace {
  const appValidation = validateUpwAppConfig(data.app, { label });
  const subPackages = readSubPackages(data.app);
  const subPackageMap = new Map(subPackages.map((subPackage) => [subPackage.name, subPackage]));
  const groups = createPageGroups();

  for (const [index, page] of data.pages.entries()) {
    const { page: config, meta } = convertUpwPageFragmentToUniPageEntry(page, {
      label: `${label}.pages[${index}]`,
    });

    addValidatedPageToGroups({
      page: config,
      meta,
      readOrder: index,
      label: `${label}.pages[${index}]`,
      subPackageMap,
      groups,
    });
  }

  const platformOffset = data.pages.length;

  for (const [index, page] of (data.platformPages ?? []).entries()) {
    const { page: config, meta } = convertUpwPageFragmentToUniPageEntry(page, {
      forbidUpw: true,
      forbidUpwMessage: `${label}.platformPages[${index}] cannot define ${UPW_META_KEY}.`,
      label: `${label}.platformPages[${index}]`,
    });

    addValidatedPageToGroups({
      page: config,
      meta,
      readOrder: platformOffset + index,
      isPlatformPage: true,
      label: `${label}.platformPages[${index}]`,
      subPackageMap,
      groups,
    });
  }

  return buildRenderWorkspace({
    app: data.app,
    appValidation,
    label,
    mainPages: groups.mainPages,
    platformPages: groups.platformPages,
    subPackagePages: groups.subPackagePages,
  });
}

export function buildUniPagesJsonWorkspaceFromUpwProject(options: {
  app: UpwAppSchema;
  appFile: string;
  pageSources: UpwProjectPageSource[];
  sourceDir: string;
}): UniPagesJsonRenderWorkspace {
  const appValidation = validateUpwAppConfig(options.app, { label: options.appFile });
  const subPackages = readSubPackages(options.app);
  const subPackageMap = new Map(subPackages.map((subPackage) => [subPackage.name, subPackage]));
  const groups = createPageGroups();

  for (const source of options.pageSources) {
    const isPlatformPage = isPlatformWorkspaceFile(options.sourceDir, source.file);
    const { page: config, meta } = convertUpwPageFragmentToUniPageEntry(
      source.data as UpwPageSchema,
      {
        forbidUpw: isPlatformPage,
        forbidUpwMessage: `${source.file} cannot define ${UPW_META_KEY} because platform-specific upw files cannot contain upw metadata.`,
        label: source.file,
      },
    );

    validatePageSourcePath(options.sourceDir, source.file, config);

    addValidatedPageToGroups({
      page: config,
      meta,
      sourceFile: source.file,
      readOrder: source.readOrder,
      isPlatformPage,
      label: source.file,
      appFileLabel: options.appFile,
      subPackageMap,
      groups,
    });
  }

  return buildRenderWorkspace({
    app: options.app,
    appValidation,
    label: options.appFile,
    mainPages: groups.mainPages,
    platformPages: groups.platformPages,
    subPackagePages: groups.subPackagePages,
  });
}

export { stripUpwMeta, convertUpwAppFragmentToUniObject } from '../utils/upw-page-fragments.js';
