import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/logger.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  external: ['chokidar', 'fs-extra', 'jsonc-parser', 'lodash-es', 'picocolors'],
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js',
    };
  },
});
