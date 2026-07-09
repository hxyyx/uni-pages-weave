import uniq from 'lodash-es/uniq.js';

import type { ConditionLayer, ConditionMeta, ConditionalChildPatch, ConditionalPatch } from '../ir/types.js';
import {
  UPW_CONDITIONAL_CHILD_PATCH_ALLOWED_KEYS,
  UPW_CONDITIONAL_PATCH_ALLOWED_KEYS,
  UPW_META_CHILDREN_KEY,
  UPW_META_CONDITIONS_KEY,
  UPW_META_PATCH_KEY,
  UPW_META_UNLESS_KEY,
  UPW_META_WHEN_KEY,
} from '../internal/constants.js';
import { isPlainObject } from '../internal/object.js';
import { normalizePlatformEnv } from '../utils/platform.js';

export function assertAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  fieldPath: string,
): void {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(value).filter((key) => !allowed.has(key));

  if (unknownKeys.length > 0) {
    throw new Error(`${fieldPath} contains unsupported keys: ${unknownKeys.join(', ')}.`);
  }
}

export function normalizeRequiredPlatformList(
  value: unknown,
  fieldPath: string,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${fieldPath} must be an array of platform strings.`);
  }

  const invalidIndex = value.findIndex((item) => typeof item !== 'string' || item.trim() === '');

  if (invalidIndex >= 0) {
    throw new Error(`${fieldPath}[${invalidIndex}] must be a non-empty platform string.`);
  }

  if (value.length === 0) {
    throw new Error(`${fieldPath} must contain at least one platform.`);
  }

  return uniq(value.map((item) => normalizePlatformEnv(item)));
}

export function normalizeRequiredPatchObject(
  value: unknown,
  fieldPath: string,
): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error(`${fieldPath} must be an object.`);
  }

  return value;
}

export function validateConditionalPatchShape(
  value: unknown,
  fieldPath: string,
): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error(`${fieldPath} must be an object.`);
  }
}

function normalizeConditionalPatchBase(
  value: Record<string, unknown>,
  fieldPath: string,
): {
  conditions?: ConditionLayer[];
  when?: string[];
  unless?: string[];
  patch: Record<string, unknown>;
} {
  const conditionMeta = normalizeConditionMetaFields(value, fieldPath);

  if (!conditionMeta.conditions && !conditionMeta.when && !conditionMeta.unless) {
    throw new Error(
      `${fieldPath} must define ${UPW_META_CONDITIONS_KEY}, ${UPW_META_WHEN_KEY}, or ${UPW_META_UNLESS_KEY}.`,
    );
  }

  const patch = normalizeRequiredPatchObject(
    value[UPW_META_PATCH_KEY],
    `${fieldPath}.${UPW_META_PATCH_KEY}`,
  );

  return {
    ...conditionMeta,
    patch,
  };
}

function hasOwnKey(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeConditionLayer(value: unknown, fieldPath: string): ConditionLayer {
  validateConditionalPatchShape(value, fieldPath);

  const keys = Object.keys(value);
  const unknownKeys = keys.filter(
    (key) => key !== UPW_META_WHEN_KEY && key !== UPW_META_UNLESS_KEY,
  );

  if (unknownKeys.length > 0) {
    throw new Error(`${fieldPath} contains unsupported keys: ${unknownKeys.join(', ')}.`);
  }

  const hasWhen = hasOwnKey(value, UPW_META_WHEN_KEY);
  const hasUnless = hasOwnKey(value, UPW_META_UNLESS_KEY);

  if (hasWhen && hasUnless) {
    throw new Error(`${fieldPath} cannot define both ${UPW_META_WHEN_KEY} and ${UPW_META_UNLESS_KEY}.`);
  }

  if (!hasWhen && !hasUnless) {
    throw new Error(`${fieldPath} must define ${UPW_META_WHEN_KEY} or ${UPW_META_UNLESS_KEY}.`);
  }

  if (hasWhen) {
    return {
      when: normalizeRequiredPlatformList(
        value[UPW_META_WHEN_KEY],
        `${fieldPath}.${UPW_META_WHEN_KEY}`,
      ) ?? [],
    };
  }

  return {
    unless: normalizeRequiredPlatformList(
      value[UPW_META_UNLESS_KEY],
      `${fieldPath}.${UPW_META_UNLESS_KEY}`,
    ) ?? [],
  };
}

export function normalizeConditions(
  value: unknown,
  fieldPath: string,
): ConditionLayer[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${fieldPath} must be an array.`);
  }

  if (value.length === 0) {
    throw new Error(`${fieldPath} must contain at least one condition layer.`);
  }

  if (value.length > 2) {
    throw new Error(`${fieldPath} supports at most two condition layers.`);
  }

  return value.map((item, index) => normalizeConditionLayer(item, `${fieldPath}[${index}]`));
}

export function normalizeConditionMetaFields(
  value: Record<string, unknown>,
  fieldPath: string,
): ConditionMeta {
  const conditions = normalizeConditions(
    value[UPW_META_CONDITIONS_KEY],
    `${fieldPath}.${UPW_META_CONDITIONS_KEY}`,
  );

  if (conditions) {
    const extraKeys = [UPW_META_WHEN_KEY, UPW_META_UNLESS_KEY].filter((key) =>
      hasOwnKey(value, key),
    );

    if (extraKeys.length > 0) {
      throw new Error(
        `${fieldPath} cannot define ${extraKeys.join(' or ')} when ${UPW_META_CONDITIONS_KEY} is defined.`,
      );
    }

    return { conditions };
  }

  const when = normalizeRequiredPlatformList(
    value[UPW_META_WHEN_KEY],
    `${fieldPath}.${UPW_META_WHEN_KEY}`,
  );
  const unless = normalizeRequiredPlatformList(
    value[UPW_META_UNLESS_KEY],
    `${fieldPath}.${UPW_META_UNLESS_KEY}`,
  );

  if (when && unless) {
    throw new Error(
      `${fieldPath} cannot define both ${UPW_META_WHEN_KEY} and ${UPW_META_UNLESS_KEY}. Use ${UPW_META_CONDITIONS_KEY} for nested conditional compilation.`,
    );
  }

  return {
    ...(when ? { when } : {}),
    ...(unless ? { unless } : {}),
  };
}

export function normalizeConditionalChildPatch(
  value: unknown,
  index: number,
  label: string,
  fieldPathPrefix: string,
): ConditionalChildPatch {
  const fieldPath = `${label} ${fieldPathPrefix}[${index}]`;

  validateConditionalPatchShape(value, fieldPath);
  assertAllowedKeys(value, UPW_CONDITIONAL_CHILD_PATCH_ALLOWED_KEYS, fieldPath);

  return normalizeConditionalPatchBase(value, fieldPath);
}

export function normalizeConditionalPatch(
  value: unknown,
  index: number,
  label: string,
  fieldPathPrefix: string,
): ConditionalPatch {
  const fieldPath = `${label} ${fieldPathPrefix}[${index}]`;

  validateConditionalPatchShape(value, fieldPath);
  assertAllowedKeys(value, UPW_CONDITIONAL_PATCH_ALLOWED_KEYS, fieldPath);

  const base = normalizeConditionalPatchBase(value, fieldPath);
  const childrenValue = value[UPW_META_CHILDREN_KEY];

  if (childrenValue !== undefined && !Array.isArray(childrenValue)) {
    throw new Error(`${fieldPath}.${UPW_META_CHILDREN_KEY} must be an array.`);
  }

  const children = Array.isArray(childrenValue)
    ? childrenValue.map((item, childIndex) =>
        normalizeConditionalChildPatch(
          item,
          childIndex,
          label,
          `${fieldPathPrefix}[${index}].${UPW_META_CHILDREN_KEY}`,
        ),
      )
    : undefined;

  return {
    ...base,
    ...(children?.length ? { children } : {}),
  };
}
