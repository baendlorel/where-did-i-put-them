import { createId } from '@shijian/shared';
import type {
  DeleteChallenge,
  FloorPlan,
  House,
  TrashEntry,
  Workspace,
} from '@shijian/shared';
import Database from 'better-sqlite3';
import { randomInt } from 'node:crypto';

export class WorkspaceError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly code = 'WORKSPACE_ERROR',
  ) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

interface MetaRow {
  singleton: number;
  id: string;
  schema_version: number;
  revision: number;
  updated_at: string;
}

interface HouseRow {
  id: string;
  name: string;
  position: number;
  deleted_at: string | null;
  created_at: string;
}

interface FloorRow {
  id: string;
  house_id: string;
  name: string;
  level: number;
  data: string;
}

interface ChallengeRow {
  id: string;
  house_id: string;
  code: string;
  expires_at: string;
  created_at: string;
}

type FloorPayload = Omit<FloorPlan, 'id' | 'name' | 'level'>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS workspace_meta (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  id TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS houses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  deleted_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS floors (
  id TEXT PRIMARY KEY,
  house_id TEXT NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level INTEGER NOT NULL,
  data TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_houses_deleted_position
  ON houses(deleted_at, position);
CREATE INDEX IF NOT EXISTS idx_floors_house_level
  ON floors(house_id, level);

CREATE TABLE IF NOT EXISTS delete_challenges (
  id TEXT PRIMARY KEY,
  house_id TEXT NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_challenges_house
  ON delete_challenges(house_id);
`;

export function openDatabase(filePath: string): Database.Database {
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA);
  return db;
}

function now(): string {
  return new Date().toISOString();
}

function floorPayload(floor: FloorPlan): string {
  const payload: FloorPayload = {
    shapes: floor.shapes,
    walls: floor.walls,
    openings: floor.openings,
    furniture: floor.furniture,
    stairs: floor.stairs,
  };
  return JSON.stringify(payload);
}

function parseFloor(row: FloorRow): FloorPlan {
  const data = JSON.parse(row.data) as Partial<FloorPayload>;
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    shapes: data.shapes ?? [],
    walls: data.walls ?? [],
    openings: data.openings ?? [],
    furniture: data.furniture ?? [],
    stairs: data.stairs ?? [],
  };
}

function loadFloors(db: Database.Database, houseId: string): FloorPlan[] {
  const rows = db
    .prepare('SELECT id, house_id, name, level, data FROM floors WHERE house_id = ? ORDER BY level, rowid')
    .all(houseId) as FloorRow[];
  return rows.map(parseFloor);
}

function loadHouse(db: Database.Database, row: HouseRow): House {
  return {
    id: row.id,
    name: row.name,
    floors: loadFloors(db, row.id),
  };
}

export function hasWorkspace(db: Database.Database): boolean {
  return Boolean(db.prepare('SELECT 1 FROM workspace_meta WHERE singleton = 1').get());
}

export function readWorkspace(db: Database.Database): Workspace | null {
  const meta = db
    .prepare('SELECT singleton, id, schema_version, revision, updated_at FROM workspace_meta WHERE singleton = 1')
    .get() as MetaRow | undefined;
  if (!meta) return null;
  const rows = db
    .prepare('SELECT id, name, position, deleted_at, created_at FROM houses WHERE deleted_at IS NULL ORDER BY position, rowid')
    .all() as HouseRow[];
  return {
    schemaVersion: 1,
    id: meta.id,
    revision: meta.revision,
    updatedAt: meta.updated_at,
    houses: rows.map((row) => loadHouse(db, row)),
  };
}

function insertHouse(db: Database.Database, house: House, position: number): void {
  db.prepare(
    'INSERT INTO houses (id, name, position, deleted_at, created_at) VALUES (?, ?, ?, NULL, ?)',
  ).run(house.id, house.name, position, now());
  const floorStatement = db.prepare(
    'INSERT INTO floors (id, house_id, name, level, data) VALUES (?, ?, ?, ?, ?)',
  );
  for (const floor of house.floors) {
    floorStatement.run(floor.id, house.id, floor.name, floor.level, floorPayload(floor));
  }
}

/** Initial write used only for seeding a fresh database or importing JSON. */
export function writeInitialWorkspace(db: Database.Database, workspace: Workspace): void {
  if (hasWorkspace(db)) {
    throw new WorkspaceError('数据库中已有工作区', 409, 'WORKSPACE_EXISTS');
  }
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM delete_challenges').run();
    db.prepare('DELETE FROM floors').run();
    db.prepare('DELETE FROM houses').run();
    db.prepare(
      'INSERT INTO workspace_meta (singleton, id, schema_version, revision, updated_at) VALUES (1, ?, ?, ?, ?)',
    ).run(workspace.id, workspace.schemaVersion, workspace.revision, workspace.updatedAt);
    workspace.houses.forEach((house, index) => insertHouse(db, house, index));
  });
  transaction();
}

function bumpRevision(db: Database.Database): void {
  db.prepare(
    'UPDATE workspace_meta SET revision = revision + 1, updated_at = ? WHERE singleton = 1',
  ).run(now());
}

/**
 * Replace the active house set. Removing a house from the active set is only
 * allowed through the trash endpoint, never through a normal workspace save.
 */
export function writeActiveWorkspace(db: Database.Database, workspace: Workspace): void {
  const currentRows = db
    .prepare('SELECT id FROM houses WHERE deleted_at IS NULL')
    .all() as { id: string }[];
  const currentIds = new Set(currentRows.map((row) => row.id));
  const incomingIds = new Set(workspace.houses.map((house) => house.id));

  for (const id of currentIds) {
    if (!incomingIds.has(id)) {
      throw new WorkspaceError(
        '请通过回收站删除住宅',
        409,
        'HOUSE_REMOVAL_REQUIRES_TRASH',
      );
    }
  }

  const trashedRows = db
    .prepare('SELECT id FROM houses WHERE deleted_at IS NOT NULL')
    .all() as { id: string }[];
  const trashedIds = new Set(trashedRows.map((row) => row.id));
  for (const id of incomingIds) {
    if (trashedIds.has(id)) {
      throw new WorkspaceError(
        '回收站中的住宅不能编辑，请先恢复',
        409,
        'HOUSE_IN_TRASH',
      );
    }
  }

  const transaction = db.transaction(() => {
    db.prepare(
      'UPDATE workspace_meta SET revision = ?, updated_at = ? WHERE singleton = 1',
    ).run(workspace.revision, workspace.updatedAt);

    const existingRows = db
      .prepare('SELECT id, name, position, deleted_at, created_at FROM houses')
      .all() as HouseRow[];
    const existing = new Map(existingRows.map((row) => [row.id, row]));
    const floorStatement = db.prepare(
      'INSERT OR REPLACE INTO floors (id, house_id, name, level, data) VALUES (?, ?, ?, ?, ?)',
    );

    workspace.houses.forEach((house, index) => {
      const row = existing.get(house.id);
      if (row) {
        if (row.deleted_at) {
          throw new WorkspaceError(
            '回收站中的住宅不能编辑，请先恢复',
            409,
            'HOUSE_IN_TRASH',
          );
        }
        db.prepare('UPDATE houses SET name = ?, position = ? WHERE id = ?').run(
          house.name,
          index,
          house.id,
        );
      } else {
        insertHouse(db, house, index);
      }

      db.prepare('DELETE FROM floors WHERE house_id = ?').run(house.id);
      for (const floor of house.floors) {
        floorStatement.run(floor.id, house.id, floor.name, floor.level, floorPayload(floor));
      }
    });
  });
  transaction();
}

export function listTrash(db: Database.Database): TrashEntry[] {
  const rows = db
    .prepare(
      'SELECT id, name, position, deleted_at, created_at FROM houses WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC, rowid DESC',
    )
    .all() as HouseRow[];
  return rows.map((row) => ({
    id: row.id,
    deletedAt: row.deleted_at ?? now(),
    house: loadHouse(db, row),
  }));
}

export function trashHouse(db: Database.Database, houseId: string): void {
  const transaction = db.transaction(() => {
    const row = db
      .prepare('SELECT id, deleted_at FROM houses WHERE id = ?')
      .get(houseId) as { id: string; deleted_at: string | null } | undefined;
    if (!row) throw new WorkspaceError('住宅不存在', 404, 'HOUSE_NOT_FOUND');
    if (row.deleted_at) throw new WorkspaceError('住宅已在回收站', 409, 'HOUSE_IN_TRASH');
    const count = (
      db.prepare('SELECT COUNT(*) AS count FROM houses WHERE deleted_at IS NULL').get() as {
        count: number;
      }
    ).count;
    if (count <= 1) {
      throw new WorkspaceError('至少需要保留一栋住宅', 409, 'LAST_HOUSE');
    }
    db.prepare('UPDATE houses SET deleted_at = ? WHERE id = ?').run(now(), houseId);
    db.prepare('DELETE FROM delete_challenges WHERE house_id = ?').run(houseId);
    bumpRevision(db);
  });
  transaction();
}

export function restoreHouse(db: Database.Database, houseId: string): void {
  const transaction = db.transaction(() => {
    const row = db
      .prepare('SELECT id, deleted_at FROM houses WHERE id = ?')
      .get(houseId) as { id: string; deleted_at: string | null } | undefined;
    if (!row) throw new WorkspaceError('住宅不存在', 404, 'HOUSE_NOT_FOUND');
    if (!row.deleted_at) throw new WorkspaceError('住宅不在回收站', 409, 'HOUSE_NOT_TRASHED');
    const max = db.prepare('SELECT COALESCE(MAX(position), -1) AS max FROM houses WHERE deleted_at IS NULL').get() as {
      max: number;
    };
    db.prepare('UPDATE houses SET deleted_at = NULL, position = ? WHERE id = ?').run(
      max.max + 1,
      houseId,
    );
    db.prepare('DELETE FROM delete_challenges WHERE house_id = ?').run(houseId);
    bumpRevision(db);
  });
  transaction();
}

export function createDeleteChallenge(db: Database.Database, houseId: string): DeleteChallenge {
  const row = db
    .prepare('SELECT id, deleted_at FROM houses WHERE id = ?')
    .get(houseId) as { id: string; deleted_at: string | null } | undefined;
  if (!row) throw new WorkspaceError('住宅不存在', 404, 'HOUSE_NOT_FOUND');
  if (!row.deleted_at) throw new WorkspaceError('住宅不在回收站', 409, 'HOUSE_NOT_TRASHED');

  const challengeId = createId('challenge');
  const code = String(randomInt(1000, 10000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM delete_challenges WHERE house_id = ?').run(houseId);
    db.prepare(
      'INSERT INTO delete_challenges (id, house_id, code, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(challengeId, houseId, code, expiresAt, now());
  });
  transaction();
  return { challengeId, code, expiresAt };
}

export function permanentlyDeleteHouse(
  db: Database.Database,
  houseId: string,
  challengeId: string,
  code: string,
): void {
  const row = db
    .prepare('SELECT id, deleted_at FROM houses WHERE id = ?')
    .get(houseId) as { id: string; deleted_at: string | null } | undefined;
  if (!row) throw new WorkspaceError('住宅不存在', 404, 'HOUSE_NOT_FOUND');
  if (!row.deleted_at) throw new WorkspaceError('住宅不在回收站', 409, 'HOUSE_NOT_TRASHED');

  const challenge = db
    .prepare('SELECT id, house_id, code, expires_at, created_at FROM delete_challenges WHERE id = ? AND house_id = ?')
    .get(challengeId, houseId) as ChallengeRow | undefined;
  if (!challenge) throw new WorkspaceError('删除验证已失效，请重新获取', 400, 'INVALID_CHALLENGE');
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    throw new WorkspaceError('验证码已过期，请重新获取', 410, 'CHALLENGE_EXPIRED');
  }
  if (challenge.code !== code.trim()) {
    throw new WorkspaceError('验证码不正确', 400, 'INVALID_CODE');
  }

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM houses WHERE id = ?').run(houseId);
    db.prepare('DELETE FROM delete_challenges WHERE house_id = ?').run(houseId);
  });
  transaction();
}

