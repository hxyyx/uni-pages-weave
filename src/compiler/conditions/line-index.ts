import type { ConditionNode } from '../../schemas/upw.js';
import {
  cloneConditions,
  conditionDirectives,
  conditionFromDirective,
  type ConditionDirective,
} from './directives.js';

function sourceLineCount(source: string): number {
  return source.split(/\r\n|\r|\n/u).length;
}

function buildConditionsByLine(
  source: string,
  directives: Map<number, ConditionDirective>,
): ConditionNode[][] {
  const stack: ConditionNode[] = [];
  const output: ConditionNode[][] = [];
  const lineCount = sourceLineCount(source);

  for (let line = 0; line <= lineCount; line += 1) {
    output[line] = cloneConditions(stack);

    const directive = directives.get(line);

    if (directive?.type === 'start') {
      stack.push(conditionFromDirective(directive));
      continue;
    }

    if (directive?.type === 'end') {
      stack.pop();
    }
  }

  return output;
}

export class LineConditionIndex {
  private constructor(private readonly conditionsByLine: ConditionNode[][]) {}

  static fromSource(source: string): LineConditionIndex {
    return LineConditionIndex.fromDirectives(source, conditionDirectives(source));
  }

  static fromDirectives(
    source: string,
    directives: Map<number, ConditionDirective>,
  ): LineConditionIndex {
    return new LineConditionIndex(buildConditionsByLine(source, directives));
  }

  conditionsBeforeLine(lineNumber: number): ConditionNode[] {
    return cloneConditions(this.conditionsByLine[lineNumber] ?? []);
  }
}
