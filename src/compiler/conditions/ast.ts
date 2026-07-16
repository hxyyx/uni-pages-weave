import type { ConditionNode } from '../../schemas/upw.js';
import {
  UNI_PAGES_KEY,
  UNI_SUB_PACKAGES_COMPAT_KEY,
  UNI_SUB_PACKAGES_KEY,
  UNI_SUB_PACKAGE_ROOT_KEY,
} from '../../schemas/uni-pages.js';
import { parseJsonLike } from '../../utils/json.js';
import {
  findNodeAtLocation,
  getNodeValue,
  parseTree,
  type Node,
  type ParseError,
} from 'jsonc-parser';
import {
  conditionsBeforeLine,
  lineNumberAt,
  type ConditionDirective,
  type ConditionsForLine,
} from './directives.js';
import { stripConditionalSections, stripConditionalSectionsForConditions } from './strip.js';

export type JsoncNode = Node;
export type ParseNodeValue = (node: Node) => unknown | undefined;
export type ParseNodeValueForConditions = (
  node: Node,
  conditions: ConditionNode[],
) => unknown | undefined;

const CACHED_UNDEFINED = Symbol('cached undefined parse result');

export class NodeValueParserCache {
  private readonly values = new Map<string, typeof CACHED_UNDEFINED | unknown>();

  getOrParse<TValue>(key: string, parse: () => TValue | undefined): TValue | undefined {
    if (this.values.has(key)) {
      const cached = this.values.get(key);

      return cached === CACHED_UNDEFINED ? undefined : (cached as TValue);
    }

    const value = parse();

    this.values.set(key, value === undefined ? CACHED_UNDEFINED : value);

    return value;
  }
}

export function propertyValueNode(node: Node | undefined, key: string): Node | undefined {
  if (!node || node.type !== 'object') {
    return undefined;
  }

  return node.children
    ?.filter((child) => child.type === 'property')
    .map((child) => child.children ?? [])
    .find(([name]) => getNodeValue(name) === key)?.[1];
}

export function parseNodeValue(source: string, node: Node): unknown | undefined {
  try {
    return parseJsonLike(
      stripConditionalSections(source.slice(node.offset, node.offset + node.length)),
    );
  } catch {
    return undefined;
  }
}

export function parseNodeValueForConditions(
  source: string,
  node: Node,
  conditions: ConditionNode[],
): unknown | undefined {
  try {
    return parseJsonLike(
      stripConditionalSectionsForConditions(
        source.slice(node.offset, node.offset + node.length),
        conditions,
      ),
    );
  } catch {
    return undefined;
  }
}

export function nodeStringValue(node: Node | undefined): string | undefined {
  const value: unknown = node ? getNodeValue(node) : undefined;

  return typeof value === 'string' ? value : undefined;
}

export function pageNodesFromArray(pagesNode: Node | undefined): Node[] {
  if (!pagesNode || pagesNode.type !== 'array') {
    return [];
  }

  return (pagesNode.children ?? []).filter((child) => child.type === 'object');
}

export function subPackagesNode(root: Node): Node | undefined {
  return (
    findNodeAtLocation(root, [UNI_SUB_PACKAGES_KEY]) ??
    findNodeAtLocation(root, [UNI_SUB_PACKAGES_COMPAT_KEY])
  );
}

export function subPackageNodes(root: Node): Node[] {
  const subPackages = subPackagesNode(root);

  if (subPackages?.type !== 'array') {
    return [];
  }

  return subPackages.children ?? [];
}

export function subPackagePageNodes(root: Node): Array<{ node: Node; root?: string }> {
  return subPackageNodes(root).flatMap((subPackage) =>
    pageNodesFromArray(propertyValueNode(subPackage, UNI_PAGES_KEY)).map((node) => ({
      node,
      root: nodeStringValue(propertyValueNode(subPackage, UNI_SUB_PACKAGE_ROOT_KEY)),
    })),
  );
}

export function pageNodes(root: Node): Node[] {
  const topLevelPages = pageNodesFromArray(findNodeAtLocation(root, [UNI_PAGES_KEY]));
  const subPackagePages = subPackageNodes(root).flatMap((subPackage) =>
    pageNodesFromArray(propertyValueNode(subPackage, UNI_PAGES_KEY)),
  );

  return [...topLevelPages, ...subPackagePages];
}

function parsePagesRoot(code: string): Node | undefined {
  const errors: ParseError[] = [];
  const root = parseTree(code, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  if (!root || root.type !== 'object') {
    return undefined;
  }

  return root;
}

function validateConditionalCompilationUnits(
  code: string,
  directives: Map<number, ConditionDirective>,
  node: Node,
  conditionsForLine: ConditionsForLine = (line) => conditionsBeforeLine(directives, line),
  parent?: Node,
): void {
  const parentConditionCount = parent
    ? conditionsForLine(lineNumberAt(code, parent.offset)).length
    : 0;
  const conditionCount = conditionsForLine(lineNumberAt(code, node.offset)).length;

  if (
    conditionCount > parentConditionCount &&
    node.type !== 'property' &&
    parent?.type !== 'array'
  ) {
    throw new Error(
      'Conditional compilation must wrap a complete JSON object member or array item.',
    );
  }

  for (const child of node.children ?? []) {
    validateConditionalCompilationUnits(code, directives, child, conditionsForLine, node);
  }
}

function validateNoConditionalSubPackageObjects(
  code: string,
  directives: Map<number, ConditionDirective>,
  root: Node,
  conditionsForLine: ConditionsForLine = (line) => conditionsBeforeLine(directives, line),
): void {
  const subPackages = subPackagesNode(root);

  if (subPackages && conditionsForLine(lineNumberAt(code, subPackages.offset)).length > 0) {
    return;
  }

  for (const subPackage of subPackageNodes(root)) {
    if (conditionsForLine(lineNumberAt(code, subPackage.offset)).length > 0) {
      throw new Error('Conditional compilation cannot wrap a subPackage object.');
    }
  }
}

export function parseValidatedPagesRoot(
  code: string,
  directives: Map<number, ConditionDirective>,
  conditionsForLine?: ConditionsForLine,
): Node | undefined {
  const root = parsePagesRoot(code);

  if (root) {
    validateConditionalCompilationUnits(code, directives, root, conditionsForLine);
    validateNoConditionalSubPackageObjects(code, directives, root, conditionsForLine);
  }

  return root;
}
