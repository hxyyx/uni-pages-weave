import path from 'node:path';

import fs from 'fs-extra';

import type {
  ConditionalChildPatch,
  ConditionalPatch,
  UpwMeta,
  UpwSubpackage,
} from '../ir/types.js';
import type { UpwAppSchema, UpwPageSchema } from '../schema/upw.js';
import {
  emitConditionalMember,
  emitConditionalValue,
  emitValue,
  type ConditionalMeta,
} from './pages-json-conditional-emitter.js';
import { validateUpwAppConfig } from '../validator/upw-app-validator.js';
import { validateUpwPageConfig } from '../validator/upw-page-validator.js';
import {
  DEFAULT_TEXT_ENCODING,
  UNI_PAGES_KEY,
  UNI_PAGE_PATH_KEY,
  UNI_SUBPACKAGES_KEY,
  UNI_SUB_PACKAGE_NAME_KEY,
  UNI_SUB_PACKAGE_ROOT_KEY,
  UPW_HOME_PATH_KEY,
  UPW_APP_FILE,
  UPW_META_KEY,
  UPW_META_SUBPACKAGE_KEY,
  UPW_SUBPACKAGES_KEY,
} from '../internal/constants.js';
import { parseJsonWithComments } from '../internal/json.js';
import { isPlainObject } from '../internal/object.js';
import {
  appUpwFile,
  collectUpwFiles,
  ensureParentDir,
  isPlatformWorkspaceFile,
  normalizePagePath,
  pagePathToWorkspaceFile,
  upwWatchPatterns,
} from '../utils/path.js';

export interface BuildUniPagesJsonFromUpwSourceOptions {
  input: string;
  output: string;
}

export interface BuildUniPagesJsonFromUpwSourceContext {
  files: string[];
  input: string;
  output: string;
  sourceDir: string;
}

export interface BuildUniPagesJsonFromUpwSourceResult {
  pages: Record<string, unknown>[];
}

export interface UpwBuildContext {
  files: string[];
  output: string;
  sourceDir: string;
  watchPatterns: string[];
}

interface BuildSubpackage extends UpwSubpackage {
  pages?: unknown;
}

interface OutputPage {
  page: Record<string, unknown>;
  meta?: UpwMeta;
}

function pagePathForMessage(entry: OutputPage): string {
  const value = entry.page[UNI_PAGE_PATH_KEY];

  return typeof value === 'string' ? value : '(unknown page)';
}

function isBuildSubpackage(value: unknown): value is BuildSubpackage {
  return (
    isPlainObject(value) &&
    typeof value[UNI_SUB_PACKAGE_NAME_KEY] === 'string' &&
    value[UNI_SUB_PACKAGE_NAME_KEY].trim() !== '' &&
    typeof value[UNI_SUB_PACKAGE_ROOT_KEY] === 'string' &&
    value[UNI_SUB_PACKAGE_ROOT_KEY].trim() !== ''
  );
}

function readConfig(filePath: string): unknown {
  return parseJsonWithComments(fs.readFileSync(filePath, DEFAULT_TEXT_ENCODING));
}

function readAppConfig(sourceDir: string): UpwAppSchema {
  const filePath = appUpwFile(sourceDir);

  if (!fs.existsSync(filePath)) {
    throw new Error(`${UPW_APP_FILE} is required under ${sourceDir}.`);
  }

  const config = readConfig(filePath);

  if (!isPlainObject(config)) {
    throw new Error(`${UPW_APP_FILE} must contain an object.`);
  }

  return config as UpwAppSchema;
}

function readPageConfig(filePath: string): unknown {
  const config = readConfig(filePath);

  return config;
}

function stripUpw(page: UpwPageSchema): Record<string, unknown> {
  const { [UPW_META_KEY]: _upw, ...config } = page;

  return config;
}

function stripSubpackageMeta(meta: UpwMeta | undefined): UpwMeta | undefined {
  if (!meta) {
    return undefined;
  }

  const { subpackageName: _subpackageName, ...rest } = meta;

  return Object.keys(rest).length > 0 ? rest : undefined;
}

function validateFilePath(sourceDir: string, filePath: string, pagePath: string): void {
  const expected = pagePathToWorkspaceFile(sourceDir, pagePath);

  if (path.resolve(filePath) !== path.resolve(expected)) {
    throw new Error(`${filePath} does not match page path "${pagePath}". Expected ${expected}.`);
  }
}

function readSubpackages(app: Record<string, unknown>): BuildSubpackage[] {
  const values = app[UPW_SUBPACKAGES_KEY];

  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter(isBuildSubpackage).map((item) => ({
    ...item,
    name: item[UNI_SUB_PACKAGE_NAME_KEY].trim(),
    root: normalizePagePath(item[UNI_SUB_PACKAGE_ROOT_KEY].trim()),
  }));
}

function relativeSubpackagePath(pagePath: string, subpackage: BuildSubpackage): string {
  const normalizedPagePath = normalizePagePath(pagePath);
  const normalizedRoot = normalizePagePath(subpackage.root);

  if (!normalizedPagePath.startsWith(`${normalizedRoot}/`)) {
    throw new Error(`Page "${pagePath}" is not under subpackage root "${subpackage.root}".`);
  }

  return normalizedPagePath.slice(normalizedRoot.length + 1);
}

function isConditionalPageEntry(entry: OutputPage): boolean {
  return Boolean(entry.meta?.conditions?.length || entry.meta?.when?.length || entry.meta?.unless?.length);
}

function emitPageEntry(entry: OutputPage, level: number, leadingComma = false): string {
  const meta = entry.meta;
  const page = emitValue(entry.page, level, meta?.patches ?? []);

  if (!meta?.conditions?.length && !meta?.when?.length && !meta?.unless?.length) {
    return page;
  }

  return emitConditionalValue(entry.page, meta, level, meta.patches ?? [], leadingComma);
}

function emitPageArray(entries: OutputPage[], level: number): string {
  if (entries.length === 0) {
    return '[]';
  }

  const lines = ['['];
  const baseEntries = entries.filter((entry) => !isConditionalPageEntry(entry));
  const conditionalEntries = entries.filter(isConditionalPageEntry);

  if (baseEntries.length === 0 && conditionalEntries.length > 0) {
    throw new Error('Cannot emit conditional page array items without a stable page item.');
  }

  const items = baseEntries.map((entry) =>
    emitPageEntry(entry, level + 1)
      .split('\n')
      .map((line) => `${'  '.repeat(level + 1)}${line}`),
  );

  items.forEach((item, index) => {
    lines.push(...item);

    if (index < items.length - 1) {
      lines.push(`${'  '.repeat(level + 1)},`);
    }
  });
  conditionalEntries.forEach((entry) => {
    lines.push(
      ...emitPageEntry(entry, level + 1, true)
        .split('\n')
        .map((line) => `${'  '.repeat(level + 1)}${line}`),
    );
  });
  lines.push(`${'  '.repeat(level)}]`);

  return lines.join('\n');
}

function orderHomePageFirst(entries: OutputPage[], homePath: string, label: string): OutputPage[] {
  const normalizedHomePath = normalizePagePath(homePath);
  const homeIndex = entries.findIndex(
    (entry) => normalizePagePath(pagePathForMessage(entry)) === normalizedHomePath,
  );

  if (homeIndex < 0) {
    throw new Error(
      `${label}.${UPW_HOME_PATH_KEY} references "${normalizedHomePath}", which is not a main package page in the current build.`,
    );
  }

  return [entries[homeIndex], ...entries.slice(0, homeIndex), ...entries.slice(homeIndex + 1)];
}

function patchMeta(patch: ConditionalPatch): ConditionalMeta {
  if (patch.conditions?.length) {
    return { conditions: patch.conditions };
  }

  return {
    ...(patch.when?.length ? { when: patch.when } : {}),
    ...(patch.unless?.length ? { unless: patch.unless } : {}),
  };
}

function childPatchMeta(patch: ConditionalChildPatch): ConditionalMeta {
  if (patch.conditions?.length) {
    return { conditions: patch.conditions };
  }

  return {
    ...(patch.when?.length ? { when: patch.when } : {}),
    ...(patch.unless?.length ? { unless: patch.unless } : {}),
  };
}

function patchChildrenForKey(
  patch: ConditionalPatch,
  key: string,
): ConditionalChildPatch[] {
  return (patch.children ?? []).filter(
    (child) => isPlainObject(child.patch) && Object.prototype.hasOwnProperty.call(child.patch, key),
  );
}

function emitObjectMemberBlocks(
  value: Record<string, unknown>,
  level: number,
  patches: NonNullable<UpwMeta['patches']> = [],
): { base: string[][]; conditional: string[][] } {
  const keys = Array.from(
    new Set([...Object.keys(value), ...patches.flatMap((patch) => Object.keys(patch.patch))]),
  );
  const base: string[][] = [];
  const conditional: string[][] = [];

  for (const key of keys) {
    const keyPatches = patches.filter(
      (patch) =>
        isPlainObject(patch.patch) && Object.prototype.hasOwnProperty.call(patch.patch, key),
    );
    const memberObject =
      value[key] === undefined ? {} : ({ [key]: value[key] } as Record<string, unknown>);
    let rendered: string[];

    try {
      rendered = emitValue(memberObject, 0, keyPatches).split('\n').slice(1, -1);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !/Cannot emit conditional JSON members without a stable parent member/u.test(error.message)
      ) {
        throw error;
      }

      rendered = emitValue(memberObject, 0).split('\n').slice(1, -1);
      conditional.push(
        ...keyPatches.flatMap((patch) => [
          emitConditionalMember(
            key,
            patch.patch[key],
            patchMeta(patch),
            level + 1,
            [],
            true,
          ).split('\n'),
          ...patchChildrenForKey(patch, key).map((child) =>
            emitConditionalMember(
              key,
              child.patch[key],
              childPatchMeta(child),
              level + 1,
              [],
              true,
            ).split('\n'),
          ),
        ]),
      );
    }

    if (rendered.length > 0) {
      base.push(rendered.map((line) => `${'  '.repeat(level)}${line}`));
    }
  }

  return { base, conditional };
}

function writePagesJsonWithConditionComments(
  output: string,
  app: Record<string, unknown>,
  appPatches: NonNullable<UpwMeta['patches']>,
  pages: OutputPage[],
  subpackages: BuildSubpackage[],
  subpackagePages: Map<string, OutputPage[]>,
): void {
  const {
    [UPW_HOME_PATH_KEY]: _homePath,
    [UPW_SUBPACKAGES_KEY]: _subpackages,
    [UPW_META_KEY]: _upw,
    ...baseApp
  } = app;
  const lines = ['{'];
  const { base: appMembers, conditional: conditionalAppMembers } = emitObjectMemberBlocks(
    baseApp,
    0,
    appPatches,
  );
  const members: string[][] = [...appMembers];

  members.push([`  ${JSON.stringify(UNI_PAGES_KEY)}: ${emitPageArray(pages, 1)}`]);

  const outputSubpackages = subpackages
    .map(({ [UNI_PAGES_KEY]: _pages, ...subpackage }) => ({
      ...subpackage,
      [UNI_PAGES_KEY]: subpackagePages.get(subpackage.name) ?? [],
    }))
    .filter((subpackage) => subpackage[UNI_PAGES_KEY].length > 0);

  if (outputSubpackages.length > 0) {
    const subpackageBlocks = outputSubpackages.map((subpackage) => {
      const { [UNI_PAGES_KEY]: subPages, ...rest } = subpackage;
      const blockLines = ['{'];
      const restMembers = Object.entries(rest).map(
        ([key, value]) => `${'  '.repeat(3)}${JSON.stringify(key)}: ${emitValue(value, 3)}`,
      );
      const allMembers = [
        ...restMembers,
        `${'  '.repeat(3)}${JSON.stringify(UNI_PAGES_KEY)}: ${emitPageArray(subPages, 3)}`,
      ];

      allMembers.forEach((member, index) => {
        blockLines.push(member);

        if (index < allMembers.length - 1) {
          blockLines.push(`${'  '.repeat(3)},`);
        }
      });
      blockLines.push(`${'  '.repeat(2)}}`);

      return blockLines.join('\n');
    });
    const arrayLines = ['['];

    subpackageBlocks.forEach((block, index) => {
      const [head = '', ...tail] = block.split('\n');

      arrayLines.push(`${'  '.repeat(2)}${head}`, ...tail);

      if (index < subpackageBlocks.length - 1) {
        arrayLines.push(`${'  '.repeat(2)},`);
      }
    });
    arrayLines.push('  ]');
    members.push([`  ${JSON.stringify(UNI_SUBPACKAGES_KEY)}: ${arrayLines.join('\n')}`]);
  }

  members.forEach((member, index) => {
    lines.push(...member);

    if (index < members.length - 1) {
      lines.push('  ,');
    }
  });
  conditionalAppMembers.forEach((member) => {
    lines.push(...member);
  });
  lines.push('}');

  ensureParentDir(output);
  fs.writeFileSync(output, `${lines.join('\n')}\n`, DEFAULT_TEXT_ENCODING);
}

export function resolveUpwToUniContext(
  options: BuildUniPagesJsonFromUpwSourceOptions,
): BuildUniPagesJsonFromUpwSourceContext {
  const sourceDir = options.input;
  const output = options.output;
  const files = collectUpwFiles(sourceDir);

  if (files.length === 0) {
    throw new Error(`No UPW page files found under ${sourceDir}.`);
  }

  return {
    files,
    input: options.input,
    output,
    sourceDir,
  };
}

export function resolveUpwBuildContext(
  options: BuildUniPagesJsonFromUpwSourceOptions,
): UpwBuildContext {
  const context = resolveUpwToUniContext(options);

  return {
    files: context.files,
    output: context.output,
    sourceDir: context.sourceDir,
    watchPatterns: upwWatchPatterns(context.sourceDir),
  };
}

export function runUpwToUniBuild(
  context: BuildUniPagesJsonFromUpwSourceContext,
): BuildUniPagesJsonFromUpwSourceResult {
  const { files, output, sourceDir } = context;
  const appFile = appUpwFile(sourceDir);
  const app = readAppConfig(sourceDir);
  const appValidation = validateUpwAppConfig(app, { label: appFile });
  const appPatches = appValidation.patches ?? [];
  const subpackages = readSubpackages(app);
  const subpackageMap = new Map(subpackages.map((subpackage) => [subpackage.name, subpackage]));
  const pageEntries: OutputPage[] = [];
  const subpackagePageEntries = new Map<string, OutputPage[]>();

  for (const file of files) {
    const forbidUpw = isPlatformWorkspaceFile(sourceDir, file);
    const { config, meta } = validateUpwPageConfig(readPageConfig(file), {
      forbidUpw,
      forbidUpwMessage: `${file} cannot define ${UPW_META_KEY} because platform-specific UPW files cannot contain UPW metadata.`,
      label: file,
    });

    validateFilePath(sourceDir, file, config[UNI_PAGE_PATH_KEY]);

    const page = stripUpw(config);

    if (meta?.subpackageName) {
      const subpackage = subpackageMap.get(meta.subpackageName);

      if (!subpackage) {
        throw new Error(
          `${file} references unknown ${UPW_META_KEY}.${UPW_META_SUBPACKAGE_KEY} "${meta.subpackageName}". Define it in ${appFile} ${UPW_SUBPACKAGES_KEY}.`,
        );
      }

      const { [UNI_PAGE_PATH_KEY]: _path, ...rest } = page;
      const entryGroup = subpackagePageEntries.get(meta.subpackageName) ?? [];
      const relativePage = {
        ...rest,
        [UNI_PAGE_PATH_KEY]: relativeSubpackagePath(config[UNI_PAGE_PATH_KEY], subpackage),
      };

      entryGroup.push({ page: relativePage, meta: stripSubpackageMeta(meta) });
      subpackagePageEntries.set(meta.subpackageName, entryGroup);
      continue;
    }

    pageEntries.push({ page, meta });
  }

  const orderedPageEntries = orderHomePageFirst(pageEntries, appValidation.homePath, appFile);
  const pages = orderedPageEntries.map((entry) => entry.page);

  writePagesJsonWithConditionComments(
    output,
    app,
    appPatches,
    orderedPageEntries,
    subpackages,
    subpackagePageEntries,
  );

  return { pages };
}

export function buildUniPagesJsonFromUpwSource(
  options: BuildUniPagesJsonFromUpwSourceOptions,
): BuildUniPagesJsonFromUpwSourceResult {
  return runUpwToUniBuild(resolveUpwToUniContext(options));
}
