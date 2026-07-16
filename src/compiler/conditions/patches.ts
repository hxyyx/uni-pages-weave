import type {
  AppConditionPatch,
  ConditionNode,
  PageConditionPatch,
} from '../../schemas/upw.js';
import {
  UNI_PAGES_KEY,
  UNI_PAGE_PATH_KEY,
  UNI_SUB_PACKAGES_COMPAT_KEY,
  UNI_SUB_PACKAGES_KEY,
} from '../../schemas/uni-pages.js';
import { findNodeAtLocation, getNodeValue, type Node } from 'jsonc-parser';
import {
  cloneConditions,
  conditionGroupKey,
  conditionsBeforeLine,
  lineNumberAt,
  type ConditionDirective,
  type ConditionsForLine,
} from './directives.js';
import {
  nodeStringValue,
  pageNodes,
  pageNodesFromArray,
  propertyValueNode,
  subPackagePageNodes,
  type ParseNodeValue,
  type ParseNodeValueForConditions,
} from './ast.js';

interface ConditionalMemberPatch {
  conditions: ConditionNode[];
  patch: Record<string, unknown>;
}

interface CollectConditionalMemberPatchOptions {
  ancestorConditionCount?: number;
  baseConditionCount?: number;
  conditionsForLine?: ConditionsForLine;
  deniedTopLevelKeys?: ReadonlyMap<string, string>;
  parseNodeValue?: ParseNodeValue;
  parseNodeValueForConditions?: ParseNodeValueForConditions;
  skipRanges?: Array<readonly [number, number]>;
}

const APP_PATCH_DENIED_TOP_LEVEL_KEYS = new Map<string, string>([
  ['$upw', '$upw is upw metadata and cannot be used as an app conditional patch target.'],
  [
    UNI_PAGES_KEY,
    `${UNI_PAGES_KEY} is generated from page-level upw files and cannot be used as an app conditional patch target.`,
  ],
  [
    UNI_SUB_PACKAGES_KEY,
    `${UNI_SUB_PACKAGES_KEY} is an upw compile-time structure field and cannot be used as an app conditional patch target.`,
  ],
  [
    UNI_SUB_PACKAGES_COMPAT_KEY,
    `${UNI_SUB_PACKAGES_COMPAT_KEY} is a uni-app compatibility alias of ${UNI_SUB_PACKAGES_KEY} and cannot be used as an app conditional patch target.`,
  ],
]);

function patchAtPath(path: string[], value: unknown): Record<string, unknown> {
  return path.reduceRight<unknown>((current, key) => ({ [key]: current }), value) as Record<
    string,
    unknown
  >;
}

function relativeConditions(
  conditions: ConditionNode[],
  baseConditionCount: number,
): ConditionNode[] {
  return cloneConditions(conditions.slice(baseConditionCount));
}

function offsetInRanges(offset: number, ranges: Array<readonly [number, number]>): boolean {
  return ranges.some(([start, end]) => offset >= start && offset < end);
}

function shouldSkipNode(
  node: Node,
  skipRanges: Array<readonly [number, number]> | undefined,
): boolean {
  return skipRanges ? offsetInRanges(node.offset, skipRanges) : false;
}

function collectConditionGroupsInNode(
  code: string,
  directives: Map<number, ConditionDirective>,
  node: Node,
  baseConditionCount: number,
  ancestorConditionCount: number,
  conditionsForLine: ConditionsForLine = (line) => conditionsBeforeLine(directives, line),
  groups = new Map<string, ConditionNode[]>(),
): Map<string, ConditionNode[]> {
  const conditions = conditionsForLine(lineNumberAt(code, node.offset));

  if (conditions.length > ancestorConditionCount) {
    const relative = relativeConditions(conditions, baseConditionCount);

    groups.set(conditionGroupKey(relative), relative);
    ancestorConditionCount = conditions.length;
  }

  for (const child of node.children ?? []) {
    collectConditionGroupsInNode(
      code,
      directives,
      child,
      baseConditionCount,
      ancestorConditionCount,
      conditionsForLine,
      groups,
    );
  }

  return groups;
}

function collectConditionalArrayMemberPatches(
  code: string,
  directives: Map<number, ConditionDirective>,
  arrayNode: Node,
  path: string[],
  baseConditionCount: number,
  ancestorConditionCount: number,
  conditionsForLine: ConditionsForLine,
  parseValueForConditions: ParseNodeValueForConditions,
): ConditionalMemberPatch[] {
  return Array.from(
    collectConditionGroupsInNode(
      code,
      directives,
      arrayNode,
      baseConditionCount,
      ancestorConditionCount,
      conditionsForLine,
    ).values(),
  ).flatMap((conditions) => {
    const value = parseValueForConditions(arrayNode, conditions);

    return value === undefined
      ? []
      : [
          {
            conditions,
            patch: patchAtPath(path, value),
          },
        ];
  });
}

function collectConditionalMemberPatches(
  code: string,
  directives: Map<number, ConditionDirective>,
  node: Node,
  parentPath: string[] = [],
  options: CollectConditionalMemberPatchOptions = {},
): ConditionalMemberPatch[] {
  if (shouldSkipNode(node, options.skipRanges)) {
    return [];
  }

  if (node.type !== 'object') {
    return [];
  }

  const patches: ConditionalMemberPatch[] = [];
  const baseConditionCount = options.baseConditionCount ?? 0;
  const ancestorConditionCount = options.ancestorConditionCount ?? baseConditionCount;
  const conditionsForLine =
    options.conditionsForLine ?? ((line: number) => conditionsBeforeLine(directives, line));

  if (!options.parseNodeValue || !options.parseNodeValueForConditions) {
    throw new Error('Conditional patch collection requires node value parsers.');
  }

  for (const property of node.children ?? []) {
    if (property.type !== 'property' || shouldSkipNode(property, options.skipRanges)) {
      continue;
    }

    const [name, valueNode] = property.children ?? [];
    const key = getNodeValue(name);

    if (typeof key !== 'string' || !valueNode) {
      continue;
    }

    const propertyConditions = conditionsForLine(lineNumberAt(code, property.offset));
    const conditions = relativeConditions(propertyConditions, baseConditionCount);
    const path = [...parentPath, key];
    const hasNewCondition = propertyConditions.length > ancestorConditionCount;

    if (hasNewCondition && conditions.length > 0) {
      const deniedReason =
        parentPath.length === 0 ? options.deniedTopLevelKeys?.get(key) : undefined;

      if (deniedReason) {
        throw new Error(deniedReason);
      }

      const value = options.parseNodeValue(valueNode);

      if (value !== undefined) {
        patches.push({
          conditions,
          patch: patchAtPath(path, value),
        });
      }
    }

    const isDeniedTopLevelKey =
      parentPath.length === 0 && options.deniedTopLevelKeys?.has(key) === true;

    if (valueNode.type === 'array' && !isDeniedTopLevelKey) {
      patches.push(
        ...collectConditionalArrayMemberPatches(
          code,
          directives,
          valueNode,
          path,
          baseConditionCount,
          hasNewCondition ? propertyConditions.length : ancestorConditionCount,
          conditionsForLine,
          options.parseNodeValueForConditions,
        ),
      );
    }

    patches.push(
      ...collectConditionalMemberPatches(code, directives, valueNode, path, {
        ...options,
        ancestorConditionCount: hasNewCondition
          ? propertyConditions.length
          : ancestorConditionCount,
      }),
    );
  }

  return patches;
}

export function collectPageConditionPatches(options: {
  source: string;
  directives: Map<number, ConditionDirective>;
  root: Node | undefined;
  conditionsForLine: ConditionsForLine;
  parseNodeValue: ParseNodeValue;
  parseNodeValueForConditions: ParseNodeValueForConditions;
}): PageConditionPatch[] {
  const { root } = options;

  if (!root) {
    return [];
  }

  const topLevelPages: Array<{ node: Node; root?: string }> = pageNodesFromArray(
    findNodeAtLocation(root, [UNI_PAGES_KEY]),
  ).map((node) => ({ node }));
  const pages = [...topLevelPages, ...subPackagePageNodes(root)];

  return pages.flatMap(({ node, root: subPackageRoot }) => {
    const pagePath = nodeStringValue(propertyValueNode(node, UNI_PAGE_PATH_KEY));

    if (!pagePath) {
      return [];
    }

    const baseConditionCount = options.conditionsForLine(lineNumberAt(options.source, node.offset))
      .length;

    return collectConditionalMemberPatches(options.source, options.directives, node, [], {
      baseConditionCount,
      conditionsForLine: options.conditionsForLine,
      parseNodeValue: options.parseNodeValue,
      parseNodeValueForConditions: options.parseNodeValueForConditions,
    }).map((patch) => ({
      pagePath,
      subPackageRoot,
      conditions: patch.conditions,
      patch: patch.patch,
    }));
  });
}

export function collectAppConditionPatches(options: {
  source: string;
  directives: Map<number, ConditionDirective>;
  root: Node | undefined;
  conditionsForLine: ConditionsForLine;
  parseNodeValue: ParseNodeValue;
  parseNodeValueForConditions: ParseNodeValueForConditions;
}): AppConditionPatch[] {
  const { root } = options;

  if (!root) {
    return [];
  }

  const pageRanges = pageNodes(root).map(
    (node) => [node.offset, node.offset + node.length] as const,
  );

  return collectConditionalMemberPatches(options.source, options.directives, root, [], {
    conditionsForLine: options.conditionsForLine,
    deniedTopLevelKeys: APP_PATCH_DENIED_TOP_LEVEL_KEYS,
    parseNodeValue: options.parseNodeValue,
    parseNodeValueForConditions: options.parseNodeValueForConditions,
    skipRanges: pageRanges,
  });
}
