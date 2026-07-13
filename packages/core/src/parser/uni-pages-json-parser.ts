import fs from 'fs-extra';

import type { AppConditionPatch,
  ConditionBlock,
  PageConditionPatch,
} from '../spec/upw-spec.js';
import {
  DEFAULT_TEXT_ENCODING,
  UNI_SUB_PACKAGES_COMPAT_KEY,
  UNI_SUB_PACKAGES_KEY,
} from '../spec/uni-pages-spec.js';
import { parseJsonLike } from '../foundation/json.js';
import {
  parseAppConditionPatches,
  parseConditionBlocks,
  parseConditionPatches,
  normalizePagesJsonComments,
  stripConditionalSections,
} from './condition-parser.js';

export interface ParsedPagesJson {
  raw: string;
  data: Record<string, unknown>;
  appConditionPatches: AppConditionPatch[];
  conditionBlocks: ConditionBlock[];
  conditionPatches: PageConditionPatch[];
}

function normalizeCompatSubPackages(data: Record<string, unknown>): Record<string, unknown> {
  if (
    Object.prototype.hasOwnProperty.call(data, UNI_SUB_PACKAGES_KEY) ||
    !Object.prototype.hasOwnProperty.call(data, UNI_SUB_PACKAGES_COMPAT_KEY)
  ) {
    return data;
  }

  const { [UNI_SUB_PACKAGES_COMPAT_KEY]: subPackages, ...rest } = data;

  return {
    ...rest,
    [UNI_SUB_PACKAGES_KEY]: subPackages,
  };
}

export function parsePagesSource(filePath: string): ParsedPagesJson {
  const raw = fs.readFileSync(filePath, DEFAULT_TEXT_ENCODING);
  const source = normalizePagesJsonComments(raw);

  return {
    raw,
    appConditionPatches: parseAppConditionPatches(source),
    data: normalizeCompatSubPackages(
      parseJsonLike<Record<string, unknown>>(stripConditionalSections(source)),
    ),
    conditionBlocks: parseConditionBlocks(source),
    conditionPatches: parseConditionPatches(source),
  };
}


