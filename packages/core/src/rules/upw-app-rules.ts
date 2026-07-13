import type { ConditionalPatch } from '../spec/upw-spec.js';
import type { UpwAppSchema } from '../spec/upw-spec.js';
import {
  UPW_HOME_PATH_KEY,
  UPW_APP_FILE,
  UPW_APP_META_ALLOWED_KEYS,
  UPW_META_KEY,
  UPW_META_PATCH_KEY,
  UPW_META_PATCHES_KEY,
  UPW_SUB_PACKAGES_KEY,
} from '../spec/upw-spec.js';
import {
  UNI_PAGES_KEY,
  UNI_SUB_PACKAGES_COMPAT_KEY,
} from '../spec/uni-pages-spec.js';
import { isPlainObject } from '../foundation/object.js';
import {
  assertAllowedKeys,
  normalizeConditionalPatch,
} from './upw-meta-rules.js';

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
    throw new Error(`${appLabel}.${UPW_META_KEY}.${UPW_HOME_PATH_KEY} must be a non-empty string.`);
  }

  const fieldPath = `${appLabel}.${UPW_META_KEY}`;

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
    homePath: normalizeHomePath(meta, fieldPath),
    ...(patches?.length ? { patches } : {}),
  };
}

function normalizeHomePath(meta: Record<string, unknown>, metaLabel: string): string {
  const value = meta[UPW_HOME_PATH_KEY];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${metaLabel}.${UPW_HOME_PATH_KEY} must be a non-empty string.`);
  }

  return value.trim();
}

function conditionalPatchEntries(
  patch: ConditionalPatch,
  index: number,
  appLabel: string,
): Array<{ patch: ConditionalPatch; fieldPath: string }> {
  return [
    {
      patch,
      fieldPath: `${appLabel} ${UPW_META_KEY}.${UPW_META_PATCHES_KEY}[${index}].${UPW_META_PATCH_KEY}`,
    },
    ...(patch.children ?? []).map((child, childIndex) => ({
      patch: child,
      fieldPath: `${appLabel} ${UPW_META_KEY}.${UPW_META_PATCHES_KEY}[${index}].children[${childIndex}].${UPW_META_PATCH_KEY}`,
    })),
  ];
}

function validateAppConditionalPatchTargets(
  patches: ConditionalPatch[] | undefined,
  appLabel: string,
): void {
  for (const [index, conditionalPatch] of (patches ?? []).entries()) {
    for (const entry of conditionalPatchEntries(conditionalPatch, index, appLabel)) {
      validateAppPatchTargetFields(entry.patch.patch, entry.fieldPath);
    }
  }
}

function validateAppTopLevelFields(app: Record<string, unknown>, appLabel: string): void {
  if (Object.prototype.hasOwnProperty.call(app, UNI_PAGES_KEY)) {
    throw new Error(
      `${appLabel}.${UNI_PAGES_KEY} is generated from page-level upw files and cannot be configured in app.upw.json.`,
    );
  }
}

const APP_PATCH_DENIED_TOP_LEVEL_FIELDS = new Map<string, string>([
  [UPW_META_KEY, `${UPW_META_KEY} is upw metadata and cannot be conditionally patched.`],
  [
    UNI_PAGES_KEY,
    `${UNI_PAGES_KEY} is generated from page-level upw files and cannot be conditionally patched.`,
  ],
  [
    UPW_SUB_PACKAGES_KEY,
    `${UPW_SUB_PACKAGES_KEY} is an upw compile-time structure field and cannot be conditionally patched.`,
  ],
  [
    UNI_SUB_PACKAGES_COMPAT_KEY,
    `${UNI_SUB_PACKAGES_COMPAT_KEY} is a uni-app compatibility alias of ${UPW_SUB_PACKAGES_KEY} and cannot be conditionally patched.`,
  ],
]);

function validateAppPatchTargetFields(patch: Record<string, unknown>, fieldPath: string): void {
  for (const [key, reason] of APP_PATCH_DENIED_TOP_LEVEL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      throw new Error(`${fieldPath}.${reason}`);
    }
  }
}

function validateSubPackageGeneratedFields(app: Record<string, unknown>, appLabel: string): void {
  const value = app[UPW_SUB_PACKAGES_KEY];

  if (!Array.isArray(value)) {
    return;
  }

  value.forEach((item, index) => {
    const itemPath = `${appLabel}.${UPW_SUB_PACKAGES_KEY}[${index}]`;

    if (!isPlainObject(item)) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(item, UNI_PAGES_KEY)) {
      throw new Error(
        `${itemPath}.${UNI_PAGES_KEY} is generated from page-level upw files and $upw.subPackageName and cannot be configured in app.upw.json.`,
      );
    }
  });
}

export function validateUpwAppConfig(
  app: UpwAppSchema,
  options: ValidateUpwAppConfigOptions = {},
): ValidatedUpwAppConfig {
  const appLabel = label(options);
  const meta = normalizeAppMeta(app, appLabel);

  validateAppTopLevelFields(app, appLabel);
  validateAppConditionalPatchTargets(meta.patches, appLabel);
  validateSubPackageGeneratedFields(app, appLabel);

  return meta;
}


