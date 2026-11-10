import { buildAll } from './lib/build';

try {
  await buildAll();
  console.log('\nBuild complete. The runnable CLI is at apps/server/dist/cli.js.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
