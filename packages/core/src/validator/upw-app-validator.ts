import type { ConditionalPatch } from '../ir/types.js';
import type { UpwAppSchema } from '../schema/upw.js';
import {
  UNI_SUBPACKAGES_KEY,
  UPW_HOME_PATH_KEY,
  UPW_APP_FILE,
  UPW_APP_META_ALLOWED_KEYS,
  UPW_META_KEY,
  UPW_META_PATCH_KEY,
  UPW_META_PATCHES_KEY,
  UPW_SUBPACKAGES_KEY,
  UNI_SUB_PACKAGE_NAME_KEY,
  UNI_SUB_PACKAGE_ROOT_KEY,
} from '../internal/constants.js';
import { isPlainObject } from '../internal/object.js';
import {
  assertAllowedKeys,
  normalizeConditionalPatch,
} from './upw-meta-validator.js';

export interface ValidateUpwAppConfigOptions {
  label?: string;
}

export interface ValidatedUpwAppConfig {
  homePath: string;
  patches?: ConditionalPatch[];
}

function label(options: ValidateUpwAppConfigOptions): string {
  return options.label ?? UPW_APP_FILE;
}

function normalizeAppMeta(app: Record<string, unknown>, appLabel: string): ValidatedUpwAppConfig {
  const meta = app[UPW_META_KEY];

  if (meta === undefined) {
    return { homePath: normalizeHomePath(app, appLabel) };
  }

  const fieldPath = `${appLabel} ${UPW_META_KEY}`;

  if (!isPlainObject(meta)) {
    throw new Error(`${fieldPath} must be an object.`);
  }

  assertAllowedKeys(meta, UPW_APP_META_ALLOWED_KEYS, fieldPath);

  if (meta[UPW_META_PATCHES_KEY] !== undefined && !Array.isArray(meta[UPW_META_PATCHES_KEY])) {
    throw new Error(`${fieldPath}.${UPW_META_PATCHES_KEY} must be an array.`);
  }

  const patches = Array.isArray(meta[UPW_META_PATCHES_KEY])
    ? meta[UPW_META_PATCHES_KEY].map((item, index) =>
        normalizeConditionalPatch(item, index, appLabel, `${UPW_META_KEY}.${UPW_META_PATCHES_KEY}`),
      )
    : undefined;

  return {
    homePath: normalizeHomePath(app, appLabel),
    ...(patches?.length ? { patches } : {}),
  };
}

function normalizeHomePath(app: Record<string, unknown>, appLabel: string): string {
  const value = app[UPW_HOME_PATH_KEY];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${appLabel}.${UPW_HOME_PATH_KEY} must be a non-empty string.`);
  }

  return value.trim();
}

function conditionalPatchEntries(patch: ConditionalPatch): ConditionalPatch[] {
  return [patch, ...(patch.children ?? [])];
}

function validateAppConditionalPatchTargets(
  app: Record<string, unknown>,
  patches: ConditionalPatch[] | undefined,
  appLabel: string,
): void {
  for (const [index, conditionalPatch] of (patches ?? []).entries()) {
    for (const patch of conditionalPatchEntries(conditionalPatch)) {
      for (const key of Object.keys(patch.patch)) {
        const fieldPath = `${appLabel} ${UPW_META_KEY}.${UPW_META_PATCHES_KEY}[${index}].${UPW_META_PATCH_KEY}.${key}`;

        if (!Object.prototype.hasOwnProperty.call(app, key)) {
          throw new Error(`${fieldPath} cannot add a conditionally compiled top-level property.`);
        }

        if (!isPlainObject(app[key]) || !isPlainObject(patch.patch[key])) {
          throw new Error(`${fieldPath} cannot replace a top-level property conditionally.`);
        }
      }
    }
  }
}

function validateSubpackages(app: Record<string, unknown>, appLabel: string): void {
  if (app[UNI_SUBPACKAGES_KEY] !== undefined) {
    throw new Error(
      `${appLabel} contains unsupported key: ${UNI_SUBPACKAGES_KEY}. Use ${UPW_SUBPACKAGES_KEY}.`,
    );
  }

  const value = app[UPW_SUBPACKAGES_KEY];

  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${appLabel}.${UPW_SUBPACKAGES_KEY} must be an array.`);
  }

  value.forEach((item, index) => {
    const itemPath = `${appLabel}.${UPW_SUBPACKAGES_KEY}[${index}]`;

    if (!isPlainObject(item)) {
      throw new Error(`${itemPath} must be an object.`);
    }

    if (
      typeof item[UNI_SUB_PACKAGE_NAME_KEY] !== 'string' ||
      item[UNI_SUB_PACKAGE_NAME_KEY].trim() === ''
    ) {
      throw new Error(`${itemPath}.${UNI_SUB_PACKAGE_NAME_KEY} must be a non-empty string.`);
    }

    if (
      typeof item[UNI_SUB_PACKAGE_ROOT_KEY] !== 'string' ||
      item[UNI_SUB_PACKAGE_ROOT_KEY].trim() === ''
    ) {
      throw new Error(`${itemPath}.${UNI_SUB_PACKAGE_ROOT_KEY} must be a non-empty string.`);
    }
  });
}

export function validateUpwAppConfig(
  app: UpwAppSchema,
  options: ValidateUpwAppConfigOptions = {},
): ValidatedUpwAppConfig {
  const appLabel = label(options);
  const meta = normalizeAppMeta(app, appLabel);

  validateAppConditionalPatchTargets(app, meta.patches, appLabel);
  validateSubpackages(app, appLabel);

  return meta;
}
