import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
  clean: true,
  dts: true,
  sourcemap: true,
  report: true,
});
