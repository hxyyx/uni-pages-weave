import type { ConditionNode } from '../../schemas/upw.js';
import { createScanner, SyntaxKind } from 'jsonc-parser';
import {
  conditionDirectives,
  conditionFromDirective,
  isConditionPrefix,
  lineNumberAt,
  type ConditionDirective,
} from './directives.js';

function replacePreservingNewlines(value: string): string {
  return value.replace(/[^\r\n]/gu, ' ');
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

export function stripConditionalSectionsWithDirectives(
  code: string,
  directives: Map<number, ConditionDirective>,
): string {
  const stack: ConditionNode[] = [];
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

export function stripConditionalSections(code: string): string {
  return stripConditionalSectionsWithDirectives(code, conditionDirectives(code));
}

export function stripConditionalSectionsForConditions(
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
