import path from 'node:path';

import type { UpwAppSchema, UpwMeta, UpwPageSchema } from '../../schemas/upw.js';
import { UPW_META_KEY, UPW_SUB_PACKAGES_KEY } from '../../schemas/upw.js';
import { UNI_PAGE_PATH_KEY } from '../../schemas/uni-pages.js';
import { validateUpwAppConfig, type ValidatedUpwAppConfig } from '../../validators/upw-app.js';
import type {
  OutputPage,
  RenderUpwWorkspaceData,
  UniPagesJsonRenderWorkspace,
  UpwProjectPageSource,
} from '../types.js';
import {
  isPlatformWorkspaceFile,
  pagePathToWorkspaceFile,
} from '../utils/workspace-paths.js';
import { convertUpwPageFragmentToUniPageEntry } from '../utils/upw-page-fragments.js';
import {
  readSubPackages,
  relativeSubPackagePath,
  sortMainPageEntries,
  sortSubPackagePageEntries,
} from '../analyze/analyze-upw-workspace.js';

function createOutputPage(options: {
  page: Record<string, unknown>;
  meta?: UpwMeta;
  sourceFile?: string;
  readOrder: number;
  isPlatformPage?: boolean;
}): OutputPage {
  return {
    page: options.page,
    ...(options.meta ? { meta: options.meta } : {}),
    ...(options.sourceFile ? { sourceFile: options.sourceFile } : {}),
    readOrder: options.readOrder,
    isPlatformPage: options.isPlatformPage ?? false,
  };
}

function stripSubPackageMeta(meta: UpwMeta | undefined): UpwMeta | undefined {
  if (!meta) {
    return undefined;
  }

  const { subPackageName: _subPackageName, ...rest } = meta;

  return Object.keys(rest).length > 0 ? rest : undefined;
}

function validateFilePath(sourceDir: string, filePath: string, pagePath: string): void {
  const expected = pagePathToWorkspaceFile(sourceDir, pagePath);

  if (path.resolve(filePath) !== path.resolve(expected)) {
    throw new Error(`${filePath} does not match page path "${pagePath}". Expected ${expected}.`);
  }
}

function addValidatedPageToGroups(options: {
  page: Record<string, unknown>;
  meta?: UpwMeta;
  sourceFile?: string;
  readOrder: number;
  isPlatformPage?: boolean;
  label: string;
  appFileLabel?: string;
  subPackageMap: Map<string, ReturnType<typeof readSubPackages>[number]>;
  mainPages: OutputPage[];
  platformPages: OutputPage[];
  subPackagePages: Map<string, OutputPage[]>;
}): void {
  const outputPage = options.page;

  if (options.isPlatformPage) {
    options.platformPages.push(
      createOutputPage({
        page: outputPage,
        meta: options.meta,
        sourceFile: options.sourceFile,
        readOrder: options.readOrder,
        isPlatformPage: true,
      }),
    );
    return;
  }

  if (options.meta?.subPackageName) {
    const subPackage = options.subPackageMap.get(options.meta.subPackageName);

    if (!subPackage) {
      const source = options.appFileLabel
        ? `Define it in ${options.appFileLabel} ${UPW_SUB_PACKAGES_KEY}.`
        : '';

      throw new Error(
        `${options.label} references unknown ${UPW_META_KEY}.subPackageName "${options.meta.subPackageName}".${source ? ` ${source}` : ''}`,
      );
    }

    const { [UNI_PAGE_PATH_KEY]: _path, ...rest } = outputPage;
    const entryGroup = options.subPackagePages.get(options.meta.subPackageName) ?? [];
    const relativePage = {
      ...rest,
      [UNI_PAGE_PATH_KEY]: relativeSubPackagePath(
        options.page[UNI_PAGE_PATH_KEY] as string,
        subPackage,
      ),
    };

    entryGroup.push(
      createOutputPage({
        page: relativePage,
        meta: stripSubPackageMeta(options.meta),
        sourceFile: options.sourceFile,
        readOrder: options.readOrder,
      }),
    );
    options.subPackagePages.set(options.meta.subPackageName, entryGroup);
    return;
  }

  options.mainPages.push(
    createOutputPage({
      page: outputPage,
      meta: options.meta,
      sourceFile: options.sourceFile,
      readOrder: options.readOrder,
    }),
  );
}

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
  const mainPages: OutputPage[] = [];
  const platformPages: OutputPage[] = [];
  const subPackagePages = new Map<string, OutputPage[]>();

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
      mainPages,
      platformPages,
      subPackagePages,
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
      mainPages,
      platformPages,
      subPackagePages,
    });
  }

  return buildRenderWorkspace({
    app: data.app,
    appValidation,
    label,
    mainPages,
    platformPages,
    subPackagePages,
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
  const mainPages: OutputPage[] = [];
  const platformPages: OutputPage[] = [];
  const subPackagePages = new Map<string, OutputPage[]>();

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

    validateFilePath(options.sourceDir, source.file, config[UNI_PAGE_PATH_KEY] as string);

    addValidatedPageToGroups({
      page: config,
      meta,
      sourceFile: source.file,
      readOrder: source.readOrder,
      isPlatformPage,
      label: source.file,
      appFileLabel: options.appFile,
      subPackageMap,
      mainPages,
      platformPages,
      subPackagePages,
    });
  }

  return buildRenderWorkspace({
    app: options.app,
    appValidation,
    label: options.appFile,
    mainPages,
    platformPages,
    subPackagePages,
  });
}

export { stripUpwMeta, convertUpwAppFragmentToUniObject } from '../utils/upw-page-fragments.js';
