import type { ConditionBlock } from '../../schemas/upw.js';
import {
  UNI_PAGES_KEY,
  UNI_PAGE_PATH_KEY,
  UNI_SUB_PACKAGE_ROOT_KEY,
} from '../../schemas/uni-pages.js';
import { parseJsonLike } from '../../utils/json.js';
import { isPlainObject } from '../../utils/object.js';
import { findNodeAtLocation, type Node } from 'jsonc-parser';
import {
  conditionsBeforeLine,
  lineNumberAt,
  type ConditionDirective,
  type ConditionsForLine,
} from './directives.js';
import {
  nodeStringValue,
  propertyValueNode,
  subPackageNodes,
} from './ast.js';
import { stripConditionalSections } from './strip.js';

function parsePageObject(source: string): Record<string, unknown> | undefined {
  try {
    const value = parseJsonLike(source);

    if (isPlainObject(value) && typeof value[UNI_PAGE_PATH_KEY] === 'string') {
      return value;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function pageBlock(
  code: string,
  directives: Map<number, ConditionDirective>,
  node: Node,
  subPackageRoot?: string,
  conditionsForLine: ConditionsForLine = (line) => conditionsBeforeLine(directives, line),
): ConditionBlock | undefined {
  const conditions = conditionsForLine(lineNumberAt(code, node.offset));

  if (conditions.length === 0) {
    return undefined;
  }

  if (node.type !== 'object') {
    throw new Error('Conditional compilation must wrap a complete page object.');
  }

  const pageSource = code.slice(node.offset, node.offset + node.length);
  const content = parsePageObject(stripConditionalSections(pageSource));

  if (!content) {
    throw new Error('Conditional compilation must wrap a complete page object with a string path.');
  }

  return {
    conditions,
    content,
    subPackageRoot,
  };
}

function pageBlocksFromArray(
  code: string,
  directives: Map<number, ConditionDirective>,
  pagesNode: Node | undefined,
  subPackageRoot?: string,
  conditionsForLine?: ConditionsForLine,
): ConditionBlock[] {
  if (!pagesNode || pagesNode.type !== 'array') {
    return [];
  }

  return (pagesNode.children ?? [])
    .map((child) => pageBlock(code, directives, child, subPackageRoot, conditionsForLine))
    .filter((block): block is ConditionBlock => Boolean(block));
}

export function collectConditionBlocks(options: {
  source: string;
  directives: Map<number, ConditionDirective>;
  root: Node | undefined;
  conditionsForLine: ConditionsForLine;
}): ConditionBlock[] {
  const { root } = options;

  if (!root) {
    return [];
  }

  const topLevelPages = pageBlocksFromArray(
    options.source,
    options.directives,
    findNodeAtLocation(root, [UNI_PAGES_KEY]),
    undefined,
    options.conditionsForLine,
  );
  const subPackagePages = subPackageNodes(root).flatMap((subPackage) =>
    pageBlocksFromArray(
      options.source,
      options.directives,
      propertyValueNode(subPackage, UNI_PAGES_KEY),
      nodeStringValue(propertyValueNode(subPackage, UNI_SUB_PACKAGE_ROOT_KEY)),
      options.conditionsForLine,
    ),
  );

  return [...topLevelPages, ...subPackagePages];
}
