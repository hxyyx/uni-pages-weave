import uniq from 'lodash-es/uniq.js';

import type {
  AppConditionPatch,
  ConditionBlock,
  ConditionNode,
  ConditionalChildPatch,
  ConditionalPatch,
  PageConditionPatch,
  UpwAppSchema,
  UpwMeta,
  UpwPageSchema,
  UpwSubPackage,
} from '../spec/upw-spec.js';
import { UPW_META_KEY } from '../spec/upw-spec.js';
import {
  UNI_PAGES_KEY,
  UNI_PAGE_PATH_KEY,
  UNI_SUB_PACKAGES_KEY,
  UNI_SUB_PACKAGE_NAME_KEY,
  UNI_SUB_PACKAGE_ROOT_KEY,
} from '../spec/uni-pages-spec.js';
import {
  conditionsToUpwMeta,
  effectiveConditions,
  normalizePlatformEnv,
} from '../condition/condition-platform.js';
import { deepMerge, isPlainObject } from '../foundation/object.js';
import {
  convertUniAppFragmentToUpwApp,
  convertUniPageFragmentToUpwPage,
} from '../fragment/uni-to-upw-fragments.js';
import type { ParsedPagesJson } from '../parser/uni-pages-json-parser.js';
import { validateUpwPageConfig } from '../rules/upw-page-rules.js';
import {
  appUpwFile,
  isPlatformPagePath,
  normalizePagePath,
  pagePathToWorkspaceFile,
} from './upw-workspace-paths.js';

export interface UpwWorkspaceAppFile {
  config: UpwAppSchema;
  path: string;
}

export interface UpwWorkspacePageFile {
  config: UpwPageSchema;
  forbidUpw: boolean;
  pagePath: string;
  path: string;
}

export interface UpwWorkspaceFiles {
  appFile: UpwWorkspaceAppFile;
  pageFiles: UpwWorkspacePageFile[];
}

interface SubPackageConfig extends UpwSubPackage {
  pages?: unknown;
}

interface SplitPage {
  page: Record<string, unknown>;
  upw?: UpwMeta;
}

interface RawSubPackageConfig extends Record<string, unknown> {
  root: string;
  name?: unknown;
  pages?: unknown;
}

function pagePath(value: unknown): string | undefined {
  return isPlainObject(value) && typeof value[UNI_PAGE_PATH_KEY] === 'string'
    ? value[UNI_PAGE_PATH_KEY]
    : undefined;
}

function normalizeSubPackageName(root: string): string {
  return normalizePagePath(root).replace(/\/{2,}/gu, '/');
}

function rawSubPackageValues(data: Record<string, unknown>): { key: string; values: unknown[] } {
  const value = data[UNI_SUB_PACKAGES_KEY];

  if (value === undefined) {
    return { key: UNI_SUB_PACKAGES_KEY, values: [] };
  }

  if (!Array.isArray(value)) {
    throw new Error(`${UNI_SUB_PACKAGES_KEY} must be an array.`);
  }

  return { key: UNI_SUB_PACKAGES_KEY, values: value };
}

function rawSubPackageConfig(value: unknown, label: string): RawSubPackageConfig {
  if (!isPlainObject(value) || typeof value[UNI_SUB_PACKAGE_ROOT_KEY] !== 'string') {
    throw new Error(`${label} must be a subPackage object with a string root.`);
  }

  return value as RawSubPackageConfig;
}

export function readUniPagesSubPackages(data: Record<string, unknown>): SubPackageConfig[] {
  const { key, values } = rawSubPackageValues(data);

  return values.map((value, index) => {
    const item = rawSubPackageConfig(value, `${key}[${index}]`);

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

function conditionGroupKey(conditions: ConditionNode[] = []): string {
  return conditions
    .map(
      (condition) => `${condition.directive}:${condition.env.map(normalizePlatformEnv).join('||')}`,
    )
    .join('&&');
}

function sameCondition(left: ConditionNode, right: ConditionNode): boolean {
  return (
    left.directive === right.directive &&
    left.env.length === right.env.length &&
    left.env.every(
      (env, index) => normalizePlatformEnv(env) === normalizePlatformEnv(right.env[index] ?? ''),
    )
  );
}

function isConditionPrefix(prefix: ConditionNode[], conditions: ConditionNode[]): boolean {
  return (
    prefix.length < conditions.length &&
    prefix.every((condition, index) => sameCondition(condition, conditions[index]))
  );
}

function canMergePatch(base: Record<string, unknown>, override: Record<string, unknown>): boolean {
  return Object.entries(override).every(([key, value]) => {
    const current = base[key];

    return current === undefined || (isPlainObject(current) && isPlainObject(value));
  });
}

function externalConditionMeta(
  conditions: ConditionNode[],
): Pick<UpwMeta, 'conditions' | 'when' | 'unless'> {
  if (conditions.length > 2) {
    throw new Error('Nested conditional compilation supports at most two consecutive directives.');
  }

  return conditionsToUpwMeta(conditions);
}

function externalConditionKey(meta: Pick<UpwMeta, 'conditions' | 'when' | 'unless'>): string {
  return conditionGroupKey(effectiveConditions(meta));
}

function mergeRawConditionPatches<
  TPatch extends { conditions: ConditionNode[]; patch: Record<string, unknown> },
>(patches: TPatch[]): TPatch[] {
  return patches.reduce<TPatch[]>((merged, patch) => {
    const key = conditionGroupKey(patch.conditions);
    const target = merged.find(
      (item) =>
        conditionGroupKey(item.conditions) === key && canMergePatch(item.patch, patch.patch),
    );

    if (!target) {
      merged.push(patch);
      return merged;
    }

    target.patch = deepMerge(target.patch, patch.patch);

    return merged;
  }, []);
}

function mergeConditionalChildPatch(
  children: ConditionalChildPatch[],
  child: ConditionalChildPatch,
): void {
  const key = externalConditionKey(child);
  const target = children.find(
    (item) => externalConditionKey(item) === key && canMergePatch(item.patch, child.patch),
  );

  if (!target) {
    children.push(child);
    return;
  }

  target.patch = deepMerge(target.patch, child.patch);
}

function mergeConditionalPatch(
  patches: ConditionalPatch[],
  patch: ConditionalPatch,
): ConditionalPatch {
  const key = externalConditionKey(patch);
  const target = patches.find(
    (item) => externalConditionKey(item) === key && canMergePatch(item.patch, patch.patch),
  );

  if (!target) {
    patches.push(patch);
    return patch;
  }

  target.patch = deepMerge(target.patch, patch.patch);

  for (const child of patch.children ?? []) {
    const children = target.children ?? [];

    mergeConditionalChildPatch(children, child);
    target.children = children;
  }

  return target;
}

function conditionPatchesToUpwPatches<
  TPatch extends { conditions: ConditionNode[]; patch: Record<string, unknown> },
>(patches: TPatch[]): ConditionalPatch[] {
  const rawPatches = mergeRawConditionPatches(patches).sort(
    (left, right) => left.conditions.length - right.conditions.length,
  );
  const roots: Array<{ raw: TPatch; patch: ConditionalPatch }> = [];
  const output: ConditionalPatch[] = [];

  for (const raw of rawPatches) {
    const parent = roots
      .filter((candidate) => isConditionPrefix(candidate.raw.conditions, raw.conditions))
      .sort((left, right) => right.raw.conditions.length - left.raw.conditions.length)[0];

    if (parent) {
      const relativeConditions = raw.conditions.slice(parent.raw.conditions.length);
      const child: ConditionalChildPatch = {
        ...externalConditionMeta(relativeConditions),
        patch: raw.patch,
      };
      const children = parent.patch.children ?? [];

      mergeConditionalChildPatch(children, child);
      parent.patch.children = children;
      continue;
    }

    const patch: ConditionalPatch = {
      ...externalConditionMeta(raw.conditions),
      patch: raw.patch,
    };

    roots.push({ raw, patch: mergeConditionalPatch(output, patch) });
  }

  return output;
}

function appPatchesForConfig(patches: AppConditionPatch[]): NonNullable<UpwMeta['patches']> {
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
  subPackages: SubPackageConfig[],
  root?: string,
): SubPackageConfig | undefined {
  if (!root) {
    return undefined;
  }

  const normalized = normalizePagePath(root).replace(/\/{2,}/gu, '/');

  return subPackages.find(
    (subPackage) => normalizePagePath(subPackage.root).replace(/\/{2,}/gu, '/') === normalized,
  );
}

function conditionalPages(blocks: ConditionBlock[], subPackages: SubPackageConfig[]): SplitPage[] {
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

function patchPagePath(patch: PageConditionPatch, subPackages: SubPackageConfig[]): string {
  const subPackage = subPackageForRoot(subPackages, patch.subPackageRoot);

  return subPackage
    ? fullSubPackagePath(subPackage.root, patch.pagePath)
    : normalizePagePath(patch.pagePath).replace(/\/{2,}/gu, '/');
}

function patchesForPage(
  patches: PageConditionPatch[],
  subPackages: SubPackageConfig[],
  path: string,
): NonNullable<UpwMeta['patches']> {
  const normalizedPath = normalizePagePath(path).replace(/\/{2,}/gu, '/');

  return conditionPatchesToUpwPatches(
    patches.filter((patch) => patchPagePath(patch, subPackages) === normalizedPath),
  );
}

function pageEntries(value: unknown, label: string): Record<string, unknown>[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value.map((page, index) => {
    if (!isPlainObject(page) || typeof page[UNI_PAGE_PATH_KEY] !== 'string') {
      throw new Error(`${label}[${index}] must be a page object with a string path.`);
    }

    return page;
  });
}

function basePages(data: Record<string, unknown>, subPackages: SubPackageConfig[]): SplitPage[] {
  const pages = pageEntries(data[UNI_PAGES_KEY], UNI_PAGES_KEY).map((page) => ({
    page,
  }));
  const subPackagePages = subPackages.flatMap((subPackage) =>
    pageEntries(
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

export function buildUpwWorkspaceFilesFromUniPagesJson(
  parsed: ParsedPagesJson,
  output: string,
): UpwWorkspaceFiles {
  const pagesJson = parsed.data;
  const subPackages = readUniPagesSubPackages(pagesJson);
  const appPatches = appPatchesForConfig(parsed.appConditionPatches);
  const appFile: UpwWorkspaceAppFile = {
    path: appUpwFile(output),
    config: convertUniAppFragmentToUpwApp(pagesJson, {
      appPatches,
      subPackages,
    }),
  };
  const pageFiles: UpwWorkspacePageFile[] = [];

  for (const entry of [
    ...basePages(pagesJson, subPackages),
    ...conditionalPages(parsed.conditionBlocks, subPackages),
  ]) {
    const path = pagePath(entry.page);

    if (!path) {
      continue;
    }

    const outputFile = pagePathToWorkspaceFile(output, path);
    const forbidUpw = isPlatformPagePath(path);
    const patches = forbidUpw ? [] : patchesForPage(parsed.conditionPatches, subPackages, path);
    const upw = forbidUpw
      ? undefined
      : mergeUpwMeta(entry.upw, patches.length > 0 ? { patches } : undefined);
    const config = convertUniPageFragmentToUpwPage(entry.page, upw);

    validateUpwPageConfig(config, {
      forbidUpw,
      forbidUpwMessage: `${outputFile} cannot define ${UPW_META_KEY} because platform-specific upw files cannot contain upw metadata.`,
      label: `Page "${path}"`,
    });

    pageFiles.push({
      config,
      forbidUpw,
      pagePath: path,
      path: outputFile,
    });
  }

  return { appFile, pageFiles };
}
