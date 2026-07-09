import uniq from 'lodash-es/uniq.js';

import type {
  ConditionLayer,
  ConditionMeta,
  PlatformCondition,
} from '../ir/types.js';
import { UPW_IFDEF_DIRECTIVE, UPW_IFNDEF_DIRECTIVE } from '../internal/constants.js';

export type ConditionalMeta = ConditionMeta;

export function platformToConditionEnv(platform: string): string {
  return platform.trim().toUpperCase();
}

export function conditionEnvToPlatform(condition: string): string {
  return condition.trim().toLowerCase();
}

export function normalizePlatformEnv(env: string): string {
  return conditionEnvToPlatform(env);
}

export function parseConditionEnv(condition: string): string[] {
  if (/(^|[^|])\|($|[^|])/u.test(condition)) {
    throw new Error(`Unsupported condition operator in "${condition}". Use "||" for OR.`);
  }

  if (condition.includes('&&')) {
    throw new Error(`Unsupported condition operator in "${condition}". Only "||" is supported.`);
  }

  return condition
    .replace(/[()]/g, ' ')
    .split(/\s*\|\|\s*/g)
    .map((token) => normalizePlatformEnv(token))
    .filter(Boolean);
}

export function envToCondition(env: string[]): string {
  return env.map((item) => platformToConditionEnv(item)).join(' || ');
}

function conditionToLayer(condition: PlatformCondition): ConditionLayer {
  const env = condition.env.map(normalizePlatformEnv);

  return condition.directive === UPW_IFNDEF_DIRECTIVE
    ? { unless: uniq(env) }
    : { when: uniq(env) };
}

export function conditionLayerToPlatformCondition(layer: ConditionLayer): PlatformCondition {
  return layer.when
    ? { directive: UPW_IFDEF_DIRECTIVE, env: layer.when.map(normalizePlatformEnv) }
    : { directive: UPW_IFNDEF_DIRECTIVE, env: layer.unless.map(normalizePlatformEnv) };
}

export function effectiveConditions(meta: ConditionalMeta | undefined): PlatformCondition[] {
  if (meta?.conditions?.length) {
    return meta.conditions.map(conditionLayerToPlatformCondition);
  }

  if (meta?.when?.length) {
    return [{ directive: UPW_IFDEF_DIRECTIVE, env: meta.when.map(normalizePlatformEnv) }];
  }

  if (meta?.unless?.length) {
    return [{ directive: UPW_IFNDEF_DIRECTIVE, env: meta.unless.map(normalizePlatformEnv) }];
  }

  return [];
}

export function conditionsToUpwMeta(conditions: PlatformCondition[]): ConditionalMeta {
  if (conditions.length === 0) {
    return {};
  }

  if (conditions.length > 2) {
    throw new Error('Nested conditional compilation supports at most two consecutive directives.');
  }

  const layers = conditions.map(conditionToLayer);

  if (layers.length === 1) {
    return layers[0] ?? {};
  }

  return {
    conditions: layers,
  };
}
