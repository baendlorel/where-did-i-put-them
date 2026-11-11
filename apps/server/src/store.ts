import { createDemoWorkspace } from '@shijian/shared';
import type { DeleteChallenge, TrashEntry, Workspace } from '@shijian/shared';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type Database from 'better-sqlite3';
import {
  createDeleteChallenge,
  listTrash,
  openDatabase,
  permanentlyDeleteHouse,
  readWorkspace,
  restoreHouse,
  trashHouse,
  writeActiveWorkspace,
  writeInitialWorkspace,
} from './database';
import { normalizeWorkspace } from './validation';

function isWorkspacePayload(raw: unknown): raw is Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return false;
  const input = raw as Record<string, unknown>;
  return input.schemaVersion === 1 && Array.isArray(input.houses);
}

export interface TrashSnapshot {
  workspace: Workspace;
  trash: TrashEntry[];
}

export class WorkspaceStore {
  private constructor(
    private readonly db: Database.Database,
    private workspace: Workspace,
  ) {}

  static async open(dataDir: string): Promise<WorkspaceStore> {
    await mkdir(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, 'wdipt.db');
    const jsonPath = path.join(dataDir, 'workspace.json');
    const legacyPath = path.join(dataDir, 'project.json');

    if (!existsSync(dbPath)) {
      if (existsSync(jsonPath)) {
        throw new Error(
          'JSON workspace detected. Run `pnpm migrate:json` once before starting wdipt.',
        );
      }
      if (existsSync(legacyPath)) {
        throw new Error(
          'Legacy project.json detected. Run `pnpm migrate:legacy`, then `pnpm migrate:json`.',
        );
      }
    }

    const db = openDatabase(dbPath);
    let workspace = readWorkspace(db);

    if (!workspace) {
      if (existsSync(jsonPath)) {
        db.close();
        throw new Error(
          'JSON workspace detected. Run `pnpm migrate:json` once before starting wdipt.',
        );
      }
      workspace = createDemoWorkspace();
      writeInitialWorkspace(db, workspace);
      workspace = readWorkspace(db);
    }
    if (!workspace) {
      db.close();
      throw new Error('Unable to initialize SQLite workspace');
    }

    return new WorkspaceStore(db, workspace);
  }

  /** Used by the one-shot JSON -> SQLite migration script. */
  static async importWorkspace(dataDir: string, workspace: Workspace): Promise<void> {
    await mkdir(dataDir, { recursive: true });
    const db = openDatabase(path.join(dataDir, 'wdipt.db'));
    try {
      writeInitialWorkspace(db, workspace);
    } finally {
      db.close();
    }
  }

  get(): Workspace {
    return this.workspace;
  }

  async replace(raw: unknown): Promise<Workspace> {
    if (!isWorkspacePayload(raw)) throw new Error('Invalid workspace payload');
    const normalized = normalizeWorkspace(raw);
    const next: Workspace = {
      ...normalized,
      schemaVersion: 1,
      id: this.workspace.id,
      revision: this.workspace.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    writeActiveWorkspace(this.db, next);
    this.workspace = readWorkspace(this.db) ?? next;
    return this.workspace;
  }

  listTrash(): TrashEntry[] {
    return listTrash(this.db);
  }

  trashHouse(houseId: string): TrashSnapshot {
    trashHouse(this.db, houseId);
    const workspace = readWorkspace(this.db);
    if (!workspace) throw new Error('Workspace missing after trash operation');
    this.workspace = workspace;
    return { workspace, trash: this.listTrash() };
  }

  restoreHouse(houseId: string): TrashSnapshot {
    restoreHouse(this.db, houseId);
    const workspace = readWorkspace(this.db);
    if (!workspace) throw new Error('Workspace missing after restore operation');
    this.workspace = workspace;
    return { workspace, trash: this.listTrash() };
  }

  createDeleteChallenge(houseId: string): DeleteChallenge {
    return createDeleteChallenge(this.db, houseId);
  }

  permanentlyDelete(houseId: string, challengeId: string, code: string): TrashEntry[] {
    permanentlyDeleteHouse(this.db, houseId, challengeId, code);
    return this.listTrash();
  }

  close(): void {
    if (this.db.open) this.db.close();
  }
}
