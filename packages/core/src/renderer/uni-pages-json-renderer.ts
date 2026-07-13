import type { ConditionalChildPatch, ConditionalPatch, UpwMeta } from '../spec/upw-spec.js';
import type { UpwAppSchema, UpwPageSchema } from '../spec/upw-spec.js';
import { UPW_META_KEY, UPW_SUB_PACKAGES_KEY } from '../spec/upw-spec.js';
import { UNI_PAGES_KEY, UNI_SUB_PACKAGES_KEY } from '../spec/uni-pages-spec.js';
import { isPlainObject } from '../foundation/object.js';
import {
  convertUpwAppFragmentToUniObject,
  convertUpwPageFragmentToUniPageEntry,
} from '../fragment/upw-to-uni-fragments.js';
import {
  buildUniPagesJsonWorkspaceFromUpwData,
  isConditionalPageEntry,
  type BuildSubPackage,
  type OutputPage,
  type RenderUpwWorkspaceData,
} from '../workspace/upw-workspace.js';
import {
  emitConditionalMember,
  emitConditionalValue,
  emitValue,
  type ConditionalMeta,
} from './uni-pages-json-condition-emitter.js';

export type { BuildSubPackage, OutputPage, RenderUpwWorkspaceData } from '../workspace/upw-workspace.js';

export type RenderUpwToUniPagesJsonInput =
  | {
      type: 'app';
      data: UpwAppSchema;
      label?: string;
    }
  | {
      type: 'page';
      data: UpwPageSchema;
      label?: string;
      forbidUpw?: boolean;
    }
  | {
      type: 'workspace';
      data: RenderUpwWorkspaceData;
      label?: string;
    };

interface EmitPageArrayOptions {
  allowSingleConditionalEntry?: boolean;
}

function emitPageEntry(entry: OutputPage, level: number, leadingComma = false): string {
  const meta = entry.meta;
  const page = emitValue(entry.page, level, meta?.patches ?? []);

  if (!meta?.conditions?.length && !meta?.when?.length && !meta?.unless?.length) {
    const [head = '', ...tail] = page.split('\n');

    return [leadingComma ? `, ${head}` : head, ...tail].join('\n');
  }

  return emitConditionalValue(entry.page, meta, level, meta.patches ?? [], leadingComma);
}

export function emitPageArray(
  entries: OutputPage[],
  level: number,
  options: EmitPageArrayOptions = {},
): string {
  if (entries.length === 0) {
    return '[]';
  }

  const lines = ['['];
  const stableEntries = entries.filter((entry) => !isConditionalPageEntry(entry));
  const conditionalEntries = entries.filter(isConditionalPageEntry);

  if (
    stableEntries.length === 0 &&
    conditionalEntries.length > 0 &&
    !(options.allowSingleConditionalEntry && conditionalEntries.length === 1)
  ) {
    throw new Error('Cannot emit conditional page array items without a stable page item.');
  }

  let hasEntry = false;
  let hasStableEntry = false;

  entries.forEach((entry) => {
    const isConditional = isConditionalPageEntry(entry);

    if (!isConditional && hasEntry && !hasStableEntry) {
      throw new Error('Cannot emit stable page array items after leading conditional page items.');
    }

    const leadingComma = hasEntry && (hasStableEntry || isConditional);

    lines.push(
      ...emitPageEntry(entry, level + 1, leadingComma)
        .split('\n')
        .map((line) => `${'  '.repeat(level + 1)}${line}`),
    );

    hasEntry = true;
    hasStableEntry ||= !isConditional;
  });
  lines.push(`${'  '.repeat(level)}]`);

  return lines.join('\n');
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

function patchChildrenForKey(patch: ConditionalPatch, key: string): ConditionalChildPatch[] {
  return (patch.children ?? []).filter(
    (child) => isPlainObject(child.patch) && Object.prototype.hasOwnProperty.call(child.patch, key),
  );
}

export function emitObjectMemberBlocks(
  value: Record<string, unknown>,
  level: number,
  patches: NonNullable<UpwMeta['patches']> = [],
): { base: string[][]; conditional: Array<(leadingComma: boolean) => string[]> } {
  const keys = Array.from(
    new Set([...Object.keys(value), ...patches.flatMap((patch) => Object.keys(patch.patch))]),
  );
  const base: string[][] = [];
  const conditional: Array<(leadingComma: boolean) => string[]> = [];

  for (const key of keys) {
    const keyPatches = patches.filter(
      (patch) => isPlainObject(patch.patch) && Object.prototype.hasOwnProperty.call(patch.patch, key),
    );
    const hasBaseMember = Object.prototype.hasOwnProperty.call(value, key);
    const memberObject =
      value[key] === undefined ? {} : ({ [key]: value[key] } as Record<string, unknown>);
    let rendered: string[];

    if (!hasBaseMember && keyPatches.length > 0) {
      conditional.push((leadingComma) =>
        keyPatches.flatMap((patch, index) => [
          ...emitConditionalMember(
            key,
            patch.patch[key],
            patchMeta(patch),
            level + 1,
            [],
            leadingComma || index > 0,
          ).split('\n'),
          ...patchChildrenForKey(patch, key).map((child) =>
            emitConditionalMember(
              key,
              child.patch[key],
              childPatchMeta(child),
              level + 1,
              [],
              true,
            ),
          ).flatMap((block) => block.split('\n')),
        ]),
      );
      continue;
    }

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
      conditional.push((leadingComma) =>
        keyPatches.flatMap((patch, index) => [
          ...emitConditionalMember(
            key,
            patch.patch[key],
            patchMeta(patch),
            level + 1,
            [],
            leadingComma || index > 0,
          ).split('\n'),
          ...patchChildrenForKey(patch, key).map((child) =>
            emitConditionalMember(
              key,
              child.patch[key],
              childPatchMeta(child),
              level + 1,
              [],
              true,
            ),
          ).flatMap((block) => block.split('\n')),
        ]),
      );
    }

    if (rendered.length > 0) {
      base.push(rendered.map((line) => `${'  '.repeat(level)}${line}`));
    }
  }

  return { base, conditional };
}

export function emitUniJsoncFragment(
  value: unknown,
  level = 0,
  patches: ConditionalPatch[] = [],
): string {
  return emitValue(value, level, patches);
}

function renderAppConfigObject(
  app: Record<string, unknown>,
  appPatches: NonNullable<UpwMeta['patches']>,
): string {
  const {
    [UPW_SUB_PACKAGES_KEY]: _subPackages,
    [UPW_META_KEY]: _upw,
    ...baseApp
  } = app;
  const lines = ['{'];
  const { base: appMembers, conditional: conditionalAppMembers } = emitObjectMemberBlocks(
    baseApp,
    0,
    appPatches,
  );

  appMembers.forEach((member, index) => {
    lines.push(...member);

    if (index < appMembers.length - 1) {
      lines.push('  ,');
    }
  });
  conditionalAppMembers.forEach((member, index) => {
    lines.push(...member(appMembers.length > 0 || index > 0));
  });
  lines.push('}');

  return `${lines.join('\n')}\n`;
}

export function renderUniPagesJsonWithConditionComments(
  app: Record<string, unknown>,
  appPatches: NonNullable<UpwMeta['patches']>,
  pages: OutputPage[],
  subPackages: BuildSubPackage[],
  subPackagePages: Map<string, OutputPage[]>,
): string {
  const {
    [UPW_SUB_PACKAGES_KEY]: _subPackages,
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

  const outputSubPackages = subPackages
    .map(({ [UNI_PAGES_KEY]: _pages, ...subPackage }) => ({
      ...subPackage,
      [UNI_PAGES_KEY]: subPackagePages.get(subPackage.name) ?? [],
    }))
    .filter((subPackage) => subPackage[UNI_PAGES_KEY].length > 0);

  if (outputSubPackages.length > 0) {
    const subPackageBlocks = outputSubPackages.map((subPackage) => {
      const { [UNI_PAGES_KEY]: subPages, ...rest } = subPackage;
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

    subPackageBlocks.forEach((block, index) => {
      const [head = '', ...tail] = block.split('\n');

      arrayLines.push(`${'  '.repeat(2)}${head}`, ...tail);

      if (index < subPackageBlocks.length - 1) {
        arrayLines.push(`${'  '.repeat(2)},`);
      }
    });
    arrayLines.push('  ]');
    members.push([`  ${JSON.stringify(UNI_SUB_PACKAGES_KEY)}: ${arrayLines.join('\n')}`]);
  }

  members.forEach((member, index) => {
    lines.push(...member);

    if (index < members.length - 1) {
      lines.push('  ,');
    }
  });
  conditionalAppMembers.forEach((member, index) => {
    lines.push(...member(members.length > 0 || index > 0));
  });
  lines.push('}');

  return `${lines.join('\n')}\n`;
}

function renderStandalonePage(page: UpwPageSchema, label: string, forbidUpw = false): string {
  const converted = convertUpwPageFragmentToUniPageEntry(page, {
    forbidUpw,
    label,
  });
  const entry: OutputPage = {
    page: converted.page,
    ...(converted.meta ? { meta: converted.meta } : {}),
    readOrder: 0,
    isPlatformPage: false,
  };

  return `{\n  ${JSON.stringify(UNI_PAGES_KEY)}: ${emitPageArray([entry], 1, {
    allowSingleConditionalEntry: true,
  })}\n}\n`;
}

function renderWorkspace(data: RenderUpwWorkspaceData, label: string): string {
  const workspace = buildUniPagesJsonWorkspaceFromUpwData(data, label);

  return renderUniPagesJsonWithConditionComments(
    workspace.app,
    workspace.appPatches,
    workspace.pages,
    workspace.subPackages,
    workspace.subPackagePages,
  );
}

export function renderUpwToUniPagesJson(input: RenderUpwToUniPagesJsonInput): string {
  if (input.type === 'app') {
    const converted = convertUpwAppFragmentToUniObject(input.data, input.label);

    return renderAppConfigObject(converted.app, converted.patches);
  }

  if (input.type === 'page') {
    return renderStandalonePage(input.data, input.label ?? 'page upw data', input.forbidUpw);
  }

  return renderWorkspace(input.data, input.label ?? 'upw workspace data');
}
