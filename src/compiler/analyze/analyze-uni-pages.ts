import uniq from 'lodash-es/uniq.js';

import type { ConditionBlock, PageConditionPatch, UpwMeta } from '../../schemas/upw.js';
import {
  UNI_PAGES_KEY,
  UNI_PAGE_PATH_KEY,
  UNI_SUB_PACKAGES_KEY,
  UNI_SUB_PACKAGE_NAME_KEY,
  UNI_SUB_PACKAGE_ROOT_KEY,
} from '../../schemas/uni-pages.js';
import { conditionsToUpwMeta, normalizePlatformEnv } from '../../conditions/platform.js';
import { isPlainObject } from '../../utils/object.js';
import type {
  ParsedUniPagesJson,
  UniPagesAnalysis,
  UniToUpwPageEntry,
  UniToUpwSubPackage,
} from '../types.js';
import { normalizePagePath } from '../utils/workspace-paths.js';
import { conditionPatchesToUpwPatches } from './condition-patches.js';
import {
  readPageEntries,
  readRawSubPackageConfig,
  readRawSubPackageValues,
} from './pages-json-format.js';

function normalizeSubPackageName(root: string): string {
  return normalizePagePath(root).replace(/\/{2,}/gu, '/');
}

export function readUniPagesSubPackages(data: Record<string, unknown>): UniToUpwSubPackage[] {
  const values = readRawSubPackageValues(data);

  return values.map((value, index) => {
    const item = readRawSubPackageConfig(value, `${UNI_SUB_PACKAGES_KEY}[${index}]`);

    return {
      ...item,
      name:
        typeof item[UNI_SUB_PACKAGE_NAME_KEY] === 'string' && item[UNI_SUB_PACKAGE_NAME_KEY].trim()
          ? item[UNI_SUB_PACKAGE_NAME_KEY].trim()
          : normalizeSubPackageName(item[UNI_SUB_PACKAGE_ROOT_KEY]),
      root: normalizePagePath(item[UNI_SUB_PACKAGE_ROOT_KEY]).replace(/\/{2,}/gu, '/'),
    };
  });
}

function externalConditionMeta(
  conditions: ConditionBlock['conditions'],
): Pick<UpwMeta, 'conditions' | 'when' | 'unless'> {
  return conditionsToUpwMeta(conditions);
}

function appPatchesForConfig(patches: ParsedUniPagesJson['appConditionPatches']): NonNullable<
  UpwMeta['patches']
> {
  return conditionPatchesToUpwPatches(patches);
}

function fullSubPackagePath(root: string, path: string): string {
  const normalizedRoot = normalizePagePath(root).replace(/\/{2,}/gu, '/');
  const normalizedPath = normalizePagePath(path).replace(/\/{2,}/gu, '/');

  return normalizedPath.startsWith(`${normalizedRoot}/`)
    ? normalizedPath
    : normalizePagePath(`${normalizedRoot}/${normalizedPath}`).replace(/\/{2,}/gu, '/');
}

function mergeUpwMeta(...items: Array<UpwMeta | undefined>): UpwMeta | undefined {
  const merged: UpwMeta = {};

  for (const item of items) {
    if (!item) {
      continue;
    }

    if (item.subPackageName) {
      merged.subPackageName = item.subPackageName;
    }

    if (item.when?.length) {
      merged.when = uniq([...(merged.when ?? []), ...item.when.map(normalizePlatformEnv)]);
    }

    if (item.unless?.length) {
      merged.unless = uniq([...(merged.unless ?? []), ...item.unless.map(normalizePlatformEnv)]);
    }

    if (item.conditions?.length) {
      merged.conditions = item.conditions;
    }

    if (item.patches?.length) {
      merged.patches = [...(merged.patches ?? []), ...item.patches];
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function subPackageForRoot(
  subPackages: UniToUpwSubPackage[],
  root?: string,
): UniToUpwSubPackage | undefined {
  if (!root) {
    return undefined;
  }

  const normalized = normalizePagePath(root).replace(/\/{2,}/gu, '/');

  return subPackages.find(
    (subPackage) => normalizePagePath(subPackage.root).replace(/\/{2,}/gu, '/') === normalized,
  );
}

function conditionalPages(
  blocks: ConditionBlock[],
  subPackages: UniToUpwSubPackage[],
): UniToUpwPageEntry[] {
  return blocks
    .filter(
      (block) =>
        isPlainObject(block.content) && typeof block.content[UNI_PAGE_PATH_KEY] === 'string',
    )
    .map((block) => {
      const content = block.content as Record<string, unknown>;
      const subPackage = subPackageForRoot(subPackages, block.subPackageRoot);
      const page = subPackage
        ? {
            ...content,
            [UNI_PAGE_PATH_KEY]: fullSubPackagePath(
              subPackage.root,
              content[UNI_PAGE_PATH_KEY] as string,
            ),
          }
        : { ...content };
      const upw = mergeUpwMeta(
        subPackage ? { subPackageName: subPackage.name } : undefined,
        externalConditionMeta(block.conditions),
      );

      return { page, upw };
    });
}

function patchPagePath(patch: PageConditionPatch, subPackages: UniToUpwSubPackage[]): string {
  const subPackage = subPackageForRoot(subPackages, patch.subPackageRoot);

  return subPackage
    ? fullSubPackagePath(subPackage.root, patch.pagePath)
    : normalizePagePath(patch.pagePath).replace(/\/{2,}/gu, '/');
}

function patchesForPage(
  patches: PageConditionPatch[],
  subPackages: UniToUpwSubPackage[],
  path: string,
): NonNullable<UpwMeta['patches']> {
  const normalizedPath = normalizePagePath(path).replace(/\/{2,}/gu, '/');

  return conditionPatchesToUpwPatches(
    patches.filter((patch) => patchPagePath(patch, subPackages) === normalizedPath),
  );
}

function basePages(
  data: Record<string, unknown>,
  subPackages: UniToUpwSubPackage[],
): UniToUpwPageEntry[] {
  const pages = readPageEntries(data[UNI_PAGES_KEY], UNI_PAGES_KEY).map((page) => ({
    page,
  }));
  const subPackagePages = subPackages.flatMap((subPackage) =>
    readPageEntries(
      subPackage[UNI_PAGES_KEY],
      `${UNI_SUB_PACKAGES_KEY} "${subPackage.name}" ${UNI_PAGES_KEY}`,
    ).map((page) => ({
      page: {
        ...page,
        [UNI_PAGE_PATH_KEY]: fullSubPackagePath(subPackage.root, page[UNI_PAGE_PATH_KEY] as string),
      },
      upw: { subPackageName: subPackage.name },
    })),
  );

  return [...pages, ...subPackagePages];
}

export function pagePatchesForPath(
  patches: PageConditionPatch[],
  subPackages: UniToUpwSubPackage[],
  path: string,
): NonNullable<UpwMeta['patches']> {
  return patchesForPage(patches, subPackages, path);
}

export function mergeUniPageUpwMeta(
  ...items: Array<UpwMeta | undefined>
): UpwMeta | undefined {
  return mergeUpwMeta(...items);
}

export function analyzeUniPagesJson(parsed: ParsedUniPagesJson): UniPagesAnalysis {
  const pagesJson = parsed.data;
  const subPackages = readUniPagesSubPackages(pagesJson);

  return {
    appPatches: appPatchesForConfig(parsed.appConditionPatches),
    conditionalPages: conditionalPages(parsed.conditionBlocks, subPackages),
    data: pagesJson,
    pagePatches: parsed.conditionPatches,
    pages: basePages(pagesJson, subPackages),
    subPackages,
  };
}
