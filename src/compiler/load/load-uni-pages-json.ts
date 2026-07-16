import fs from 'fs-extra';

import {
  DEFAULT_TEXT_ENCODING,
  UNI_SUB_PACKAGES_COMPAT_KEY,
  UNI_SUB_PACKAGES_KEY,
} from '../../schemas/uni-pages.js';
import { parseJsonLike } from '../../utils/json.js';
import type { ParsedUniPagesJson } from '../types.js';
import { createPagesJsonParseSession, normalizePagesJsonComments } from './condition-comments.js';

function normalizeCompatSubPackages(data: Record<string, unknown>): Record<string, unknown> {
  const hasSubPackages = Object.prototype.hasOwnProperty.call(data, UNI_SUB_PACKAGES_KEY);
  const hasCompatSubPackages = Object.prototype.hasOwnProperty.call(
    data,
    UNI_SUB_PACKAGES_COMPAT_KEY,
  );

  if (hasSubPackages && hasCompatSubPackages) {
    throw new Error(
      `${UNI_SUB_PACKAGES_KEY} and ${UNI_SUB_PACKAGES_COMPAT_KEY} cannot be used together in pages.json.`,
    );
  }

  if (hasSubPackages || !hasCompatSubPackages) {
    return data;
  }

  const { [UNI_SUB_PACKAGES_COMPAT_KEY]: subPackages, ...rest } = data;

  return {
    ...rest,
    [UNI_SUB_PACKAGES_KEY]: subPackages,
  };
}

export function readUniPagesJson(filePath: string): ParsedUniPagesJson {
  const raw = fs.readFileSync(filePath, DEFAULT_TEXT_ENCODING);
  const source = normalizePagesJsonComments(raw);
  const session = createPagesJsonParseSession(source);

  return {
    raw,
    appConditionPatches: session.parseAppConditionPatches(),
    data: normalizeCompatSubPackages(
      parseJsonLike<Record<string, unknown>>(session.stripConditionalSections()),
    ),
    conditionBlocks: session.parseConditionBlocks(),
    conditionPatches: session.parseConditionPatches(),
  };
}
