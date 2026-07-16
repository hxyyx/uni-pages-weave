import path from 'node:path';

import { UNI_PAGE_PATH_KEY } from '../../schemas/uni-pages.js';
import { pagePathToWorkspaceFile } from '../utils/workspace-paths.js';

export function validatePageSourcePath(
  sourceDir: string,
  filePath: string,
  page: Record<string, unknown>,
): void {
  const pagePath = page[UNI_PAGE_PATH_KEY];

  if (typeof pagePath !== 'string') {
    throw new Error(`${filePath} must define a string page path.`);
  }

  const expected = pagePathToWorkspaceFile(sourceDir, pagePath);

  if (path.resolve(filePath) !== path.resolve(expected)) {
    throw new Error(`${filePath} does not match page path "${pagePath}". Expected ${expected}.`);
  }
}
