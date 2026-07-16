import type {
  ConditionalPatch,
  UpwAppMetaSchema,
  UpwAppSchema,
  UpwMeta,
  UpwPageSchema,
} from '../../schemas/upw.js';
import {
  UPW_HOME_PATH_KEY,
  UPW_META_KEY,
  UPW_META_SUB_PACKAGE_NAME_KEY,
  UPW_SUB_PACKAGES_KEY,
} from '../../schemas/upw.js';
import { UNI_PAGES_KEY, UNI_PAGE_PATH_KEY, UNI_SUB_PACKAGES_KEY } from '../../schemas/uni-pages.js';
import { isPlainObject } from '../../utils/object.js';

interface UniToUpwSubPackageFragment extends Record<string, unknown> {
  pages?: unknown;
}

export interface ConvertUniAppFragmentToUpwAppOptions {
  appPatches: ConditionalPatch[];
  subPackages: UniToUpwSubPackageFragment[];
}

function pagePath(value: unknown): string | undefined {
  return isPlainObject(value) && typeof value[UNI_PAGE_PATH_KEY] === 'string'
    ? value[UNI_PAGE_PATH_KEY]
    : undefined;
}

function homePath(data: Record<string, unknown>): string | undefined {
  const pages = data[UNI_PAGES_KEY];

  if (!Array.isArray(pages)) {
    return undefined;
  }

  return pagePath(pages[0]);
}

function externalUpwMeta(upw: UpwMeta): Record<string, unknown> {
  const { subPackageName, ...rest } = upw;

  return {
    ...(subPackageName ? { [UPW_META_SUB_PACKAGE_NAME_KEY]: subPackageName } : {}),
    ...rest,
  };
}

export function convertUniAppFragmentToUpwApp(
  data: Record<string, unknown>,
  options: ConvertUniAppFragmentToUpwAppOptions,
): UpwAppSchema {
  const {
    [UNI_PAGES_KEY]: _pages,
    [UNI_SUB_PACKAGES_KEY]: _uniSubPackages,
    [UPW_META_KEY]: _upw,
    ...app
  } = data;
  const appMeta: UpwAppMetaSchema = {};
  const pageHomePath = homePath(data);

  if (pageHomePath) {
    appMeta[UPW_HOME_PATH_KEY] = pageHomePath;
  }

  if (options.appPatches.length > 0) {
    appMeta.patches = options.appPatches;
  }

  const subPackages = options.subPackages.map(
    ({ [UNI_PAGES_KEY]: _subPackagePages, ...subPackage }) => subPackage,
  );
  const output = {
    ...(Object.keys(appMeta).length > 0 ? { [UPW_META_KEY]: appMeta } : {}),
    ...app,
    [UPW_SUB_PACKAGES_KEY]: subPackages,
  };

  return output as UpwAppSchema;
}

export function convertUniPageFragmentToUpwPage(
  page: Record<string, unknown>,
  upw?: UpwMeta,
): UpwPageSchema {
  const output = upw ? { [UPW_META_KEY]: externalUpwMeta(upw), ...page } : { ...page };

  return output as UpwPageSchema;
}
