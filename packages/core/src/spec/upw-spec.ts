export const UPW_CLI_NAME = 'upw';
export const UPW_SUB_PACKAGES_KEY = 'subPackages';

export const UPW_TARGET_DIR = '.upw';
export const UPW_APP_FILE = 'app.upw.json';
export const UPW_PAGE_EXTENSION = '.upw.json';
export const UPW_PAGE_FILE_GLOB = '*.upw.json';
export const UPW_PAGE_FILE_PATTERN = /\.upw\.json$/u;
export const UPW_PAGES_DIR = 'pages';
export const UPW_PLATFORMS_DIR = 'platforms';

export const UPW_HOME_PATH_KEY = 'homePath';

export const UPW_IFDEF_DIRECTIVE = 'ifdef';
export const UPW_IFNDEF_DIRECTIVE = 'ifndef';
export const UPW_IFDEF_COMMENT = `#${UPW_IFDEF_DIRECTIVE}`;
export const UPW_IFNDEF_COMMENT = `#${UPW_IFNDEF_DIRECTIVE}`;
export const UPW_ENDIF_COMMENT = '#endif';
export const UPW_IF_DIRECTIVE_PATTERN =
  /^#(ifdef|ifndef)\s*([A-Za-z0-9_-]+(?:\s*\|\|\s*[A-Za-z0-9_-]+)*)\s*$/u;
export const UPW_ENDIF_DIRECTIVE_PATTERN = /^#endif\s*$/u;

export const UPW_META_KEY = '$upw';
export const UPW_META_SUB_PACKAGE_NAME_KEY = 'subPackageName';
export const UPW_META_CONDITIONS_KEY = 'conditions';
export const UPW_META_WHEN_KEY = 'when';
export const UPW_META_UNLESS_KEY = 'unless';
export const UPW_META_PATCHES_KEY = 'patches';
export const UPW_META_PATCH_KEY = 'patch';
export const UPW_META_CHILDREN_KEY = 'children';

export const UPW_META_ALLOWED_KEYS = [
  UPW_META_SUB_PACKAGE_NAME_KEY,
  UPW_META_CONDITIONS_KEY,
  UPW_META_WHEN_KEY,
  UPW_META_UNLESS_KEY,
  UPW_META_PATCHES_KEY,
] as const;

export const UPW_APP_META_ALLOWED_KEYS = [UPW_HOME_PATH_KEY, UPW_META_PATCHES_KEY] as const;

export const UPW_CONDITIONAL_PATCH_ALLOWED_KEYS = [
  UPW_META_CONDITIONS_KEY,
  UPW_META_WHEN_KEY,
  UPW_META_UNLESS_KEY,
  UPW_META_PATCH_KEY,
  UPW_META_CHILDREN_KEY,
] as const;

export const UPW_CONDITIONAL_CHILD_PATCH_ALLOWED_KEYS = [
  UPW_META_CONDITIONS_KEY,
  UPW_META_WHEN_KEY,
  UPW_META_UNLESS_KEY,
  UPW_META_PATCH_KEY,
] as const;

export type ConditionDirective = 'ifdef' | 'ifndef';

export interface PlatformCondition {
  directive: ConditionDirective;
  env: string[];
  condition?: string;
}

export type ConditionNode = PlatformCondition;

export type ConditionLayer =
  | { when: string[]; unless?: never }
  | { unless: string[]; when?: never };

export interface ConditionMeta {
  conditions?: ConditionLayer[];
  when?: string[];
  unless?: string[];
}

export interface ConditionalChildPatch extends ConditionMeta {
  patch: Record<string, unknown>;
}

export interface ConditionalPatch extends ConditionMeta {
  patch: Record<string, unknown>;
  children?: ConditionalChildPatch[];
}

export interface PageMeta {
  subPackageName?: string;
  conditions?: ConditionLayer[];
  when?: string[];
  unless?: string[];
  patches?: ConditionalPatch[];
}

export type UpwMeta = PageMeta;

export interface UpwSubPackage extends Record<string, unknown> {
  name: string;
  root: string;
}

export interface ConditionBlock {
  content: unknown;
  conditions: PlatformCondition[];
  subPackageRoot?: string;
}

export interface PageConditionPatch {
  pagePath: string;
  subPackageRoot?: string;
  conditions: PlatformCondition[];
  patch: Record<string, unknown>;
}

export interface AppConditionPatch {
  conditions: PlatformCondition[];
  patch: Record<string, unknown>;
}

// upw schemas intentionally keep unknown keys because most uni-app pages.json
// fields are pass-through data owned by uni-app, plugins, or platform targets.
export interface UpwAppMetaSchema {
  homePath?: string;
  patches?: ConditionalPatch[];
}

export interface UpwPageMetaSchema {
  subPackageName?: string;
  conditions?: ConditionalPatch['conditions'];
  when?: string[];
  unless?: string[];
  patches?: ConditionalPatch[];
}

export interface UpwSubPackageSchema extends Record<string, unknown> {
  name: string;
  root: string;
  pages?: unknown;
}

export interface UpwAppSchema extends Record<string, unknown> {
  $upw?: UpwAppMetaSchema;
  subPackages?: UpwSubPackageSchema[];
}

export interface UpwPageSchema extends Record<string, unknown> {
  $upw?: UpwPageMetaSchema;
  path: string;
  style?: Record<string, unknown>;
}




