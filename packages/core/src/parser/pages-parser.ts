import fs from 'fs-extra';
import { getNodeValue, parseTree, type Node, type ParseError } from 'jsonc-parser';

import type { AppConditionPatch, ConditionBlock, PageConditionPatch } from '../ir/types.js';
import {
  DEFAULT_TEXT_ENCODING,
  UNI_SUBPACKAGES_COMPAT_KEY,
  UNI_SUBPACKAGES_KEY,
} from '../internal/constants.js';
import { parseJsonLike } from '../internal/json.js';
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

function normalizeLegacySubpackagesKey(source: string): string {
  const stripped = stripConditionalSections(source);
  const data = parseJsonLike<Record<string, unknown>>(stripped);

  if (
    !Object.prototype.hasOwnProperty.call(data, UNI_SUBPACKAGES_COMPAT_KEY) ||
    Object.prototype.hasOwnProperty.call(data, UNI_SUBPACKAGES_KEY)
  ) {
    return source;
  }

  const errors: ParseError[] = [];
  const root = parseTree(source, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  const legacyProperty = root?.children?.find((node): node is Node => {
    if (node.type !== 'property') {
      return false;
    }

    const [name] = node.children ?? [];

    return name ? getNodeValue(name) === UNI_SUBPACKAGES_COMPAT_KEY : false;
  });
  const nameNode = legacyProperty?.children?.[0];

  if (!nameNode) {
    return source;
  }

  return `${source.slice(0, nameNode.offset)}${JSON.stringify(UNI_SUBPACKAGES_KEY)}${source.slice(
    nameNode.offset + nameNode.length,
  )}`;
}

export function parsePagesSource(filePath: string): ParsedPagesJson {
  const raw = fs.readFileSync(filePath, DEFAULT_TEXT_ENCODING);
  const source = normalizeLegacySubpackagesKey(normalizePagesJsonComments(raw));

  return {
    raw,
    appConditionPatches: parseAppConditionPatches(source),
    data: parseJsonLike<Record<string, unknown>>(stripConditionalSections(source)),
    conditionBlocks: parseConditionBlocks(source),
    conditionPatches: parseConditionPatches(source),
  };
}
