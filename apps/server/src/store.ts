import { createDemoWorkspace } from '@shijian/shared';
import type { Workspace } from '@shijian/shared';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeWorkspace } from './validation';

function isWorkspacePayload(raw: unknown): raw is Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return false;
  const input = raw as Record<string, unknown>;
  return input.schemaVersion === 1 && Array.isArray(input.houses);
}

export class WorkspaceStore {
  private workspace: Workspace;
  private writeChain: Promise<void> = Promise.resolve();

  private constructor(
    private readonly filePath: string,
    workspace: Workspace,
  ) {
    this.workspace = workspace;
  }

  static async open(dataDir: string): Promise<WorkspaceStore> {
    await mkdir(dataDir, { recursive: true });
    const filePath = path.join(dataDir, 'workspace.json');
    const legacyPath = path.join(dataDir, 'project.json');
    let workspace: Workspace;

    if (!existsSync(filePath)) {
      if (existsSync(legacyPath)) {
        throw new Error(
          'Legacy project.json detected. Run `pnpm migrate:legacy` once before starting wdipt.',
        );
      }
      workspace = createDemoWorkspace();
    } else {
      const raw = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
      workspace = normalizeWorkspace(raw);
    }

    const store = new WorkspaceStore(filePath, workspace);
    await store.persist(workspace);
    return store;
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
    this.workspace = next;
    await this.persist(next);
    return next;
  }

  private async persist(workspace: Workspace): Promise<void> {
    const payload = JSON.stringify(workspace, null, 2);
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    this.writeChain = this.writeChain.then(async () => {
      await writeFile(tempPath, payload, 'utf8');
      await rename(tempPath, this.filePath);
    });
    await this.writeChain;
  }
}
