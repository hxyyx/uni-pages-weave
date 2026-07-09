import lodashIsPlainObject from 'lodash-es/isPlainObject.js';
import lodashCloneDeep from 'lodash-es/cloneDeep.js';
import lodashMergeWith from 'lodash-es/mergeWith.js';

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return lodashIsPlainObject(value);
}

export function deepMerge(
  base: Record<string, unknown> = {},
  override: Record<string, unknown> = {},
): Record<string, unknown> {
  return lodashMergeWith(lodashCloneDeep(base), override, (current, value) => {
    return isPlainObject(current) && isPlainObject(value) ? undefined : value;
  }) as Record<string, unknown>;
}
