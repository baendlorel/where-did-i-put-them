import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createId } from '@shijian/shared';
import type {
  FloorShape,
  Furniture,
  Opening,
  Wall,
  Workspace,
} from '@shijian/shared';
import { rootDir } from './lib/process';

interface LegacyProject {
  schemaVersion?: 1;
  id?: string;
  name?: string;
  revision?: number;
  updatedAt?: string;
  floor?: {
    shapes?: FloorShape[];
    walls?: Wall[];
    openings?: Opening[];
  };
  furniture?: Furniture[];
  stairs?: never[];
}

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    from: { type: 'string' },
    to: { type: 'string' },
    force: { type: 'boolean' },
    'keep-legacy': { type: 'boolean' },
  },
  strict: true,
});

const from = path.resolve(rootDir, values.from ?? 'apps/server/data/project.json');
const to = path.resolve(rootDir, values.to ?? 'apps/server/data/workspace.json');
const shouldKeepLegacy = values['keep-legacy'] ?? false;

if (!existsSync(from)) {
  console.error(`Legacy project file not found: ${from}`);
  process.exit(1);
}
if (existsSync(to) && !values.force) {
  console.error(`Destination already exists: ${to}`);
  console.error('Refusing to overwrite it. Pass --force only if you intend to replace it.');
  process.exit(1);
}

const legacy = JSON.parse(
  (await readFile(from, 'utf8')).replace(/^\uFEFF/, ''),
) as LegacyProject;
if (!legacy.floor || typeof legacy.floor !== 'object') {
  console.error('Legacy file does not contain a floor object.');
  process.exit(1);
}
if (!Array.isArray(legacy.floor.shapes) || !Array.isArray(legacy.floor.walls)) {
  console.error('Legacy file has no shapes/walls arrays; refusing to migrate.');
  process.exit(1);
}

const workspace: Workspace = {
  schemaVersion: 1,
  id: legacy.id || createId('workspace'),
  revision: Math.max(0, Math.round(legacy.revision ?? 0)),
  updatedAt: new Date().toISOString(),
  houses: [
    {
      id: 'house_main',
      name: (legacy.name || '我的住宅').slice(0, 120),
      floors: [
        {
          id: 'floor_1',
          name: '1F',
          level: 0,
          shapes: legacy.floor.shapes ?? [],
          walls: legacy.floor.walls ?? [],
          openings: Array.isArray(legacy.floor.openings) ? legacy.floor.openings : [],
          furniture: Array.isArray(legacy.furniture) ? legacy.furniture : [],
          stairs: [],
        },
      ],
    },
  ],
};

await mkdir(path.dirname(to), { recursive: true });
const temp = `${to}.${process.pid}.tmp`;
await writeFile(temp, JSON.stringify(workspace, null, 2), 'utf8');
await rename(temp, to);

if (!shouldKeepLegacy) {
  const backup = path.join(path.dirname(from), 'project.legacy.json');
  await rm(backup, { force: true });
  await rename(from, backup);
  console.log(`[migrate] legacy file archived at ${path.relative(rootDir, backup)}`);
}

const floor = workspace.houses[0].floors[0];
console.log(
  `[migrate] wrote ${path.relative(rootDir, to)}: 1 house, 1 floor, ` +
    `${floor.shapes.length} shapes, ${floor.walls.length} walls, ` +
    `${floor.furniture.length} furniture objects`,
);
