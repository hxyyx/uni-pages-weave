import type {
  ConditionLayer,
  ConditionalChildPatch,
  ConditionalPatch,
  UpwMeta,
} from '../spec/upw-spec.js';
import { UPW_ENDIF_COMMENT, UPW_IFDEF_COMMENT, UPW_IFNDEF_COMMENT } from '../spec/upw-spec.js';
import { stringifyJsonValue } from '../foundation/json.js';
import { isPlainObject } from '../foundation/object.js';
import { envToCondition, normalizePlatformEnv } from '../condition/condition-platform.js';

type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue | undefined };

interface ConditionalMember {
  key: string;
  value: unknown;
  meta: ConditionalMeta;
  children?: ConditionalChildPatch[];
}

interface WrappedConditionalMembers {
  meta: ConditionalMeta;
  members: ConditionalMember[];
}

export type ConditionalMeta = Pick<UpwMeta, 'conditions' | 'when' | 'unless'>;

type EmitterPatch = ConditionalPatch | ConditionalChildPatch;

function indent(level: number): string {
  return '  '.repeat(level);
}

function quote(value: string): string {
  return stringifyJsonValue(value);
}

function conditionStart(meta: ConditionalMeta): string[] {
  if (meta.conditions?.length) {
    return meta.conditions.map(conditionLayerStart);
  }

  const whenLine = meta.when?.length
    ? `// ${UPW_IFDEF_COMMENT} ${envToCondition(meta.when)}`
    : undefined;
  const unlessLine = meta.unless?.length
    ? `// ${UPW_IFNDEF_COMMENT} ${envToCondition(meta.unless)}`
    : undefined;

  return [whenLine, unlessLine].filter((line): line is string => Boolean(line));
}

function conditionLayerStart(layer: ConditionLayer): string {
  return layer.when
    ? `// ${UPW_IFDEF_COMMENT} ${envToCondition(layer.when)}`
    : `// ${UPW_IFNDEF_COMMENT} ${envToCondition(layer.unless)}`;
}

function conditionEnd(meta: ConditionalMeta): string[] {
  const count = meta.conditions?.length
    ? meta.conditions.length
    : (meta.when?.length ? 1 : 0) + (meta.unless?.length ? 1 : 0);

  return Array.from({ length: count }, () => `// ${UPW_ENDIF_COMMENT}`);
}

function normalizeConditionLayer(layer: ConditionLayer): ConditionLayer {
  return layer.when
    ? { when: layer.when.map(normalizePlatformEnv) }
    : { unless: layer.unless.map(normalizePlatformEnv) };
}

function normalizeMeta(meta: ConditionalMeta): ConditionalMeta {
  if (meta.conditions?.length) {
    return {
      conditions: meta.conditions.map(normalizeConditionLayer),
    };
  }

  return {
    ...(meta.when?.length ? { when: meta.when.map(normalizePlatformEnv) } : {}),
    ...(meta.unless?.length ? { unless: meta.unless.map(normalizePlatformEnv) } : {}),
  };
}

function patchMeta(patch: EmitterPatch): ConditionalMeta {
  if (patch.conditions?.length) {
    return { conditions: patch.conditions };
  }

  return {
    ...(patch.when?.length ? { when: patch.when } : {}),
    ...(patch.unless?.length ? { unless: patch.unless } : {}),
  };
}

function stripPatchForKey<TPatch extends EmitterPatch>(patch: TPatch, key: string): TPatch {
  return {
    ...patch,
    patch: patch.patch[key] as Record<string, unknown>,
  } as TPatch;
}

function stripChildrenForKey(
  key: string,
  children: ConditionalChildPatch[] | undefined,
): ConditionalChildPatch[] {
  return (children ?? [])
    .filter((child) => isPlainObject(child.patch) && isPlainObject(child.patch[key]))
    .map((child) => stripPatchForKey(child, key));
}

function memberLine(
  key: string,
  value: unknown,
  level: number,
  patches: EmitterPatch[] = [],
  leadingComma = false,
): string {
  return `${indent(level)}${leadingComma ? ', ' : ''}${quote(key)}: ${emitValueInternal(value, level, patches)}`;
}

function conditionalMemberLines(
  member: ConditionalMember,
  level: number,
  leadingComma = false,
): string[] {
  const meta = normalizeMeta(member.meta);
  const childPatches = stripChildrenForKey(member.key, member.children);

  return [
    ...conditionStart(meta).map((line) => `${indent(level)}${line}`),
    memberLine(member.key, member.value, level, childPatches, leadingComma),
    ...conditionEnd(meta).map((line) => `${indent(level)}${line}`),
  ];
}

export function emitConditionalMember(
  key: string,
  value: unknown,
  meta: ConditionalMeta,
  level: number,
  patches: ConditionalPatch[] = [],
  leadingComma = false,
): string {
  const children = patches.flatMap((patch) => patch.children ?? []);

  return conditionalMemberLines({ key, value, meta, children }, level, leadingComma).join('\n');
}

function patchMembersForKey(key: string, patches: EmitterPatch[]): ConditionalMember[] {
  return patches
    .filter(
      (patch) =>
        isPlainObject(patch.patch) && Object.prototype.hasOwnProperty.call(patch.patch, key),
    )
    .map((patch) => ({
      key,
      value: patch.patch[key],
      meta: patchMeta(patch),
      ...('children' in patch && patch.children?.length ? { children: patch.children } : {}),
    }));
}

function nestedPatchesForKey(key: string, patches: EmitterPatch[]): EmitterPatch[] {
  return patches
    .filter((patch) => isPlainObject(patch.patch) && isPlainObject(patch.patch[key]))
    .map((patch) => {
      const stripped = stripPatchForKey(patch, key);

      return 'children' in stripped && stripped.children?.length
        ? { ...stripped, children: stripChildrenForKey(key, stripped.children) }
        : stripped;
    });
}

function childWrappedMembersForKey(
  key: string,
  patches: EmitterPatch[],
): WrappedConditionalMembers[] {
  return patches.flatMap((patch) => {
    if (
      !('children' in patch) ||
      !patch.children?.length ||
      Object.prototype.hasOwnProperty.call(patch.patch, key)
    ) {
      return [];
    }

    const members = patchMembersForKey(key, patch.children);

    return members.length > 0
      ? [
          {
            meta: patchMeta(patch),
            members,
          },
        ]
      : [];
  });
}

function patchKeys(patch: EmitterPatch): string[] {
  return [
    ...Object.keys(patch.patch),
    ...('children' in patch ? (patch.children ?? []).flatMap(patchKeys) : []),
  ];
}

type ConditionalOutput =
  | { kind: 'member'; member: ConditionalMember }
  | { kind: 'wrapped'; wrapped: WrappedConditionalMembers };

function conditionalOutputLines(
  output: ConditionalOutput,
  level: number,
  leadingComma: boolean,
): string[] {
  if (output.kind === 'member') {
    return conditionalMemberLines(output.member, level, leadingComma);
  }

  const meta = normalizeMeta(output.wrapped.meta);

  return [
    ...conditionStart(meta).map((line) => `${indent(level)}${line}`),
    ...output.wrapped.members.flatMap((member, index) =>
      conditionalMemberLines(member, level, leadingComma || index > 0),
    ),
    ...conditionEnd(meta).map((line) => `${indent(level)}${line}`),
  ];
}

function emitObject(
  value: Record<string, unknown>,
  level: number,
  patches: EmitterPatch[] = [],
): string {
  const lines = ['{'];
  const keys = Array.from(new Set([...Object.keys(value), ...patches.flatMap(patchKeys)]));
  const baseMembers: string[][] = [];
  const conditionalMembers: ConditionalOutput[] = [];

  for (const key of keys) {
    const patchMembers = patchMembersForKey(key, patches);
    const wrappedMembers = childWrappedMembersForKey(key, patches);
    const baseValue = value[key];
    const hasBaseValue = Object.prototype.hasOwnProperty.call(value, key);

    if (patchMembers.length === 0 && wrappedMembers.length === 0) {
      baseMembers.push([memberLine(key, baseValue, level + 1)]);
      continue;
    }

    if (
      hasBaseValue &&
      isPlainObject(baseValue) &&
      patchMembers.every((member) => isPlainObject(member.value))
    ) {
      baseMembers.push([memberLine(key, baseValue, level + 1, nestedPatchesForKey(key, patches))]);
      continue;
    }

    if (hasBaseValue && !(isPlainObject(baseValue) && Object.keys(baseValue).length === 0)) {
      baseMembers.push([memberLine(key, baseValue, level + 1)]);
    }

    conditionalMembers.push(
      ...patchMembers.map((member): ConditionalOutput => ({ kind: 'member', member })),
      ...wrappedMembers.map((wrapped): ConditionalOutput => ({ kind: 'wrapped', wrapped })),
    );
  }

  baseMembers.forEach((member, index) => {
    lines.push(...member);

    if (index < baseMembers.length - 1) {
      lines.push(`${indent(level + 1)},`);
    }
  });

  conditionalMembers.forEach((output, index) => {
    lines.push(...conditionalOutputLines(output, level + 1, baseMembers.length > 0 || index > 0));
  });

  lines.push(`${indent(level)}}`);

  return lines.join('\n');
}

function emitArray(value: unknown[], level: number): string {
  if (value.length === 0) {
    return '[]';
  }

  const lines = ['['];
  const items = value.map((item) => {
    const [head = '', ...tail] = emitValueInternal(item, level + 1).split('\n');

    return [`${indent(level + 1)}${head}`, ...tail];
  });

  items.forEach((item, index) => {
    lines.push(...item);

    if (index < items.length - 1) {
      lines.push(`${indent(level + 1)},`);
    }
  });
  lines.push(`${indent(level)}]`);

  return lines.join('\n');
}

function emitValueInternal(value: unknown, level = 0, patches: EmitterPatch[] = []): string {
  if (Array.isArray(value)) {
    return emitArray(value, level);
  }

  if (isPlainObject(value)) {
    return emitObject(value, level, patches);
  }

  return stringifyJsonValue(value as JsonValue);
}

export function emitValue(value: unknown, level = 0, patches: ConditionalPatch[] = []): string {
  return emitValueInternal(value, level, patches);
}

export function emitConditionalValue(
  value: unknown,
  meta: ConditionalMeta,
  level = 0,
  patches: ConditionalPatch[] = [],
  leadingComma = false,
): string {
  const normalized = normalizeMeta(meta);
  const [head = '', ...tail] = emitValueInternal(value, level, patches).split('\n');

  return [
    ...conditionStart(normalized).map((line) => `${indent(level)}${line}`),
    `${leadingComma ? ', ' : ''}${head}`,
    ...tail,
    ...conditionEnd(normalized).map((line) => `${indent(level)}${line}`),
  ].join('\n');
}
