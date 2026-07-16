import {
  UNI_PAGES_KEY,
  UNI_PAGE_PATH_KEY,
  UNI_SUB_PACKAGES_KEY,
  UNI_SUB_PACKAGE_ROOT_KEY,
} from '../../schemas/uni-pages.js';
import { isPlainObject } from '../../utils/object.js';

export function readPageEntries(value: unknown, label: string): Record<string, unknown>[] {
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

export function assertUnconditionalMainHomePage(data: Record<string, unknown>): void {
  const pages = data[UNI_PAGES_KEY];

  if (
    Array.isArray(pages) &&
    isPlainObject(pages[0]) &&
    typeof pages[0][UNI_PAGE_PATH_KEY] === 'string'
  ) {
    return;
  }

  throw new Error(
    'uni-app pages.json must define an unconditional main package home page before it can be converted to upw.',
  );
}

export interface RawSubPackageConfig extends Record<string, unknown> {
  root: string;
  name?: unknown;
  pages?: unknown;
}

export function readRawSubPackageConfig(value: unknown, label: string): RawSubPackageConfig {
  if (!isPlainObject(value) || typeof value[UNI_SUB_PACKAGE_ROOT_KEY] !== 'string') {
    throw new Error(`${label} must be a subPackage object with a string root.`);
  }

  return value as RawSubPackageConfig;
}

export function readRawSubPackageValues(data: Record<string, unknown>): unknown[] {
  const value = data[UNI_SUB_PACKAGES_KEY];

  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${UNI_SUB_PACKAGES_KEY} must be an array.`);
  }

  return value;
}
