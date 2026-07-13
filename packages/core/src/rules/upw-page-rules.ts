import type { ConditionalPatch, UpwMeta } from '../spec/upw-spec.js';
import type { UpwPageSchema } from '../spec/upw-spec.js';
import {
  UPW_META_ALLOWED_KEYS,
  UPW_META_KEY,
  UPW_META_PATCH_KEY,
  UPW_META_PATCHES_KEY,
  UPW_META_SUB_PACKAGE_NAME_KEY,
} from '../spec/upw-spec.js';
import {
  UNI_PAGE_PATH_KEY,
} from '../spec/uni-pages-spec.js';
import { isPlainObject } from '../foundation/object.js';
import {
  assertAllowedKeys,
  normalizeConditionMetaFields,
  normalizeConditionalPatch,
  validateConditionalPatchShape,
} from './upw-meta-rules.js';

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

function validateSubPackageType({ fieldPath, value }: RuleContext<Record<string, unknown>>): void {
  const subPackageName = value[UPW_META_SUB_PACKAGE_NAME_KEY];

  if (
    subPackageName !== undefined &&
    (typeof subPackageName !== 'string' || subPackageName.trim() === '')
  ) {
    throw new Error(`${fieldPath}.${UPW_META_SUB_PACKAGE_NAME_KEY} must be a non-empty string.`);
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
    validateSubPackageType,
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
  const subPackageName =
    typeof value[UPW_META_SUB_PACKAGE_NAME_KEY] === 'string'
      ? value[UPW_META_SUB_PACKAGE_NAME_KEY].trim()
      : undefined;

  const meta: UpwMeta = {
    ...(subPackageName ? { subPackageName } : {}),
    ...conditionMeta,
    ...(patches?.length ? { patches } : {}),
  };

  return Object.keys(meta).length > 0 ? meta : undefined;
}

function conditionalPatchEntries(
  patch: ConditionalPatch,
  index: number,
  label: string,
): Array<{ patch: ConditionalPatch; fieldPath: string }> {
  return [
    {
      patch,
      fieldPath: `${label} ${UPW_META_KEY}.${UPW_META_PATCHES_KEY}[${index}].${UPW_META_PATCH_KEY}`,
    },
    ...(patch.children ?? []).map((child, childIndex) => ({
      patch: child,
      fieldPath: `${label} ${UPW_META_KEY}.${UPW_META_PATCHES_KEY}[${index}].children[${childIndex}].${UPW_META_PATCH_KEY}`,
    })),
  ];
}

function validatePagePatchTargets(meta: UpwMeta | undefined, label: string): void {
  for (const [index, conditionalPatch] of (meta?.patches ?? []).entries()) {
    for (const entry of conditionalPatchEntries(conditionalPatch, index, label)) {
      validatePagePatchTargetFields(entry.patch.patch, entry.fieldPath);
    }
  }
}

function validatePagePatchTargetFields(patch: Record<string, unknown>, fieldPath: string): void {
  if (Object.prototype.hasOwnProperty.call(patch, UPW_META_KEY)) {
    throw new Error(`${fieldPath}.${UPW_META_KEY} is upw metadata and cannot be conditionally patched.`);
  }

  if (Object.prototype.hasOwnProperty.call(patch, UNI_PAGE_PATH_KEY)) {
    throw new Error(
      `${fieldPath}.${UNI_PAGE_PATH_KEY} is an upw page identity field and cannot be conditionally patched.`,
    );
  }
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

  const meta = normalizeUpwMeta(value[UPW_META_KEY], options.label);

  validatePagePatchTargets(meta, options.label);

  return {
    config: value as UpwPageSchema,
    meta,
  };
}


