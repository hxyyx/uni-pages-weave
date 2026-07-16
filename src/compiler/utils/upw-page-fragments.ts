import type { UpwAppSchema, UpwMeta, UpwPageSchema } from '../../schemas/upw.js';
import { UPW_META_KEY, UPW_SUB_PACKAGES_KEY } from '../../schemas/upw.js';
import { validateUpwAppConfig } from '../../validators/upw-app.js';
import { validateUpwPageConfig } from '../../validators/upw-page.js';

export interface ConvertedUpwAppFragment {
  app: Record<string, unknown>;
  homePath: string;
  patches: NonNullable<UpwMeta['patches']>;
}

export interface ConvertedUpwPageFragment {
  page: Record<string, unknown>;
  meta?: UpwMeta;
}

export function stripUpwMeta(value: Record<string, unknown>): Record<string, unknown> {
  const { [UPW_META_KEY]: _upw, ...config } = value;

  return config;
}

export function convertUpwAppFragmentToUniObject(
  app: UpwAppSchema,
  label?: string,
): ConvertedUpwAppFragment {
  const validation = validateUpwAppConfig(app, { label });
  const { [UPW_META_KEY]: _upw, [UPW_SUB_PACKAGES_KEY]: _subPackages, ...baseApp } = app;

  return {
    app: baseApp,
    homePath: validation.homePath,
    patches: validation.patches ?? [],
  };
}

export function convertUpwPageFragmentToUniPageEntry(
  page: UpwPageSchema,
  options: {
    forbidUpw?: boolean;
    forbidUpwMessage?: string;
    label: string;
  },
): ConvertedUpwPageFragment {
  const { config, meta } = validateUpwPageConfig(page, options);

  return {
    page: stripUpwMeta(config),
    ...(meta ? { meta } : {}),
  };
}
