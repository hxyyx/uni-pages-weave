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
  subpackageName?: string;
  conditions?: ConditionLayer[];
  when?: string[];
  unless?: string[];
  patches?: ConditionalPatch[];
}

export type UpwPageMeta = PageMeta;

export type UpwMeta = PageMeta;

export interface AppMeta {
  patches?: ConditionalPatch[];
}

export type UpwAppMeta = AppMeta;

export interface UpwSubpackage extends Record<string, unknown> {
  name: string;
  root: string;
}

export interface UpwPageEntry {
  path: string;
  config: Record<string, unknown>;
  isPlatformPath: boolean;
  meta?: PageMeta;
  sourceFile?: string;
  subpackageName?: string;
}

export interface UpwWorkspace {
  app: Record<string, unknown>;
  appMeta?: AppMeta;
  pages: UpwPageEntry[];
  subpackages: UpwSubpackage[];
  sourceDir: string;
}

export interface ConditionBlock {
  content: unknown;
  conditions: PlatformCondition[];
  subpackageRoot?: string;
}

export interface PageConditionPatch {
  pagePath: string;
  subpackageRoot?: string;
  conditions: PlatformCondition[];
  patch: Record<string, unknown>;
}

export interface AppConditionPatch {
  conditions: PlatformCondition[];
  patch: Record<string, unknown>;
}
