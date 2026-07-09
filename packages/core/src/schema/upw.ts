import type { ConditionalPatch } from '../ir/types.js';

// UPW schemas intentionally keep unknown keys because most uni-app pages.json
// fields are pass-through data owned by uni-app, plugins, or platform targets.
export interface UpwAppMetaSchema {
  patches?: ConditionalPatch[];
}

export interface UpwPageMetaSchema {
  subpackageName?: string;
  conditions?: ConditionalPatch['conditions'];
  when?: string[];
  unless?: string[];
  patches?: ConditionalPatch[];
}

export interface UpwSubpackageSchema extends Record<string, unknown> {
  name: string;
  root: string;
  pages?: unknown;
}

export interface UpwAppSchema extends Record<string, unknown> {
  $upw?: UpwAppMetaSchema;
  homePath: string;
  subpackages?: UpwSubpackageSchema[];
}

export interface UpwPageSchema extends Record<string, unknown> {
  $upw?: UpwPageMetaSchema;
  path: string;
  style?: Record<string, unknown>;
}
