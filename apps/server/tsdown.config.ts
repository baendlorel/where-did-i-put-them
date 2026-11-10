import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/cli.ts'],
  outDir: 'dist',
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  clean: true,
  sourcemap: true,
  report: true,
  outExtensions: () => ({ js: '.js' }),
  deps: {
    // Fastify and ws are normal npm dependencies of the published CLI.
    neverBundle: ['fastify', '@fastify/cors', '@fastify/static', '@fastify/websocket', 'ws'],
    // Shared is a workspace package and polygon-clipping is browser-safe JS;
    // inline both so consumers never need @shijian/shared from npm.
    alwaysBundle: ['@shijian/shared', 'polygon-clipping'],
    onlyBundle: false,
  },
});
