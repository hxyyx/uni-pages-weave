import path from 'node:path';

import fs from 'fs-extra';
import uniq from 'lodash-es/uniq.js';

import type {
  AppConditionPatch,
  ConditionNode,
  ConditionBlock,
  ConditionalChildPatch,
  ConditionalPatch,
  PageConditionPatch,
  UpwSubpackage,
  UpwMeta,
} from '../ir/types.js';
import type { UpwAppSchema, UpwPageSchema } from '../schema/upw.js';
import { parsePagesSource } from '../parser/pages-parser.js';
import {
  DEFAULT_TEXT_ENCODING,
  UNI_PAGES_JSON_BACKUP_FILE,
  UNI_PAGES_JSON_FILE,
  UNI_PAGES_KEY,
  UNI_PAGE_PATH_KEY,
  UNI_SUBPACKAGES_COMPAT_KEY,
  UNI_SUBPACKAGES_KEY,
  UNI_SUB_PACKAGE_NAME_KEY,
  UNI_SUB_PACKAGE_ROOT_KEY,
  UPW_HOME_PATH_KEY,
  UPW_META_KEY,
  UPW_META_SUBPACKAGE_KEY,
  UPW_SUBPACKAGES_KEY,
} from '../internal/constants.js';
import { stringifyJson } from '../internal/json.js';
import { deepMerge, isPlainObject } from '../internal/object.js';
import { conditionsToUpwMeta, effectiveConditions, normalizePlatformEnv } from '../utils/platform.js';
import { validateUpwPageConfig } from '../validator/upw-page-validator.js';
import {
  appUpwFile,
  ensureParentDir,
  isPlatformPagePath,
  normalizePagePath,
  pagePathToWorkspaceFile,
} from '../utils/path.js';

export interface ExtractUpwSourceFromUniPagesJsonOptions {
  input: string;
  output: string;
}

export interface ExtractUpwSourceFromUniPagesJsonContext {
  input: string;
  output: string;
}

export interface ExtractUpwSourceFromUniPagesJsonResult {
  files: string[];
}

interface PendingFile {
  path: string;
  content: string;
}

interface PendingPageFile {
  config: UpwPageSchema;
  forbidUpw: boolean;
  pagePath: string;
  path: string;
}

interface SubpackageConfig extends UpwSubpackage {
  pages?: unknown;
}

interface SplitPage {
  page: Record<string, unknown>;
  upw?: UpwMeta;
}

interface RawSubpackageConfig extends Record<string, unknown> {
  root: string;
  name?: unknown;
  pages?: unknown;
}

function pagePath(value: unknown): string | undefined {
  return isPlainObject(value) && typeof value[UNI_PAGE_PATH_KEY] === 'string'
    ? value[UNI_PAGE_PATH_KEY]
    : undefined;
}

export function backupUniPagesJson(input: string): string {
  const backupFile = path.join(path.dirname(input), UNI_PAGES_JSON_BACKUP_FILE);

  fs.copyFileSync(input, backupFile);

  return backupFile;
}

function normalizeSubpackageName(root: string): string {
  return normalizePagePath(root).replace(/\/{2,}/gu, '/');
}

function rawSubpackageValues(data: Record<string, unknown>): { key: string; values: unknown[] } {
  const key = Object.prototype.hasOwnProperty.call(data, UNI_SUBPACKAGES_KEY)
    ? UNI_SUBPACKAGES_KEY
    : UNI_SUBPACKAGES_COMPAT_KEY;
  const value = data[key];

  if (value === undefined) {
    return { key, values: [] };
  }

  if (!Array.isArray(value)) {
    throw new Error(`${key} must be an array.`);
  }

  return { key, values: value };
}

function rawSubpackageConfig(value: unknown, label: string): RawSubpackageConfig {
  if (!isPlainObject(value) || typeof value[UNI_SUB_PACKAGE_ROOT_KEY] !== 'string') {
    throw new Error(`${label} must be a subpackage object with a string root.`);
  }

  return value as RawSubpackageConfig;
}

function readSubpackages(data: Record<string, unknown>): SubpackageConfig[] {
  const { key, values } = rawSubpackageValues(data);

  return values.map((value, index) => {
    const item = rawSubpackageConfig(value, `${key}[${index}]`);

    return {
      ...item,
      name:
        typeof item[UNI_SUB_PACKAGE_NAME_KEY] === 'string' && item[UNI_SUB_PACKAGE_NAME_KEY].trim()
          ? item[UNI_SUB_PACKAGE_NAME_KEY].trim()
          : normalizeSubpackageName(item[UNI_SUB_PACKAGE_ROOT_KEY]),
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

function externalConditionKey(
  meta: Pick<UpwMeta, 'conditions' | 'when' | 'unless'>,
): string {
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

function homePath(data: Record<string, unknown>): string | undefined {
  const pages = data[UNI_PAGES_KEY];

  if (!Array.isArray(pages)) {
    return undefined;
  }

  return pagePath(pages[0]);
}

function appConfig(
  data: Record<string, unknown>,
  subpackages: SubpackageConfig[],
  appPatches: NonNullable<UpwMeta['patches']>,
): UpwAppSchema {
  const {
    [UNI_PAGES_KEY]: _pages,
    [UNI_SUBPACKAGES_KEY]: _uniSubpackages,
    [UNI_SUBPACKAGES_COMPAT_KEY]: _compatSubpackages,
    [UPW_HOME_PATH_KEY]: _homePath,
    [UPW_META_KEY]: _upw,
    ...app
  } = data;
  const appMeta: UpwMeta = {};
  const pageHomePath = homePath(data);

  if (appPatches.length > 0) {
    appMeta.patches = appPatches;
  }

  if (pageHomePath) {
    app[UPW_HOME_PATH_KEY] = pageHomePath;
  }

  if (subpackages.length > 0) {
    app[UPW_SUBPACKAGES_KEY] = subpackages.map(
      ({ [UNI_PAGES_KEY]: _pages, ...subpackage }) => subpackage,
    );
  }

  if (Object.keys(appMeta).length > 0) {
    app[UPW_META_KEY] = appMeta;
  }

  return app as UpwAppSchema;
}

function fullSubpackagePath(root: string, path: string): string {
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

    if (item.subpackageName) {
      merged.subpackageName = item.subpackageName;
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

function externalUpwMeta(upw: UpwMeta): Record<string, unknown> {
  const { subpackageName, ...rest } = upw;

  return {
    ...(subpackageName ? { [UPW_META_SUBPACKAGE_KEY]: subpackageName } : {}),
    ...rest,
  };
}

function withUpwMeta(page: Record<string, unknown>, upw?: UpwMeta): UpwPageSchema {
  const output = upw ? { [UPW_META_KEY]: externalUpwMeta(upw), ...page } : { ...page };

  return output as UpwPageSchema;
}

function subpackageForRoot(
  subpackages: SubpackageConfig[],
  root?: string,
): SubpackageConfig | undefined {
  if (!root) {
    return undefined;
  }

  const normalized = normalizePagePath(root).replace(/\/{2,}/gu, '/');

  return subpackages.find(
    (subpackage) => normalizePagePath(subpackage.root).replace(/\/{2,}/gu, '/') === normalized,
  );
}

function conditionalPages(blocks: ConditionBlock[], subpackages: SubpackageConfig[]): SplitPage[] {
  return blocks
    .filter(
      (block) =>
        isPlainObject(block.content) && typeof block.content[UNI_PAGE_PATH_KEY] === 'string',
    )
    .map((block) => {
      const content = block.content as Record<string, unknown>;
      const subpackage = subpackageForRoot(subpackages, block.subpackageRoot);
      const page = subpackage
        ? {
            ...content,
            [UNI_PAGE_PATH_KEY]: fullSubpackagePath(
              subpackage.root,
              content[UNI_PAGE_PATH_KEY] as string,
            ),
          }
        : { ...content };
      const upw = mergeUpwMeta(
        subpackage ? { subpackageName: subpackage.name } : undefined,
        externalConditionMeta(block.conditions),
      );

      return { page, upw };
    });
}

function patchPagePath(patch: PageConditionPatch, subpackages: SubpackageConfig[]): string {
  const subpackage = subpackageForRoot(subpackages, patch.subpackageRoot);

  return subpackage
    ? fullSubpackagePath(subpackage.root, patch.pagePath)
    : normalizePagePath(patch.pagePath).replace(/\/{2,}/gu, '/');
}

function patchesForPage(
  patches: PageConditionPatch[],
  subpackages: SubpackageConfig[],
  path: string,
): NonNullable<UpwMeta['patches']> {
  const normalizedPath = normalizePagePath(path).replace(/\/{2,}/gu, '/');

  return conditionPatchesToUpwPatches(
    patches.filter((patch) => patchPagePath(patch, subpackages) === normalizedPath),
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

function basePages(data: Record<string, unknown>, subpackages: SubpackageConfig[]): SplitPage[] {
  const pages = pageEntries(data[UNI_PAGES_KEY], UNI_PAGES_KEY).map((page) => ({
    page,
  }));
  const subpackagePages = subpackages.flatMap((subpackage) =>
    pageEntries(
      subpackage[UNI_PAGES_KEY],
      `${UNI_SUBPACKAGES_KEY} "${subpackage.name}" ${UNI_PAGES_KEY}`,
    ).map((page) => ({
      page: {
        ...page,
        [UNI_PAGE_PATH_KEY]: fullSubpackagePath(subpackage.root, page[UNI_PAGE_PATH_KEY] as string),
      },
      upw: { subpackageName: subpackage.name },
    })),
  );

  return [...pages, ...subpackagePages];
}

export function resolveUniToUpwContext(
  options: ExtractUpwSourceFromUniPagesJsonOptions,
): ExtractUpwSourceFromUniPagesJsonContext {
  const { input, output } = options;

  if (!fs.existsSync(input)) {
    throw new Error(`No ${UNI_PAGES_JSON_FILE} found at ${input}.`);
  }

  return {
    input,
    output,
  };
}

function runUniToUpw(
  context: ExtractUpwSourceFromUniPagesJsonContext,
): ExtractUpwSourceFromUniPagesJsonResult {
  const { input, output } = context;
  const parsed = parsePagesSource(input);
  const pagesJson = parsed.data;
  const subpackages = readSubpackages(pagesJson);
  const appPatches = appPatchesForConfig(parsed.appConditionPatches);
  const files: string[] = [];
  const appFile = appUpwFile(output);
  const pendingAppFile: PendingFile = {
    path: appFile,
    content: stringifyJson(appConfig(pagesJson, subpackages, appPatches)),
  };
  const pendingPageFiles: PendingPageFile[] = [];

  for (const entry of [
    ...basePages(pagesJson, subpackages),
    ...conditionalPages(parsed.conditionBlocks, subpackages),
  ]) {
    const path = pagePath(entry.page);

    if (!path) {
      continue;
    }

    const outputFile = pagePathToWorkspaceFile(output, path);
    const forbidUpw = isPlatformPagePath(path);
    const patches = forbidUpw ? [] : patchesForPage(parsed.conditionPatches, subpackages, path);
    const upw = forbidUpw
      ? undefined
      : mergeUpwMeta(entry.upw, patches.length > 0 ? { patches } : undefined);

    pendingPageFiles.push({
      config: withUpwMeta(entry.page, upw),
      forbidUpw,
      pagePath: path,
      path: outputFile,
    });
  }

  for (const file of pendingPageFiles) {
    validateUpwPageConfig(file.config, {
      forbidUpw: file.forbidUpw,
      forbidUpwMessage: `${file.path} cannot define ${UPW_META_KEY} because platform-specific UPW files cannot contain UPW metadata.`,
      label: `Page "${file.pagePath}"`,
    });
  }

  const pendingFiles: PendingFile[] = [
    pendingAppFile,
    ...pendingPageFiles.map((file) => ({
      path: file.path,
      content: stringifyJson(file.config),
    })),
  ];

  for (const file of pendingFiles) {
    ensureParentDir(file.path);
    fs.writeFileSync(file.path, file.content, DEFAULT_TEXT_ENCODING);
    files.push(file.path);
  }

  const backupFile = backupUniPagesJson(input);

  files.push(backupFile);

  return { files };
}

export function extractUpwSourceFromUniPagesJson(
  options: ExtractUpwSourceFromUniPagesJsonOptions,
): ExtractUpwSourceFromUniPagesJsonResult {
  return runUniToUpw(resolveUniToUpwContext(options));
}
