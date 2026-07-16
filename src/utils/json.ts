import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser';

const PRIVATE_USE_CHARACTER_PATTERN = /[\uE000-\uF8FF]/gu;

export function parseJsonLike<T = unknown>(source: string): T {
  const errors: ParseError[] = [];
  const value = parse(source, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  }) as T;

  if (errors.length > 0) {
    const [error] = errors;

    throw new Error(
      `Invalid JSON/JSONC at offset ${error.offset}: ${printParseErrorCode(error.error)}.`,
    );
  }

  return value;
}

export function parseJsonWithComments<T = unknown>(source: string): T {
  return parseJsonLike<T>(source);
}

export function parseJson<T = unknown>(source: string): T {
  try {
    return JSON.parse(source) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Invalid JSON: ${message}`);
  }
}

export function stringifyJson(value: unknown): string {
  return `${escapePrivateUseCharacters(JSON.stringify(value, null, 2))}\n`;
}

export function stringifyJsonValue(value: unknown): string {
  return escapePrivateUseCharacters(JSON.stringify(value));
}

function escapePrivateUseCharacters(value: string): string {
  return value.replace(PRIVATE_USE_CHARACTER_PATTERN, (item) => {
    const codePoint = item.codePointAt(0) ?? 0;

    return `\\u${codePoint.toString(16).padStart(4, '0')}`;
  });
}
