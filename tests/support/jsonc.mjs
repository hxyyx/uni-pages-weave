import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { parse, printParseErrorCode } = require('../../packages/core/node_modules/jsonc-parser');

export function parseJsonc(source, label) {
  const errors = [];
  const value = parse(source, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  if (errors.length > 0) {
    const [error] = errors;
    throw new Error(
      `${label} is not valid JSON/JSONC at offset ${error.offset}: ${printParseErrorCode(error.error)}.`,
    );
  }

  return value;
}

export function readJsonc(filePath) {
  return parseJsonc(fs.readFileSync(filePath, 'utf8'), filePath);
}
