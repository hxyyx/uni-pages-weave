import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

import { readJsonc } from './jsonc.mjs';

const require = createRequire(import.meta.url);
const {
  createScanner,
  findNodeAtLocation,
  getNodeValue,
  parseTree,
  SyntaxKind,
} = require('../../packages/core/node_modules/jsonc-parser');

const conditionStartPattern = /^#(ifdef|ifndef)\s+(.+?)\s*$/u;
const conditionEndPattern = /^#endif\s*$/u;

function subpackages(data) {
  if (Array.isArray(data.subPackages)) {
    return data.subPackages;
  }

  return Array.isArray(data.subpackages) ? data.subpackages : [];
}

function withoutKeys(value, keys) {
  const output = { ...value };

  for (const key of keys) {
    delete output[key];
  }

  return output;
}

function stable(value) {
  if (Array.isArray(value)) {
    return value.map(stable);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  }

  return value;
}

function commentText(source, offset, length) {
  const raw = source.slice(offset, offset + length).trim();

  if (raw.startsWith('//')) {
    return raw.slice(2).trim();
  }

  if (raw.startsWith('/*') && raw.endsWith('*/')) {
    return raw.slice(2, -2).trim();
  }

  return raw;
}

function lineNumberAt(source, offset) {
  let line = 0;

  for (let index = 0; index < offset; index += 1) {
    if (source[index] === '\n') {
      line += 1;
    }
  }

  return line;
}

function normalizeConditionEnv(condition) {
  return condition
    .replace(/[()]/gu, ' ')
    .split(/\s*\|\|\s*/gu)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .sort();
}

function conditionDirectives(source) {
  const scanner = createScanner(source, false);
  const directives = new Map();
  const stack = [];

  for (let token = scanner.scan(); token !== SyntaxKind.EOF; token = scanner.scan()) {
    if (token !== SyntaxKind.LineCommentTrivia && token !== SyntaxKind.BlockCommentTrivia) {
      continue;
    }

    const offset = scanner.getTokenOffset();
    const length = scanner.getTokenLength();
    const text = commentText(source, offset, length);
    const start = text.match(conditionStartPattern);
    const line = lineNumberAt(source, offset);

    if (start) {
      const directive = {
        type: 'start',
        line,
        directive: start[1],
        env: normalizeConditionEnv(start[2]),
      };

      directives.set(line, directive);
      stack.push(directive);
      continue;
    }

    if (conditionEndPattern.test(text)) {
      const startDirective = stack.pop();

      directives.set(line, {
        type: 'end',
        line,
        matchingStartLine: startDirective?.line,
      });
    }
  }

  return directives;
}

function conditionsBeforeLine(directives, lineNumber) {
  const stack = [];

  for (let index = 0; index < lineNumber; index += 1) {
    const directive = directives.get(index);

    if (directive?.type === 'start') {
      stack.push({ directive: directive.directive, env: directive.env });
      continue;
    }

    if (directive?.type === 'end') {
      stack.pop();
    }
  }

  return stack;
}

function conditionKey(conditions) {
  return conditions
    .map((condition) => `${condition.directive}:${condition.env.join('||')}`)
    .join('&&');
}

function addConditionSignature(signatures, key, conditions) {
  const values = signatures.get(key) ?? [];

  values.push(conditionKey(conditions));
  signatures.set(key, values);
}

function normalizeConditionSignatures(signatures) {
  return new Map(
    [...signatures.entries()]
      .map(([key, values]) => [key, values.sort()])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function propertyValueNode(node, key) {
  if (!node || node.type !== 'object') {
    return undefined;
  }

  return node.children
    ?.filter((child) => child.type === 'property')
    .map((child) => child.children ?? [])
    .find(([name]) => getNodeValue(name) === key)?.[1];
}

function nodeStringValue(node) {
  const value = node ? getNodeValue(node) : undefined;

  return typeof value === 'string' ? value : undefined;
}

function subpackageNodes(root) {
  const node = findNodeAtLocation(root, ['subPackages']) ?? findNodeAtLocation(root, ['subpackages']);

  return node?.type === 'array' ? (node.children ?? []) : [];
}

function pageNodesFromArray(pagesNode) {
  return pagesNode?.type === 'array'
    ? (pagesNode.children ?? []).filter((child) => child.type === 'object')
    : [];
}

function pageConditionEntries(root) {
  const entries = pageNodesFromArray(findNodeAtLocation(root, ['pages'])).map((node) => ({
    key: `main:${nodeStringValue(propertyValueNode(node, 'path'))}`,
    node,
  }));

  for (const subpackage of subpackageNodes(root)) {
    const rootPath = nodeStringValue(propertyValueNode(subpackage, 'root'));

    for (const node of pageNodesFromArray(propertyValueNode(subpackage, 'pages'))) {
      entries.push({
        key: `sub:${rootPath}/${nodeStringValue(propertyValueNode(node, 'path'))}`,
        node,
      });
    }
  }

  return entries.filter((entry) => !entry.key.includes('undefined'));
}

function offsetInRanges(offset, ranges) {
  return ranges.some(([start, end]) => offset >= start && offset < end);
}

function collectNestedConditionSignatures(
  source,
  directives,
  node,
  pathParts,
  baseConditionCount,
  signatures,
  keyPrefix,
  skipRanges = [],
) {
  if (!node || offsetInRanges(node.offset, skipRanges)) {
    return;
  }

  if (node.type === 'object') {
    for (const property of node.children ?? []) {
      if (property.type !== 'property' || offsetInRanges(property.offset, skipRanges)) {
        continue;
      }

      const [name, valueNode] = property.children ?? [];
      const key = getNodeValue(name);

      if (typeof key !== 'string' || !valueNode) {
        continue;
      }

      const nextPath = [...pathParts, key];
      const stack = conditionsBeforeLine(directives, lineNumberAt(source, property.offset));

      if (stack.length > baseConditionCount) {
        addConditionSignature(
          signatures,
          `${keyPrefix}:${nextPath.join('.')}`,
          stack.slice(baseConditionCount),
        );
      }

      collectNestedConditionSignatures(
        source,
        directives,
        valueNode,
        nextPath,
        baseConditionCount,
        signatures,
        keyPrefix,
        skipRanges,
      );
    }

    return;
  }

  if (node.type === 'array') {
    (node.children ?? []).forEach((child, index) => {
      if (offsetInRanges(child.offset, skipRanges)) {
        return;
      }

      const nextPath = [...pathParts, `[${index}]`];
      const stack = conditionsBeforeLine(directives, lineNumberAt(source, child.offset));

      if (stack.length > baseConditionCount) {
        addConditionSignature(
          signatures,
          `${keyPrefix}:${nextPath.join('.')}`,
          stack.slice(baseConditionCount),
        );
      }

      collectNestedConditionSignatures(
        source,
        directives,
        child,
        nextPath,
        baseConditionCount,
        signatures,
        keyPrefix,
        skipRanges,
      );
    });
  }
}

function conditionSignatures(source) {
  const directives = conditionDirectives(source);
  const root = parseTree(source, [], {
    allowTrailingComma: true,
    disallowComments: false,
  });

  if (!root || root.type !== 'object') {
    throw new Error('Unable to parse pages.json condition signatures.');
  }

  const signatures = new Map();
  const pages = pageConditionEntries(root);
  const pageRanges = pages.map(({ node }) => [node.offset, node.offset + node.length]);

  for (const { key, node } of pages) {
    const stack = conditionsBeforeLine(directives, lineNumberAt(source, node.offset));

    addConditionSignature(signatures, `page:${key}`, stack);
    collectNestedConditionSignatures(
      source,
      directives,
      node,
      [],
      stack.length,
      signatures,
      `page-member:${key}`,
    );
  }

  collectNestedConditionSignatures(source, directives, root, [], 0, signatures, 'app', pageRanges);

  return normalizeConditionSignatures(signatures);
}

function flattenPages(data) {
  const rows = [];

  for (const page of data.pages ?? []) {
    rows.push({ key: `main:${page.path}`, page });
  }

  for (const subpackage of subpackages(data)) {
    for (const page of subpackage.pages ?? []) {
      rows.push({ key: `sub:${subpackage.root}/${page.path}`, page });
    }
  }

  const pages = new Map(rows.map(({ key, page }) => [key, stable(page)]));

  assert.equal(pages.size, rows.length, 'pages.json contains duplicate page paths.');

  return pages;
}

function comparePageMap(label, expected, actual) {
  const expectedKeys = [...expected.keys()].sort();
  const actualKeys = [...actual.keys()].sort();

  assert.deepEqual(actualKeys, expectedKeys, `${label}: page set changed after round-trip.`);

  for (const key of expectedKeys) {
    assert.deepEqual(
      actual.get(key),
      expected.get(key),
      `${label}: page config changed after round-trip for ${key}.`,
    );
  }
}

function appConfig(data) {
  return stable(withoutKeys(data, ['pages', 'subPackages', 'subpackages']));
}

function subpackageConfigMap(data) {
  return new Map(
    subpackages(data).map((subpackage) => {
      const config = withoutKeys(subpackage, ['pages']);

      // upw canonical subpackages require name; missing uni-app names normalize to root.
      if (config.name === undefined) {
        config.name = config.root;
      }

      return [subpackage.root, stable(config)];
    }),
  );
}

function compareSubpackageConfig(label, expected, actual) {
  const expectedRoots = [...expected.keys()].sort();
  const actualRoots = [...actual.keys()].sort();

  assert.deepEqual(
    actualRoots,
    expectedRoots,
    `${label}: subpackage roots changed after round-trip.`,
  );

  for (const root of expectedRoots) {
    assert.deepEqual(
      actual.get(root),
      expected.get(root),
      `${label}: subpackage config changed after round-trip for ${root}.`,
    );
  }
}

export function assertPagesJsonEquivalent(label, expectedFile, actualFile) {
  const expected = readJsonc(expectedFile);
  const actual = readJsonc(actualFile);
  const expectedSource = fs.readFileSync(expectedFile, 'utf8');
  const actualSource = fs.readFileSync(actualFile, 'utf8');

  assert.equal(
    actual.pages?.[0]?.path,
    expected.pages?.[0]?.path,
    `${label}: home page changed after round-trip.`,
  );
  comparePageMap(label, flattenPages(expected), flattenPages(actual));
  assert.deepEqual(appConfig(actual), appConfig(expected), `${label}: app config changed.`);
  compareSubpackageConfig(label, subpackageConfigMap(expected), subpackageConfigMap(actual));
  assert.deepEqual(
    conditionSignatures(actualSource),
    conditionSignatures(expectedSource),
    `${label}: conditional compilation changed after round-trip.`,
  );
}
