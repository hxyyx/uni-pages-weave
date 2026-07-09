import type { ConditionalPatch, UpwMeta } from '../ir/types.js';
import type { UpwPageSchema } from '../schema/upw.js';
import {
  UNI_PAGE_PATH_KEY,
  UPW_META_ALLOWED_KEYS,
  UPW_META_KEY,
  UPW_META_PATCHES_KEY,
  UPW_META_SUBPACKAGE_KEY,
} from '../internal/constants.js';
import { isPlainObject } from '../internal/object.js';
import {
  assertAllowedKeys,
  normalizeConditionMetaFields,
  normalizeConditionalPatch,
  validateConditionalPatchShape,
} from './upw-meta-validator.js';

export interface ValidateUpwPageConfigOptions {
  forbidUpw?: boolean;
  forbidUpwMessage?: string;
  label: string;
}

export interface ValidatedUpwPageConfig {
  config: UpwPageSchema;
  meta?: UpwMeta;
}

interface RuleContext<TValue> {
  fieldPath: string;
  value: TValue;
}

type Rule<TValue> = (context: RuleContext<TValue>) => void;

function hasUpwConfig(value: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(value, UPW_META_KEY);
}

function runRules<TValue>(value: TValue, fieldPath: string, rules: Array<Rule<TValue>>): void {
  const context = { fieldPath, value };

  for (const rule of rules) {
    rule(context);
  }
}

function validateAllowedKeys(allowedKeys: readonly string[]): Rule<Record<string, unknown>> {
  return ({ fieldPath, value }) => assertAllowedKeys(value, allowedKeys, fieldPath);
}

function validateSubpackageType({ fieldPath, value }: RuleContext<Record<string, unknown>>): void {
  const subpackageName = value[UPW_META_SUBPACKAGE_KEY];

  if (
    subpackageName !== undefined &&
    (typeof subpackageName !== 'string' || subpackageName.trim() === '')
  ) {
    throw new Error(`${fieldPath}.${UPW_META_SUBPACKAGE_KEY} must be a non-empty string.`);
  }
}

function validatePatchesType({ fieldPath, value }: RuleContext<Record<string, unknown>>): void {
  if (value[UPW_META_PATCHES_KEY] !== undefined && !Array.isArray(value[UPW_META_PATCHES_KEY])) {
    throw new Error(`${fieldPath}.${UPW_META_PATCHES_KEY} must be an array.`);
  }
}

function validateConditionalPatches({
  fieldPath,
  value,
}: RuleContext<Record<string, unknown>>): void {
  if (!Array.isArray(value[UPW_META_PATCHES_KEY])) {
    return;
  }

  value[UPW_META_PATCHES_KEY].forEach((item, index) => {
    const itemPath = `${fieldPath}.${UPW_META_PATCHES_KEY}[${index}]`;

    validateConditionalPatchShape(item, itemPath);
  });
}

function validateUpwMetaShape(
  value: unknown,
  fieldPath: string,
): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error(`${fieldPath} must be an object.`);
  }
}

function validateUpwMetaRules(value: Record<string, unknown>, fieldPath: string): void {
  runRules(value, fieldPath, [
    validateSubpackageType,
    validatePatchesType,
    validateConditionalPatches,
    validateAllowedKeys(UPW_META_ALLOWED_KEYS),
  ]);
}

function normalizeUpwMeta(value: unknown, label: string): UpwMeta | undefined {
  if (value === undefined) {
    return undefined;
  }

  const fieldPath = `${label} ${UPW_META_KEY}`;

  validateUpwMetaShape(value, fieldPath);
  validateUpwMetaRules(value, fieldPath);

  const conditionMeta = normalizeConditionMetaFields(value, fieldPath);
  const patches: ConditionalPatch[] | undefined = Array.isArray(value[UPW_META_PATCHES_KEY])
    ? value[UPW_META_PATCHES_KEY].map((item, index) =>
        normalizeConditionalPatch(item, index, label, `${UPW_META_KEY}.${UPW_META_PATCHES_KEY}`),
      )
    : undefined;
  const subpackageName =
    typeof value[UPW_META_SUBPACKAGE_KEY] === 'string'
      ? value[UPW_META_SUBPACKAGE_KEY].trim()
      : undefined;

  const meta: UpwMeta = {
    ...(subpackageName ? { subpackageName } : {}),
    ...conditionMeta,
    ...(patches?.length ? { patches } : {}),
  };

  return Object.keys(meta).length > 0 ? meta : undefined;
}

export function validateUpwPageConfig(
  value: unknown,
  options: ValidateUpwPageConfigOptions,
): ValidatedUpwPageConfig {
  if (
    !isPlainObject(value) ||
    typeof value[UNI_PAGE_PATH_KEY] !== 'string' ||
    value[UNI_PAGE_PATH_KEY].trim() === ''
  ) {
    throw new Error(`${options.label} must contain a page object with a non-empty string path.`);
  }

  if (options.forbidUpw && hasUpwConfig(value)) {
    throw new Error(options.forbidUpwMessage ?? `${options.label} cannot define ${UPW_META_KEY}.`);
  }

  return {
    config: value as UpwPageSchema,
    meta: normalizeUpwMeta(value[UPW_META_KEY], options.label),
  };
}
