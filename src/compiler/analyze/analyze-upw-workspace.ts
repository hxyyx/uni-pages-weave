import { UPW_HOME_PATH_KEY, UPW_SUB_PACKAGES_KEY } from '../../schemas/upw.js';
import {
  UNI_PAGE_PATH_KEY,
  UNI_SUB_PACKAGE_NAME_KEY,
  UNI_SUB_PACKAGE_ROOT_KEY,
} from '../../schemas/uni-pages.js';
import { normalizePlatformEnv } from '../../conditions/platform.js';
import { isPlainObject } from '../../utils/object.js';
import type { BuildSubPackage, OutputPage } from '../types.js';
import { normalizePagePath } from '../utils/workspace-paths.js';

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
  return Boolean(
    entry.meta?.conditions?.length || entry.meta?.when?.length || entry.meta?.unless?.length,
  );
}

function normalizedEntryPath(entry: OutputPage): string {
  return normalizePagePath(pagePathForMessage(entry));
}

function normalizedPlatformSet(values: string[]): string {
  return Array.from(new Set(values.map((value) => normalizePlatformEnv(value))))
    .sort()
    .join('|');
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

  const remainingPages = mainPages.filter(
    (entry) => !selectedPaths.has(normalizedEntryPath(entry)),
  );
  const sortedRemainingPages = sortConditionalPageEntries(remainingPages);
  const stableRemainingPages = sortedRemainingPages.filter(
    (entry) => !isConditionalPageEntry(entry),
  );
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
