import path from 'node:path';

import type {
  UpwAppSchema,
  UpwMeta,
  UpwPageSchema,
  UpwSubPackage,
} from '../spec/upw-spec.js';
import {
  UPW_HOME_PATH_KEY,
  UPW_META_KEY,
  UPW_SUB_PACKAGES_KEY,
} from '../spec/upw-spec.js';
import {
  UNI_PAGE_PATH_KEY,
  UNI_SUB_PACKAGE_NAME_KEY,
  UNI_SUB_PACKAGE_ROOT_KEY,
} from '../spec/uni-pages-spec.js';
import { normalizePlatformEnv } from '../condition/condition-platform.js';
import { isPlainObject } from '../foundation/object.js';
import {
  convertUpwPageFragmentToUniPageEntry,
  stripUpwMeta,
} from '../fragment/upw-to-uni-fragments.js';
import { validateUpwAppConfig, type ValidatedUpwAppConfig } from '../rules/upw-app-rules.js';
import {
  isPlatformWorkspaceFile,
  normalizePagePath,
  pagePathToWorkspaceFile,
} from './upw-workspace-paths.js';

export interface BuildSubPackage extends UpwSubPackage {
  pages?: unknown;
}

export interface OutputPage {
  page: Record<string, unknown>;
  meta?: UpwMeta;
  sourceFile?: string;
  readOrder: number;
  isPlatformPage: boolean;
}

export interface RenderUpwWorkspaceData {
  app: UpwAppSchema;
  pages: UpwPageSchema[];
  platformPages?: UpwPageSchema[];
}

export interface UpwProjectPageSource {
  data: unknown;
  file: string;
  readOrder: number;
}

export interface UniPagesJsonRenderWorkspace {
  app: UpwAppSchema;
  appPatches: NonNullable<UpwMeta['patches']>;
  pages: OutputPage[];
  subPackages: BuildSubPackage[];
  subPackagePages: Map<string, OutputPage[]>;
}

function pagePathForMessage(entry: OutputPage): string {
  const value = entry.page[UNI_PAGE_PATH_KEY];

  return typeof value === 'string' ? value : '(unknown page)';
}

function isBuildSubPackage(value: unknown): value is BuildSubPackage {
  return (
    isPlainObject(value) &&
    typeof value[UNI_SUB_PACKAGE_NAME_KEY] === 'string' &&
    value[UNI_SUB_PACKAGE_NAME_KEY].trim() !== '' &&
    typeof value[UNI_SUB_PACKAGE_ROOT_KEY] === 'string' &&
    value[UNI_SUB_PACKAGE_ROOT_KEY].trim() !== ''
  );
}

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

export function stripUpw(page: UpwPageSchema): Record<string, unknown> {
  return stripUpwMeta(page);
}

export function stripSubPackageMeta(meta: UpwMeta | undefined): UpwMeta | undefined {
  if (!meta) {
    return undefined;
  }

  const { subPackageName: _subPackageName, ...rest } = meta;

  return Object.keys(rest).length > 0 ? rest : undefined;
}

export function readSubPackages(app: Record<string, unknown>): BuildSubPackage[] {
  const values = app[UPW_SUB_PACKAGES_KEY];

  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter(isBuildSubPackage).map((item) => ({
    ...item,
    name: item[UNI_SUB_PACKAGE_NAME_KEY].trim(),
    root: normalizePagePath(item[UNI_SUB_PACKAGE_ROOT_KEY].trim()),
  }));
}

export function relativeSubPackagePath(pagePath: string, subPackage: BuildSubPackage): string {
  const normalizedPagePath = normalizePagePath(pagePath);
  const normalizedRoot = normalizePagePath(subPackage.root);

  if (!normalizedPagePath.startsWith(`${normalizedRoot}/`)) {
    throw new Error(`Page "${pagePath}" is not under subPackage root "${subPackage.root}".`);
  }

  return normalizedPagePath.slice(normalizedRoot.length + 1);
}

export function isConditionalPageEntry(entry: OutputPage): boolean {
  return Boolean(entry.meta?.conditions?.length || entry.meta?.when?.length || entry.meta?.unless?.length);
}

function normalizedEntryPath(entry: OutputPage): string {
  return normalizePagePath(pagePathForMessage(entry));
}

function normalizedPlatformSet(values: string[]): string {
  return Array.from(new Set(values.map((value) => normalizePlatformEnv(value)))).sort().join('|');
}

function conditionGroupKey(entry: OutputPage, kind: 'when' | 'unless'): string | undefined {
  const values = kind === 'when' ? entry.meta?.when : entry.meta?.unless;

  return values?.length ? `${kind}:${normalizedPlatformSet(values)}` : undefined;
}

function groupedConditionPages(entries: OutputPage[], kind: 'when' | 'unless'): OutputPage[] {
  const groups = new Map<string, OutputPage[]>();

  for (const entry of entries) {
    const key = conditionGroupKey(entry, kind);

    if (!key) {
      continue;
    }

    const group = groups.get(key) ?? [];

    group.push(entry);
    groups.set(key, group);
  }

  return Array.from(groups.values()).flat();
}

export function sortConditionalPageEntries(entries: OutputPage[]): OutputPage[] {
  const stableEntries: OutputPage[] = [];
  const whenEntries: OutputPage[] = [];
  const unlessEntries: OutputPage[] = [];
  const conditionsEntries: OutputPage[] = [];

  for (const entry of entries) {
    if (entry.meta?.conditions?.length) {
      conditionsEntries.push(entry);
      continue;
    }

    if (entry.meta?.when?.length) {
      whenEntries.push(entry);
      continue;
    }

    if (entry.meta?.unless?.length) {
      unlessEntries.push(entry);
      continue;
    }

    stableEntries.push(entry);
  }

  return [
    ...stableEntries,
    ...groupedConditionPages(whenEntries, 'when'),
    ...groupedConditionPages(unlessEntries, 'unless'),
    ...conditionsEntries,
  ];
}

export function orderHomePageFirst(
  entries: OutputPage[],
  homePath: string,
  label: string,
): OutputPage[] {
  const normalizedHomePath = normalizePagePath(homePath);
  const homeIndex = entries.findIndex((entry) => normalizedEntryPath(entry) === normalizedHomePath);

  if (homeIndex < 0) {
    throw new Error(
      `${label}.${UPW_HOME_PATH_KEY} references "${normalizedHomePath}", which is not a main package page in the current build.`,
    );
  }

  return [entries[homeIndex], ...entries.slice(0, homeIndex), ...entries.slice(homeIndex + 1)];
}

function readBaseTabBarPagePaths(app: Record<string, unknown>, label: string): string[] {
  const tabBar = app.tabBar;

  if (tabBar === undefined || !isPlainObject(tabBar)) {
    return [];
  }

  const list = tabBar.list;

  if (list === undefined) {
    return [];
  }

  if (!Array.isArray(list)) {
    throw new Error(`${label}.tabBar.list must be an array.`);
  }

  return list.map((item, index) => {
    const fieldPath = `${label}.tabBar.list[${index}].pagePath`;

    if (!isPlainObject(item) || typeof item.pagePath !== 'string' || item.pagePath.trim() === '') {
      throw new Error(`${fieldPath} must be a non-empty string.`);
    }

    return normalizePagePath(item.pagePath);
  });
}

export function validateBaseTabBar(
  app: Record<string, unknown>,
  entries: OutputPage[],
  homePath: string,
  label: string,
): void {
  const tabBarPagePaths = readBaseTabBarPagePaths(app, label);

  if (tabBarPagePaths.length === 0) {
    return;
  }

  const normalizedHomePath = normalizePagePath(homePath);
  const [firstPagePath] = tabBarPagePaths;

  if (firstPagePath !== normalizedHomePath) {
    throw new Error(`${label}.tabBar.list[0].pagePath must equal ${label}.${UPW_HOME_PATH_KEY}.`);
  }

  const mainPagePaths = new Set(entries.map((entry) => normalizedEntryPath(entry)));

  for (const [index, pagePath] of tabBarPagePaths.entries()) {
    if (!mainPagePaths.has(pagePath)) {
      throw new Error(
        `${label}.tabBar.list[${index}].pagePath references "${pagePath}", which is not a main package page in the current build.`,
      );
    }
  }
}

export function sortMainPageEntries(
  app: Record<string, unknown>,
  mainPages: OutputPage[],
  platformPages: OutputPage[],
  homePath: string,
  label: string,
): OutputPage[] {
  validateBaseTabBar(app, mainPages, homePath, label);

  const normalizedHomePath = normalizePagePath(homePath);
  const entriesByPath = new Map(mainPages.map((entry) => [normalizedEntryPath(entry), entry]));
  const homePage = entriesByPath.get(normalizedHomePath);

  if (!homePage) {
    throw new Error(
      `${label}.${UPW_HOME_PATH_KEY} references "${normalizedHomePath}", which is not a main package page in the current build.`,
    );
  }

  const selectedPaths = new Set<string>();
  const sortedMainPages: OutputPage[] = [];

  function appendSelected(entry: OutputPage): void {
    const entryPath = normalizedEntryPath(entry);

    if (selectedPaths.has(entryPath)) {
      return;
    }

    selectedPaths.add(entryPath);
    sortedMainPages.push(entry);
  }

  appendSelected(homePage);

  for (const pagePath of readBaseTabBarPagePaths(app, label)) {
    const entry = entriesByPath.get(pagePath);

    if (entry) {
      appendSelected(entry);
    }
  }

  const remainingPages = mainPages.filter((entry) => !selectedPaths.has(normalizedEntryPath(entry)));
  const sortedRemainingPages = sortConditionalPageEntries(remainingPages);
  const stableRemainingPages = sortedRemainingPages.filter((entry) => !isConditionalPageEntry(entry));
  const conditionalRemainingPages = sortedRemainingPages.filter(isConditionalPageEntry);

  return [
    ...sortedMainPages,
    ...stableRemainingPages,
    ...platformPages,
    ...conditionalRemainingPages,
  ];
}

export function sortSubPackagePageEntries(
  subPackagePages: Map<string, OutputPage[]>,
): Map<string, OutputPage[]> {
  return new Map(
    Array.from(subPackagePages.entries()).map(([subPackageName, pages]) => [
      subPackageName,
      sortConditionalPageEntries(pages),
    ]),
  );
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
  subPackageMap: Map<string, BuildSubPackage>;
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
    const { page: config, meta } = convertUpwPageFragmentToUniPageEntry(source.data as UpwPageSchema, {
      forbidUpw: isPlatformPage,
      forbidUpwMessage: `${source.file} cannot define ${UPW_META_KEY} because platform-specific UPW files cannot contain UPW metadata.`,
      label: source.file,
    });

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
