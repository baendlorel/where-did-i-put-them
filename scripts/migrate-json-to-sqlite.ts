import { existsSync } from 'node:fs';
import { readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { WorkspaceStore } from '../apps/server/src/store';
import { normalizeWorkspace } from '../apps/server/src/validation';
import { rootDir } from './lib/process';

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    from: { type: 'string' },
    'data-dir': { type: 'string' },
    'keep-json': { type: 'boolean' },
  },
  strict: true,
});

const from = path.resolve(rootDir, values.from ?? 'apps/server/data/workspace.json');
const dataDir = path.resolve(rootDir, values['data-dir'] ?? path.dirname(from));
const keepJson = values['keep-json'] ?? false;

if (!existsSync(from)) {
  console.error(`JSON workspace not found: ${from}`);
  process.exit(1);
}

const raw = (await readFile(from, 'utf8')).replace(/^\uFEFF/, '');
const workspace = normalizeWorkspace(JSON.parse(raw));

try {
  await WorkspaceStore.importWorkspace(dataDir, workspace);
} catch (error) {
  console.error(
    `Could not import JSON into SQLite: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

if (!keepJson) {
  const archive = path.join(dataDir, 'workspace.legacy.json');
  const backup = archive === from ? `${from}.legacy` : archive;
  await rm(backup, { force: true });
  await rename(from, backup);
  console.log(`[migrate] JSON archived at ${path.relative(rootDir, backup)}`);
}

console.log(
  `[migrate] wrote SQLite database ${path.relative(rootDir, path.join(dataDir, 'wdipt.db'))}: ` +
    `${workspace.houses.length} houses, ` +
    `${workspace.houses.reduce((sum, house) => sum + house.floors.length, 0)} floors`,
);
