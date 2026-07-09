import {
  resolveProjectPaths,
  watchUniPagesJsonFromUpwSource,
  type UniAppProjectMode,
} from '@uni-pages-weave/core';
import { UPW_VITE_PLUGIN_NAME } from './utils/constants.js';

export interface UpwViteOptions {
  mode?: UniAppProjectMode;
  projectDir?: string;
  targetDir?: string;
}

interface UpwWatcher {
  close(): Promise<void>;
}

function watchPages(options: UpwViteOptions): UpwWatcher {
  const project = resolveProjectPaths(options.projectDir, {
    mode: options.mode,
    targetDir: options.targetDir,
  });

  return watchUniPagesJsonFromUpwSource({
    input: project.upwSourceDir,
    output: project.pagesJsonPath,
  });
}

export function upw(options: UpwViteOptions = {}) {
  let watcher: UpwWatcher | undefined;
  const startWatcher = () => {
    watcher ??= watchPages(options);
  };

  return {
    name: UPW_VITE_PLUGIN_NAME,
    enforce: 'pre',
    buildStart() {
      startWatcher();
    },
    configureServer() {
      startWatcher();
    },
    async closeBundle() {
      await watcher?.close();
      watcher = undefined;
    },
  };
}

export default upw;
