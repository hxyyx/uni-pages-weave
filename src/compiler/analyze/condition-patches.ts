import type {
  ConditionNode,
  ConditionalChildPatch,
  ConditionalPatch,
  UpwMeta,
} from '../../schemas/upw.js';
import { effectiveConditions, normalizePlatformEnv } from '../../conditions/platform.js';
import { deepMerge, isPlainObject } from '../../utils/object.js';
import { conditionsToUpwMeta } from '../../conditions/platform.js';

export interface RawConditionPatch {
  conditions: ConditionNode[];
  patch: Record<string, unknown>;
}

function conditionGroupKey(conditions: ConditionNode[] = []): string {
  return conditions
    .map(
      (condition) => `${condition.directive}:${condition.env.map(normalizePlatformEnv).join('||')}`,
    )
    .join('&&');
}

function sameCondition(left: ConditionNode, right: ConditionNode): boolean {
  return (
    left.directive === right.directive &&
    left.env.length === right.env.length &&
    left.env.every(
      (env, index) => normalizePlatformEnv(env) === normalizePlatformEnv(right.env[index] ?? ''),
    )
  );
}

function isConditionPrefix(prefix: ConditionNode[], conditions: ConditionNode[]): boolean {
  return (
    prefix.length < conditions.length &&
    prefix.every((condition, index) => sameCondition(condition, conditions[index]))
  );
}

function canMergePatch(base: Record<string, unknown>, override: Record<string, unknown>): boolean {
  return Object.entries(override).every(([key, value]) => {
    const current = base[key];

    return current === undefined || (isPlainObject(current) && isPlainObject(value));
  });
}

function externalConditionMeta(
  conditions: ConditionNode[],
): Pick<UpwMeta, 'conditions' | 'when' | 'unless'> {
  return conditionsToUpwMeta(conditions);
}

function externalConditionKey(meta: Pick<UpwMeta, 'conditions' | 'when' | 'unless'>): string {
  return conditionGroupKey(effectiveConditions(meta));
}

function mergeRawConditionPatches<TPatch extends RawConditionPatch>(patches: TPatch[]): TPatch[] {
  return patches.reduce<TPatch[]>((merged, patch) => {
    const key = conditionGroupKey(patch.conditions);
    const target = merged.find(
      (item) =>
        conditionGroupKey(item.conditions) === key && canMergePatch(item.patch, patch.patch),
    );

    if (!target) {
      merged.push(patch);
      return merged;
    }

    target.patch = deepMerge(target.patch, patch.patch);

    return merged;
  }, []);
}

function mergeConditionalChildPatch(
  children: ConditionalChildPatch[],
  child: ConditionalChildPatch,
): void {
  const key = externalConditionKey(child);
  const target = children.find(
    (item) => externalConditionKey(item) === key && canMergePatch(item.patch, child.patch),
  );

  if (!target) {
    children.push(child);
    return;
  }

  target.patch = deepMerge(target.patch, child.patch);
}

function mergeConditionalPatch(
  patches: ConditionalPatch[],
  patch: ConditionalPatch,
): ConditionalPatch {
  const key = externalConditionKey(patch);
  const target = patches.find(
    (item) => externalConditionKey(item) === key && canMergePatch(item.patch, patch.patch),
  );

  if (!target) {
    patches.push(patch);
    return patch;
  }

  target.patch = deepMerge(target.patch, patch.patch);

  for (const child of patch.children ?? []) {
    const children = target.children ?? [];

    mergeConditionalChildPatch(children, child);
    target.children = children;
  }

  return target;
}

export function conditionPatchesToUpwPatches<TPatch extends RawConditionPatch>(
  patches: TPatch[],
): ConditionalPatch[] {
  const rawPatches = mergeRawConditionPatches(patches).sort(
    (left, right) => left.conditions.length - right.conditions.length,
  );
  const roots: Array<{ raw: TPatch; patch: ConditionalPatch }> = [];
  const output: ConditionalPatch[] = [];

  for (const raw of rawPatches) {
    const parent = roots
      .filter((candidate) => isConditionPrefix(candidate.raw.conditions, raw.conditions))
      .sort((left, right) => right.raw.conditions.length - left.raw.conditions.length)[0];

    if (parent) {
      const relativeConditions = raw.conditions.slice(parent.raw.conditions.length);
      const child: ConditionalChildPatch = {
        ...externalConditionMeta(relativeConditions),
        patch: raw.patch,
      };
      const children = parent.patch.children ?? [];

      mergeConditionalChildPatch(children, child);
      parent.patch.children = children;
      continue;
    }

    const patch: ConditionalPatch = {
      ...externalConditionMeta(raw.conditions),
      patch: raw.patch,
    };

    roots.push({ raw, patch: mergeConditionalPatch(output, patch) });
  }

  return output;
}
