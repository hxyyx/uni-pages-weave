import type {
  AppConditionPatch,
  ConditionBlock,
  ConditionNode,
  PageConditionPatch,
} from '../spec/upw-spec.js';
import {
  UPW_ENDIF_DIRECTIVE_PATTERN,
  UPW_IFDEF_DIRECTIVE,
  UPW_IFNDEF_DIRECTIVE,
  UPW_IF_DIRECTIVE_PATTERN,
} from '../spec/upw-spec.js';
import {
  UNI_PAGES_KEY,
  UNI_PAGE_PATH_KEY,
  UNI_SUB_PACKAGES_COMPAT_KEY,
  UNI_SUB_PACKAGES_KEY,
  UNI_SUB_PACKAGE_ROOT_KEY,
} from '../spec/uni-pages-spec.js';
import { parseJsonLike } from '../foundation/json.js';
import { isPlainObject } from '../foundation/object.js';
import { envToCondition, parseConditionEnv } from '../condition/condition-platform.js';
import {
  createScanner,
  findNodeAtLocation,
  getNodeValue,
  parseTree,
  type Node,
  type ParseError,
  SyntaxKind,
} from 'jsonc-parser';

interface ConditionDirective {
  type: 'start' | 'end';
  line: number;
  offset: number;
  directive?: typeof UPW_IFDEF_DIRECTIVE | typeof UPW_IFNDEF_DIRECTIVE;
  condition?: string;
  endLine?: number;
  matchingStartLine?: number;
}

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

function cloneConditions(conditions: ConditionNode[]): ConditionNode[] {
  return conditions.map((condition) => ({ ...condition, env: [...condition.env] }));
}

function sameCondition(left: ConditionNode, right: ConditionNode): boolean {
  return (
    left.directive === right.directive &&
    left.env.length === right.env.length &&
    left.env.every((env, index) => env === right.env[index])
  );
}

function conditionGroupKey(conditions: ConditionNode[]): string {
  return conditions
    .map((condition) => `${condition.directive}:${condition.env.join('||')}`)
    .join('&&');
}

function isConditionPrefix(conditions: ConditionNode[], target: ConditionNode[]): boolean {
  return (
    conditions.length <= target.length &&
    conditions.every((condition, index) => sameCondition(condition, target[index]))
  );
}

function patchAtPath(path: string[], value: unknown): Record<string, unknown> {
  return path.reduceRight<unknown>((current, key) => ({ [key]: current }), value) as Record<
    string,
    unknown
  >;
}

function commentText(source: string, offset: number, length: number): string {
  const raw = source.slice(offset, offset + length).trim();

  if (raw.startsWith('//')) {
    return raw.slice(2).trim();
  }

  if (raw.startsWith('/*') && raw.endsWith('*/')) {
    return raw.slice(2, -2).trim();
  }

  return raw;
}

function replacePreservingNewlines(value: string): string {
  return value.replace(/[^\r\n]/gu, ' ');
}

function lineBounds(source: string, offset: number): readonly [number, number] {
  const start = source.lastIndexOf('\n', offset - 1) + 1;
  const nextLine = source.indexOf('\n', offset);
  const end = nextLine === -1 ? source.length : nextLine;

  return [start, end];
}

function isStandaloneCommentLine(source: string, offset: number, length: number): boolean {
  const [lineStart, lineEnd] = lineBounds(source, offset);
  const before = source.slice(lineStart, offset);
  const after = source.slice(offset + length, lineEnd);

  return /^\s*$/u.test(before) && /^\s*$/u.test(after);
}

function directiveMatch(text: string): RegExpMatchArray | undefined {
  return text.match(UPW_IF_DIRECTIVE_PATTERN) ?? undefined;
}

function isEndifDirective(text: string): boolean {
  return UPW_ENDIF_DIRECTIVE_PATTERN.test(text);
}

function validDirectiveLine(
  token: SyntaxKind,
  source: string,
  offset: number,
  length: number,
): boolean {
  return token === SyntaxKind.LineCommentTrivia && isStandaloneCommentLine(source, offset, length);
}

export function normalizePagesJsonComments(source: string): string {
  const scanner = createScanner(source, false);
  const directives = conditionDirectives(source);
  const output = source.split('');

  for (let token = scanner.scan(); token !== SyntaxKind.EOF; token = scanner.scan()) {
    if (token !== SyntaxKind.LineCommentTrivia && token !== SyntaxKind.BlockCommentTrivia) {
      continue;
    }

    const offset = scanner.getTokenOffset();
    const length = scanner.getTokenLength();
    const line = lineNumberAt(source, offset);

    if (directives.has(line)) {
      continue;
    }

    const replacement = replacePreservingNewlines(source.slice(offset, offset + length));

    for (let index = 0; index < replacement.length; index += 1) {
      output[offset + index] = replacement[index] ?? ' ';
    }
  }

  return output.join('');
}

function lineNumberAt(source: string, offset: number): number {
  let line = 0;

  for (let index = 0; index < offset; index += 1) {
    if (source[index] === '\n') {
      line += 1;
    }
  }

  return line;
}

function conditionDirectives(source: string): Map<number, ConditionDirective> {
  const scanner = createScanner(source, false);
  const directives = new Map<number, ConditionDirective>();
  const stack: ConditionDirective[] = [];

  for (let token = scanner.scan(); token !== SyntaxKind.EOF; token = scanner.scan()) {
    if (token !== SyntaxKind.LineCommentTrivia && token !== SyntaxKind.BlockCommentTrivia) {
      continue;
    }

    const offset = scanner.getTokenOffset();
    const length = scanner.getTokenLength();
    const text = commentText(source, offset, length);
    const isValidDirectiveLine = validDirectiveLine(token, source, offset, length);

    if (!isValidDirectiveLine) {
      continue;
    }

    const start = directiveMatch(text);

    if (start) {
      const directive: ConditionDirective = {
        type: 'start',
        line: lineNumberAt(source, offset),
        offset,
        directive: start[1] === UPW_IFNDEF_DIRECTIVE ? UPW_IFNDEF_DIRECTIVE : UPW_IFDEF_DIRECTIVE,
        condition: start[2],
      };

      directives.set(directive.line, directive);
      stack.push(directive);
      continue;
    }

    if (isEndifDirective(text)) {
      const startDirective = stack.pop();
      const line = lineNumberAt(source, offset);

      if (!startDirective) {
        continue;
      }

      startDirective.endLine = line;
      directives.set(line, {
        type: 'end',
        line,
        offset,
        matchingStartLine: startDirective.line,
      });
    }
  }

  if (stack.length > 0) {
    const [directive] = stack.slice(-1);

    throw new Error(
      `Conditional compilation #${directive.directive} ${directive.condition ?? ''} has no matching #endif.`,
    );
  }

  return directives;
}

function conditionFromDirective(directive: ConditionDirective): ConditionNode {
  const env = parseConditionEnv(directive.condition ?? '');

  return {
    directive:
      directive.directive === UPW_IFNDEF_DIRECTIVE ? UPW_IFNDEF_DIRECTIVE : UPW_IFDEF_DIRECTIVE,
    env,
    condition: envToCondition(env),
  };
}

function conditionsBeforeLine(
  directives: Map<number, ConditionDirective>,
  lineNumber: number,
): ConditionNode[] {
  const stack: ConditionNode[] = [];

  for (let index = 0; index < lineNumber; index += 1) {
    const directive = directives.get(index);

    if (directive?.type === 'start') {
      stack.push(conditionFromDirective(directive));
      continue;
    }

    if (directive?.type === 'end') {
      stack.pop();
    }
  }

  return cloneConditions(stack);
}

function propertyValueNode(node: Node | undefined, key: string): Node | undefined {
  if (!node || node.type !== 'object') {
    return undefined;
  }

  return node.children
    ?.filter((child) => child.type === 'property')
    .map((child) => child.children ?? [])
    .find(([name]) => getNodeValue(name) === key)?.[1];
}

function parseNodeValue(source: string, node: Node): unknown | undefined {
  try {
    return parseJsonLike(
      stripConditionalSections(source.slice(node.offset, node.offset + node.length)),
    );
  } catch {
    return undefined;
  }
}

function parseNodeValueForConditions(
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

function nodeStringValue(node: Node | undefined): string | undefined {
  const value: unknown = node ? getNodeValue(node) : undefined;

  return typeof value === 'string' ? value : undefined;
}

function pageBlock(
  code: string,
  directives: Map<number, ConditionDirective>,
  node: Node,
  subPackageRoot?: string,
): ConditionBlock | undefined {
  const conditions = conditionsBeforeLine(directives, lineNumberAt(code, node.offset));

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
): ConditionBlock[] {
  if (!pagesNode || pagesNode.type !== 'array') {
    return [];
  }

  return (pagesNode.children ?? [])
    .map((child) => pageBlock(code, directives, child, subPackageRoot))
    .filter((block): block is ConditionBlock => Boolean(block));
}

function pageNodesFromArray(pagesNode: Node | undefined): Node[] {
  if (!pagesNode || pagesNode.type !== 'array') {
    return [];
  }

  return (pagesNode.children ?? []).filter((child) => child.type === 'object');
}

function pageNodes(root: Node): Node[] {
  const topLevelPages = pageNodesFromArray(findNodeAtLocation(root, [UNI_PAGES_KEY]));
  const subPackagePages = subPackageNodes(root).flatMap((subPackage) =>
    pageNodesFromArray(propertyValueNode(subPackage, UNI_PAGES_KEY)),
  );

  return [...topLevelPages, ...subPackagePages];
}

function offsetInRanges(offset: number, ranges: Array<readonly [number, number]>): boolean {
  return ranges.some(([start, end]) => offset >= start && offset < end);
}

export function stripConditionalSections(code: string): string {
  const stack: ConditionNode[] = [];
  const directives = conditionDirectives(code);
  let lineIndex = 0;
  let skipNextCommaOnlyLine = false;

  return code.split(/(\r?\n)/).reduce(
    (state, chunk) => {
      if (chunk === '\n' || chunk === '\r\n') {
        state.output += chunk;
        return state;
      }

      const directive = directives.get(lineIndex);

      if (directive?.type === 'start') {
        stack.push(conditionFromDirective(directive));
        skipNextCommaOnlyLine = false;
        lineIndex += 1;
        return state;
      }

      if (directive?.type === 'end') {
        stack.pop();
        skipNextCommaOnlyLine = stack.length === 0;
        lineIndex += 1;
        return state;
      }

      if (skipNextCommaOnlyLine && /^\s*,\s*$/u.test(chunk)) {
        skipNextCommaOnlyLine = false;
        lineIndex += 1;
        return state;
      }

      if (stack.length === 0) {
        state.output += chunk;
      }

      skipNextCommaOnlyLine = false;
      lineIndex += 1;
      return state;
    },
    { output: '' },
  ).output;
}

function stripConditionalSectionsForConditions(
  code: string,
  targetConditions: ConditionNode[],
): string {
  const stack: ConditionNode[] = [];
  const directives = conditionDirectives(code);
  let lineIndex = 0;
  let skipNextCommaOnlyLine = false;

  return code.split(/(\r?\n)/).reduce(
    (state, chunk) => {
      if (chunk === '\n' || chunk === '\r\n') {
        state.output += chunk;
        return state;
      }

      const directive = directives.get(lineIndex);

      if (directive?.type === 'start') {
        stack.push(conditionFromDirective(directive));
        skipNextCommaOnlyLine = false;
        lineIndex += 1;
        return state;
      }

      if (directive?.type === 'end') {
        stack.pop();
        skipNextCommaOnlyLine = stack.length === 0;
        lineIndex += 1;
        return state;
      }

      if (skipNextCommaOnlyLine && /^\s*,\s*$/u.test(chunk)) {
        skipNextCommaOnlyLine = false;
        lineIndex += 1;
        return state;
      }

      if (stack.length === 0 || isConditionPrefix(stack, targetConditions)) {
        state.output += chunk;
      }

      skipNextCommaOnlyLine = false;
      lineIndex += 1;
      return state;
    },
    { output: '' },
  ).output;
}

interface ConditionalMemberPatch {
  conditions: ConditionNode[];
  patch: Record<string, unknown>;
}

interface CollectConditionalMemberPatchOptions {
  ancestorConditionCount?: number;
  baseConditionCount?: number;
  deniedTopLevelKeys?: ReadonlyMap<string, string>;
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

function relativeConditions(
  conditions: ConditionNode[],
  baseConditionCount: number,
): ConditionNode[] {
  return cloneConditions(conditions.slice(baseConditionCount));
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
  groups = new Map<string, ConditionNode[]>(),
): Map<string, ConditionNode[]> {
  const conditions = conditionsBeforeLine(directives, lineNumberAt(code, node.offset));

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
): ConditionalMemberPatch[] {
  return Array.from(
    collectConditionGroupsInNode(
      code,
      directives,
      arrayNode,
      baseConditionCount,
      ancestorConditionCount,
    ).values(),
  ).flatMap((conditions) => {
    const value = parseNodeValueForConditions(code, arrayNode, conditions);

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

  for (const property of node.children ?? []) {
    if (property.type !== 'property' || shouldSkipNode(property, options.skipRanges)) {
      continue;
    }

    const [name, valueNode] = property.children ?? [];
    const key = getNodeValue(name);

    if (typeof key !== 'string' || !valueNode) {
      continue;
    }

    const propertyConditions = conditionsBeforeLine(
      directives,
      lineNumberAt(code, property.offset),
    );
    const conditions = relativeConditions(propertyConditions, baseConditionCount);
    const path = [...parentPath, key];

    const hasNewCondition = propertyConditions.length > ancestorConditionCount;

    if (hasNewCondition && conditions.length > 0) {
      const deniedReason =
        parentPath.length === 0 ? options.deniedTopLevelKeys?.get(key) : undefined;

      if (deniedReason) {
        throw new Error(deniedReason);
      }

      const value = parseNodeValue(code, valueNode);

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
  parent?: Node,
): void {
  const parentConditionCount = parent
    ? conditionsBeforeLine(directives, lineNumberAt(code, parent.offset)).length
    : 0;
  const conditionCount = conditionsBeforeLine(directives, lineNumberAt(code, node.offset)).length;

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
    validateConditionalCompilationUnits(code, directives, child, node);
  }
}

function parseValidatedPagesRoot(
  code: string,
  directives: Map<number, ConditionDirective>,
): Node | undefined {
  const root = parsePagesRoot(code);

  if (root) {
    validateConditionalCompilationUnits(code, directives, root);
    validateNoConditionalSubPackageObjects(code, directives, root);
  }

  return root;
}

function subPackagesNode(root: Node): Node | undefined {
  return (
    findNodeAtLocation(root, [UNI_SUB_PACKAGES_KEY]) ??
    findNodeAtLocation(root, [UNI_SUB_PACKAGES_COMPAT_KEY])
  );
}

function subPackageNodes(root: Node): Node[] {
  const subPackages = subPackagesNode(root);

  if (subPackages?.type !== 'array') {
    return [];
  }

  return subPackages.children ?? [];
}

function validateNoConditionalSubPackageObjects(
  code: string,
  directives: Map<number, ConditionDirective>,
  root: Node,
): void {
  const subPackages = subPackagesNode(root);

  if (
    subPackages &&
    conditionsBeforeLine(directives, lineNumberAt(code, subPackages.offset)).length > 0
  ) {
    return;
  }

  for (const subPackage of subPackageNodes(root)) {
    if (conditionsBeforeLine(directives, lineNumberAt(code, subPackage.offset)).length > 0) {
      throw new Error('Conditional compilation cannot wrap a subPackage object.');
    }
  }
}

function subPackagePageNodes(root: Node): Array<{ node: Node; root?: string }> {
  return subPackageNodes(root).flatMap((subPackage) =>
    pageNodesFromArray(propertyValueNode(subPackage, UNI_PAGES_KEY)).map((node) => ({
      node,
      root: nodeStringValue(propertyValueNode(subPackage, UNI_SUB_PACKAGE_ROOT_KEY)),
    })),
  );
}

export function parseConditionPatches(code: string): PageConditionPatch[] {
  const directives = conditionDirectives(code);
  const root = parseValidatedPagesRoot(code, directives);

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

    const baseConditionCount = conditionsBeforeLine(
      directives,
      lineNumberAt(code, node.offset),
    ).length;

    return collectConditionalMemberPatches(code, directives, node, [], {
      baseConditionCount,
    }).map((patch) => ({
      pagePath,
      subPackageRoot,
      conditions: patch.conditions,
      patch: patch.patch,
    }));
  });
}

export function parseAppConditionPatches(code: string): AppConditionPatch[] {
  const directives = conditionDirectives(code);
  const root = parseValidatedPagesRoot(code, directives);

  if (!root) {
    return [];
  }

  const pageRanges = pageNodes(root).map(
    (node) => [node.offset, node.offset + node.length] as const,
  );

  return collectConditionalMemberPatches(code, directives, root, [], {
    deniedTopLevelKeys: APP_PATCH_DENIED_TOP_LEVEL_KEYS,
    skipRanges: pageRanges,
  });
}

export function parseConditionBlocks(code: string): ConditionBlock[] {
  const directives = conditionDirectives(code);
  const root = parseValidatedPagesRoot(code, directives);

  if (!root) {
    return [];
  }

  const topLevelPages = pageBlocksFromArray(
    code,
    directives,
    findNodeAtLocation(root, [UNI_PAGES_KEY]),
  );
  const subPackagePages = subPackageNodes(root).flatMap((subPackage) =>
    pageBlocksFromArray(
      code,
      directives,
      propertyValueNode(subPackage, UNI_PAGES_KEY),
      nodeStringValue(propertyValueNode(subPackage, UNI_SUB_PACKAGE_ROOT_KEY)),
    ),
  );

  return [...topLevelPages, ...subPackagePages];
}


