import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/cli.ts'],
  outDir: 'dist',
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  clean: true,
  sourcemap: true,
  report: true,
  outExtensions: () => ({ js: '.js' }),
  deps: {
    // Fastify, ws and the native SQLite driver stay as normal npm dependencies.
    neverBundle: [
      'fastify',
      '@fastify/cors',
      '@fastify/static',
      '@fastify/websocket',
      'ws',
      'better-sqlite3',
    ],
    // Shared is a workspace package and polygon-clipping is browser-safe JS;
    // inline both so consumers never need @shijian/shared from npm.
    alwaysBundle: ['@shijian/shared', 'polygon-clipping'],
    onlyBundle: false,
  },
});
