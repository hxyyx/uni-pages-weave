import { parseJsonLike } from '../foundation/json.js';

export interface ParseJsoncFragmentOptions {
  label?: string;
}

export function parseJsoncFragment<T = unknown>(
  source: string,
  options: ParseJsoncFragmentOptions = {},
): T {
  try {
    return parseJsonLike<T>(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const prefix = options.label ? `${options.label}: ` : '';

    throw new Error(`${prefix}${message}`);
  }
}
