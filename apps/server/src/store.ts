import { createDemoProject } from '@shijian/shared';
import type { Project } from '@shijian/shared';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeProject } from './validation';

export class ProjectStore {
  private project: Project;
  private writeChain: Promise<void> = Promise.resolve();

  private constructor(
    private readonly filePath: string,
    project: Project,
  ) {
    this.project = project;
  }

  static async open(dataDir: string): Promise<ProjectStore> {
    await mkdir(dataDir, { recursive: true });
    const filePath = path.join(dataDir, 'project.json');
    let project: Project | null = null;
    try {
      const raw = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
      project = normalizeProject(raw);
      if (project.floor.shapes.length === 0 && project.furniture.length === 0) {
        project = createDemoProject();
      }
    } catch {
      project = createDemoProject();
    }
    const store = new ProjectStore(filePath, project);
    await store.persist(project);
    return store;
  }

  get(): Project {
    return this.project;
  }

  async replace(raw: unknown): Promise<Project> {
    if (
      !raw ||
      typeof raw !== 'object' ||
      !('floor' in raw) ||
      typeof (raw as { floor?: unknown }).floor !== 'object' ||
      !Array.isArray((raw as { floor: { shapes?: unknown } }).floor.shapes) ||
      !Array.isArray((raw as { floor: { walls?: unknown } }).floor.walls)
    ) {
      throw new Error('Invalid project payload');
    }
    const normalized = normalizeProject(raw, this.project);
    const next: Project = {
      ...normalized,
      id: this.project.id,
      schemaVersion: 1,
      revision: this.project.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    this.project = next;
    await this.persist(next);
    return next;
  }

  private async persist(project: Project): Promise<void> {
    const payload = JSON.stringify(project, null, 2);
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    this.writeChain = this.writeChain.then(async () => {
      await writeFile(tempPath, payload, 'utf8');
      await rename(tempPath, this.filePath);
    });
    await this.writeChain;
  }
}
