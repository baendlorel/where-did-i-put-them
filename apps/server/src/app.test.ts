import { createDemoProject } from '@shijian/shared';
import type { Project } from '@shijian/shared';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';

const cleanups: string[] = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function boot() {
  const dir = await mkdtemp(path.join(tmpdir(), 'shijian-test-'));
  cleanups.push(dir);
  const handle = await buildApp({ dataDir: dir, webRoot: null, logger: false });
  return handle;
}

describe('shijian api', () => {
  it('serves the demo project on first boot', async () => {
    const { app } = await boot();
    const response = await app.inject({ method: 'GET', url: '/api/project' });
    expect(response.statusCode).toBe(200);
    const project = response.json<Project>();
    expect(project.name).toContain('梧桐宅');
    expect(project.furniture.length).toBeGreaterThan(5);
    expect(project.floor.walls.length).toBeGreaterThan(5);
    await app.close();
  });

  it('increments revision and persists normalized updates', async () => {
    const { app } = await boot();
    const before = (await app.inject({ method: 'GET', url: '/api/project' })).json<Project>();
    const payload: Project = {
      ...createDemoProject(),
      name: '测试住宅',
      revision: 2,
      furniture: [{ ...createDemoProject().furniture[0], name: '测试沙发' }],
    };
    const put = await app.inject({ method: 'PUT', url: '/api/project', payload });
    expect(put.statusCode).toBe(200);
    const updated = put.json<Project>();
    expect(updated.name).toBe('测试住宅');
    expect(updated.revision).toBe(before.revision + 1);
    expect(updated.furniture[0].name).toBe('测试沙发');

    const fetched = (await app.inject({ method: 'GET', url: '/api/project' })).json<Project>();
    expect(fetched.name).toBe('测试住宅');
    await app.close();
  });

  it('searches stored items over HTTP', async () => {
    const { app } = await boot();
    const response = await app.inject({ method: 'GET', url: '/api/search?q=护照' });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ hits: { itemName: string; furnitureName: string }[] }>();
    expect(body.hits[0]).toMatchObject({ itemName: '护照', furnitureName: '左侧床头柜' });
    await app.close();
  });

  it('rejects malformed documents without destroying the current project', async () => {
    const { app } = await boot();
    const before = (await app.inject({ method: 'GET', url: '/api/project' })).json<Project>();
    const response = await app.inject({ method: 'PUT', url: '/api/project', payload: { nonsense: true } });
    expect(response.statusCode).toBe(400);
    const after = (await app.inject({ method: 'GET', url: '/api/project' })).json<Project>();
    expect(after.name).toBe(before.name);
    expect(after.floor.walls.length).toBe(before.floor.walls.length);
    await app.close();
  });
});
