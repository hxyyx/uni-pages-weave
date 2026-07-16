import fs from 'node:fs';
import path from 'node:path';
import { parse, printParseErrorCode } from 'jsonc-parser';

export function readJsonc(filePath) {
  const errors = [];
  const text = fs.readFileSync(filePath, 'utf8');
  const value = parse(text, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  if (errors.length > 0) {
    const message = errors
      .map((error) => `${printParseErrorCode(error.error)} at ${error.offset}`)
      .join(', ');

    throw new Error(`Failed to parse ${filePath}: ${message}`);
  }

  return value;
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
