import type {
  AppConditionPatch,
  ConditionBlock,
  PageConditionPatch,
  UpwAppSchema,
  UpwMeta,
  UpwPageSchema,
  UpwSubPackage,
} from '../schemas/upw.js';

export interface ParsedUniPagesJson {
  raw: string;
  data: Record<string, unknown>;
  appConditionPatches: AppConditionPatch[];
  conditionBlocks: ConditionBlock[];
  conditionPatches: PageConditionPatch[];
}

export interface UniToUpwSubPackage extends UpwSubPackage {
  pages?: unknown;
}

export interface UniToUpwPageEntry {
  page: Record<string, unknown>;
  upw?: UpwMeta;
}

export interface UniPagesAnalysis {
  appPatches: NonNullable<UpwMeta['patches']>;
  conditionalPages: UniToUpwPageEntry[];
  data: Record<string, unknown>;
  pagePatches: PageConditionPatch[];
  pages: UniToUpwPageEntry[];
  subPackages: UniToUpwSubPackage[];
}

export interface UpwWorkspaceAppFile {
  config: UpwAppSchema;
  path: string;
}

export interface UpwWorkspacePageFile {
  config: UpwPageSchema;
  forbidUpw: boolean;
  pagePath: string;
  path: string;
}

export interface UpwWorkspaceFiles {
  appFile: UpwWorkspaceAppFile;
  pageFiles: UpwWorkspacePageFile[];
}

export type GeneratedUpwSourceFileKind = 'app' | 'page';

export interface GeneratedUpwSourceFile {
  kind: GeneratedUpwSourceFileKind;
  path: string;
}

export interface PlannedUpwSourceFile {
  content: string;
  kind: GeneratedUpwSourceFileKind;
  path: string;
}

export interface BuildSubPackage extends UpwSubPackage {
  pages?: unknown;
}

export interface OutputPage {
  page: Record<string, unknown>;
  meta?: UpwMeta;
  sourceFile?: string;
  readOrder: number;
  isPlatformPage: boolean;
}

export interface RenderUpwWorkspaceData {
  app: UpwAppSchema;
  pages: UpwPageSchema[];
  platformPages?: UpwPageSchema[];
}

export interface UpwProjectPageSource {
  data: unknown;
  file: string;
  readOrder: number;
}

export interface UniPagesJsonRenderWorkspace {
  app: UpwAppSchema;
  appPatches: NonNullable<UpwMeta['patches']>;
  pages: OutputPage[];
  subPackages: BuildSubPackage[];
  subPackagePages: Map<string, OutputPage[]>;
}
