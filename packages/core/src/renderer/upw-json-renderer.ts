import { stringifyJson } from '../foundation/json.js';

export function renderUpwJson(value: unknown): string {
  return stringifyJson(value);
}


