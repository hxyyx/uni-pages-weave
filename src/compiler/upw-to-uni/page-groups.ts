import type { UpwMeta } from '../../schemas/upw.js';
import { UPW_META_KEY, UPW_SUB_PACKAGES_KEY } from '../../schemas/upw.js';
import { UNI_PAGE_PATH_KEY } from '../../schemas/uni-pages.js';
import type { BuildSubPackage, OutputPage } from '../types.js';
import { relativeSubPackagePath } from '../analyze/analyze-upw-workspace.js';

export interface PageGroups {
  mainPages: OutputPage[];
  platformPages: OutputPage[];
  subPackagePages: Map<string, OutputPage[]>;
}

export function createPageGroups(): PageGroups {
  return {
    mainPages: [],
    platformPages: [],
    subPackagePages: new Map<string, OutputPage[]>(),
  };
}

function createOutputPage(options: {
  page: Record<string, unknown>;
  meta?: UpwMeta;
  sourceFile?: string;
  readOrder: number;
  isPlatformPage?: boolean;
}): OutputPage {
  return {
    page: options.page,
    ...(options.meta ? { meta: options.meta } : {}),
    ...(options.sourceFile ? { sourceFile: options.sourceFile } : {}),
    readOrder: options.readOrder,
    isPlatformPage: options.isPlatformPage ?? false,
  };
}

function stripSubPackageMeta(meta: UpwMeta | undefined): UpwMeta | undefined {
  if (!meta) {
    return undefined;
  }

  const { subPackageName: _subPackageName, ...rest } = meta;

  return Object.keys(rest).length > 0 ? rest : undefined;
}

export function addValidatedPageToGroups(options: {
  page: Record<string, unknown>;
  meta?: UpwMeta;
  sourceFile?: string;
  readOrder: number;
  isPlatformPage?: boolean;
  label: string;
  appFileLabel?: string;
  subPackageMap: Map<string, BuildSubPackage>;
  groups: PageGroups;
}): void {
  const outputPage = options.page;

  if (options.isPlatformPage) {
    options.groups.platformPages.push(
      createOutputPage({
        page: outputPage,
        meta: options.meta,
        sourceFile: options.sourceFile,
        readOrder: options.readOrder,
        isPlatformPage: true,
      }),
    );
    return;
  }

  if (options.meta?.subPackageName) {
    const subPackage = options.subPackageMap.get(options.meta.subPackageName);

    if (!subPackage) {
      const source = options.appFileLabel
        ? `Define it in ${options.appFileLabel} ${UPW_SUB_PACKAGES_KEY}.`
        : '';

      throw new Error(
        `${options.label} references unknown ${UPW_META_KEY}.subPackageName "${options.meta.subPackageName}".${source ? ` ${source}` : ''}`,
      );
    }

    const { [UNI_PAGE_PATH_KEY]: _path, ...rest } = outputPage;
    const entryGroup = options.groups.subPackagePages.get(options.meta.subPackageName) ?? [];
    const relativePage = {
      ...rest,
      [UNI_PAGE_PATH_KEY]: relativeSubPackagePath(
        options.page[UNI_PAGE_PATH_KEY] as string,
        subPackage,
      ),
    };

    entryGroup.push(
      createOutputPage({
        page: relativePage,
        meta: stripSubPackageMeta(options.meta),
        sourceFile: options.sourceFile,
        readOrder: options.readOrder,
      }),
    );
    options.groups.subPackagePages.set(options.meta.subPackageName, entryGroup);
    return;
  }

  options.groups.mainPages.push(
    createOutputPage({
      page: outputPage,
      meta: options.meta,
      sourceFile: options.sourceFile,
      readOrder: options.readOrder,
    }),
  );
}
