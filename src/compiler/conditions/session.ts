import type {
  AppConditionPatch,
  ConditionBlock,
  ConditionNode,
  PageConditionPatch,
} from '../../schemas/upw.js';
import { conditionDirectives, conditionGroupKey, type ConditionDirective } from './directives.js';
import { LineConditionIndex } from './line-index.js';
import {
  NodeValueParserCache,
  parseNodeValue,
  parseNodeValueForConditions,
  parseValidatedPagesRoot,
  type JsoncNode,
} from './ast.js';
import {
  normalizePagesJsonComments,
  stripConditionalSections,
  stripConditionalSectionsWithDirectives,
} from './strip.js';
import { collectConditionBlocks } from './blocks.js';
import { collectAppConditionPatches, collectPageConditionPatches } from './patches.js';

class PagesJsonParseSession {
  private readonly conditionIndex: LineConditionIndex;
  private readonly nodeValueCache = new NodeValueParserCache();
  readonly directives: Map<number, ConditionDirective>;
  readonly root: JsoncNode | undefined;

  constructor(readonly source: string) {
    this.directives = conditionDirectives(source);
    this.conditionIndex = LineConditionIndex.fromDirectives(source, this.directives);
    this.root = parseValidatedPagesRoot(source, this.directives, (line) =>
      this.conditionsBeforeLine(line),
    );
  }

  private conditionsBeforeLine(lineNumber: number): ConditionNode[] {
    return this.conditionIndex.conditionsBeforeLine(lineNumber);
  }

  private parseNodeValue(node: JsoncNode): unknown | undefined {
    const key = `base:${node.offset}:${node.length}`;

    return this.nodeValueCache.getOrParse(key, () => parseNodeValue(this.source, node));
  }

  private parseNodeValueForConditions(
    node: JsoncNode,
    conditions: ConditionNode[],
  ): unknown | undefined {
    const key = `conditions:${node.offset}:${node.length}:${conditionGroupKey(conditions)}`;

    return this.nodeValueCache.getOrParse(key, () =>
      parseNodeValueForConditions(this.source, node, conditions),
    );
  }

  stripConditionalSections(): string {
    return stripConditionalSectionsWithDirectives(this.source, this.directives);
  }

  parseConditionPatches(): PageConditionPatch[] {
    return collectPageConditionPatches({
      source: this.source,
      directives: this.directives,
      root: this.root,
      conditionsForLine: (line) => this.conditionsBeforeLine(line),
      parseNodeValue: (target) => this.parseNodeValue(target),
      parseNodeValueForConditions: (target, conditions) =>
        this.parseNodeValueForConditions(target, conditions),
    });
  }

  parseAppConditionPatches(): AppConditionPatch[] {
    return collectAppConditionPatches({
      source: this.source,
      directives: this.directives,
      root: this.root,
      conditionsForLine: (line) => this.conditionsBeforeLine(line),
      parseNodeValue: (target) => this.parseNodeValue(target),
      parseNodeValueForConditions: (target, conditions) =>
        this.parseNodeValueForConditions(target, conditions),
    });
  }

  parseConditionBlocks(): ConditionBlock[] {
    return collectConditionBlocks({
      source: this.source,
      directives: this.directives,
      root: this.root,
      conditionsForLine: (line) => this.conditionsBeforeLine(line),
    });
  }
}

export function createPagesJsonParseSession(source: string): PagesJsonParseSession {
  return new PagesJsonParseSession(source);
}

export function parseConditionPatches(code: string): PageConditionPatch[] {
  return createPagesJsonParseSession(code).parseConditionPatches();
}

export function parseAppConditionPatches(code: string): AppConditionPatch[] {
  return createPagesJsonParseSession(code).parseAppConditionPatches();
}

export function parseConditionBlocks(code: string): ConditionBlock[] {
  return createPagesJsonParseSession(code).parseConditionBlocks();
}

export { normalizePagesJsonComments, stripConditionalSections };
