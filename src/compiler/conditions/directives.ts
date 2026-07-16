import type { ConditionNode } from '../../schemas/upw.js';
import {
  UPW_ENDIF_DIRECTIVE_PATTERN,
  UPW_IFDEF_DIRECTIVE,
  UPW_IFNDEF_DIRECTIVE,
  UPW_IF_DIRECTIVE_PATTERN,
} from '../../schemas/upw.js';
import { envToCondition, parseConditionEnv } from '../../conditions/platform.js';
import { createScanner, SyntaxKind } from 'jsonc-parser';

export interface ConditionDirective {
  type: 'start' | 'end';
  line: number;
  offset: number;
  directive?: typeof UPW_IFDEF_DIRECTIVE | typeof UPW_IFNDEF_DIRECTIVE;
  condition?: string;
  endLine?: number;
  matchingStartLine?: number;
}

export type ConditionsForLine = (lineNumber: number) => ConditionNode[];

export function cloneConditions(conditions: ConditionNode[]): ConditionNode[] {
  return conditions.map((condition) => ({ ...condition, env: [...condition.env] }));
}

function sameCondition(left: ConditionNode, right: ConditionNode): boolean {
  return (
    left.directive === right.directive &&
    left.env.length === right.env.length &&
    left.env.every((env, index) => env === right.env[index])
  );
}

export function conditionGroupKey(conditions: ConditionNode[]): string {
  return conditions
    .map((condition) => `${condition.directive}:${condition.env.join('||')}`)
    .join('&&');
}

export function isConditionPrefix(conditions: ConditionNode[], target: ConditionNode[]): boolean {
  return (
    conditions.length <= target.length &&
    conditions.every((condition, index) => sameCondition(condition, target[index]))
  );
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

export function lineNumberAt(source: string, offset: number): number {
  let line = 0;

  for (let index = 0; index < offset; index += 1) {
    if (source[index] === '\n') {
      line += 1;
    }
  }

  return line;
}

export function conditionDirectives(source: string): Map<number, ConditionDirective> {
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

export function conditionFromDirective(directive: ConditionDirective): ConditionNode {
  const env = parseConditionEnv(directive.condition ?? '');

  return {
    directive:
      directive.directive === UPW_IFNDEF_DIRECTIVE ? UPW_IFNDEF_DIRECTIVE : UPW_IFDEF_DIRECTIVE,
    env,
    condition: envToCondition(env),
  };
}

export function conditionsBeforeLine(
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
