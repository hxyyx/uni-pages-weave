import {
  resolveProjectPaths,
  resolveUpwBuildContext,
  watchUniPagesJsonFromUpwSource,
  type UniAppProjectMode,
} from '@uni-pages-weave/core';
import { UPW_WEBPACK_PLUGIN_NAME } from './utils/constants.js';

export interface UpwWebpackPluginOptions {
  mode?: UniAppProjectMode;
  projectDir?: string;
  targetDir?: string;
}

interface TapHook {
  tap(name: string, callback: () => void): void;
}

interface UpwWatcher {
  close(): Promise<void>;
}

interface WebpackCompiler {
  watchMode?: boolean;
  hooks?: {
    beforeRun?: TapHook;
    watchRun?: TapHook;
    beforeCompile?: TapHook;
    done?: TapHook;
    thisCompilation?: {
      tap(
        name: string,
        callback: (compilation: {
          fileDependencies?: Set<string>;
          contextDependencies?: Set<string>;
        }) => void,
      ): void;
    };
  };
}

export class UpwWebpackPlugin {
  private watcher?: UpwWatcher;

  constructor(private readonly options: UpwWebpackPluginOptions = {}) {}

  apply(compiler: WebpackCompiler): void {
    const resolveBuildOptions = () => {
      const project = resolveProjectPaths(this.options.projectDir, {
        mode: this.options.mode,
        targetDir: this.options.targetDir,
      });

      return {
        input: project.upwSourceDir,
        output: project.pagesJsonPath,
      };
    };

    const startWatcher = () => {
      this.watcher ??= watchUniPagesJsonFromUpwSource(resolveBuildOptions());
    };

    compiler.hooks?.beforeRun?.tap(UPW_WEBPACK_PLUGIN_NAME, startWatcher);
    compiler.hooks?.watchRun?.tap(UPW_WEBPACK_PLUGIN_NAME, startWatcher);
    compiler.hooks?.beforeCompile?.tap(UPW_WEBPACK_PLUGIN_NAME, startWatcher);
    compiler.hooks?.done?.tap(UPW_WEBPACK_PLUGIN_NAME, () => {
      if (!compiler.watchMode) {
        void this.watcher?.close();
        this.watcher = undefined;
      }
    });
    compiler.hooks?.thisCompilation?.tap(UPW_WEBPACK_PLUGIN_NAME, (compilation) => {
      const context = resolveUpwBuildContext(resolveBuildOptions());

      compilation.contextDependencies?.add(context.sourceDir);
      compilation.fileDependencies?.add(context.watchPatterns[0]);

      for (const file of context.files) {
        compilation.fileDependencies?.add(file);
      }
    });
  }
}
