import { createDemoWorkspace } from '@shijian/shared';
import type { Workspace } from '@shijian/shared';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

describe('wdipt api', () => {
  it('serves a demo workspace with two houses and multiple floors', async () => {
    const { app } = await boot();
    const response = await app.inject({ method: 'GET', url: '/api/workspace' });
    expect(response.statusCode).toBe(200);
    const workspace = response.json<Workspace>();
    expect(workspace.houses.length).toBe(2);
    const wutong = workspace.houses.find((house) => house.name === '梧桐宅');
    expect(wutong?.floors.length).toBe(2);
    expect(wutong?.floors[0].stairs.length).toBeGreaterThan(0);
    expect(wutong?.floors[1].level).toBe(1);
    await app.close();
  });

  it('increments revision and persists normalized workspace updates', async () => {
    const { app } = await boot();
    const before = (await app.inject({ method: 'GET', url: '/api/workspace' })).json<Workspace>();
    const payload: Workspace = {
      ...createDemoWorkspace(),
      revision: 2,
    };
    payload.houses[0].name = '测试住宅';
    payload.houses[0].floors[0].furniture[0].name = '测试沙发';
    const put = await app.inject({ method: 'PUT', url: '/api/workspace', payload });
    expect(put.statusCode).toBe(200);
    const updated = put.json<Workspace>();
    expect(updated.houses[0].name).toBe('测试住宅');
    expect(updated.revision).toBe(before.revision + 1);
    expect(updated.houses[0].floors[0].furniture[0].name).toBe('测试沙发');

    const fetched = (await app.inject({ method: 'GET', url: '/api/workspace' })).json<Workspace>();
    expect(fetched.houses[0].name).toBe('测试住宅');
    await app.close();
  });

  it('searches stored items across houses and floors', async () => {
    const { app } = await boot();
    const response = await app.inject({ method: 'GET', url: '/api/search?q=护照' });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ hits: { itemName: string; houseName: string; floorName: string }[] }>();
    expect(body.hits[0]).toMatchObject({
      itemName: '护照',
      houseName: '梧桐宅',
      floorName: '1F',
    });

    const heater = await app.inject({ method: 'GET', url: '/api/search?q=暖炉' });
    const heaterHits = heater.json<{ hits: { itemName: string; floorName: string }[] }>().hits;
    expect(heaterHits[0]).toMatchObject({ itemName: '暖炉', floorName: '2F' });
    await app.close();
  });

  it('rejects malformed documents without destroying the current workspace', async () => {
    const { app } = await boot();
    const before = (await app.inject({ method: 'GET', url: '/api/workspace' })).json<Workspace>();
    const response = await app.inject({ method: 'PUT', url: '/api/workspace', payload: { nonsense: true } });
    expect(response.statusCode).toBe(400);
    const after = (await app.inject({ method: 'GET', url: '/api/workspace' })).json<Workspace>();
    expect(after.houses.length).toBe(before.houses.length);
    expect(after.houses[0].name).toBe(before.houses[0].name);
    await app.close();
  });

  it('migrates a legacy single-project file to the multi-house workspace', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'shijian-legacy-'));
    cleanups.push(dir);
    await writeFile(
      path.join(dir, 'project.json'),
      JSON.stringify({
        schemaVersion: 1,
        id: 'legacy_project',
        name: '旧宅',
        revision: 7,
        updatedAt: new Date().toISOString(),
        floor: {
          shapes: [
            {
              id: 'legacy_shape',
              kind: 'rect',
              x: 0,
              y: 0,
              width: 6,
              height: 5,
              rotation: 0,
              mode: 'union',
            },
          ],
          walls: [],
          openings: [],
        },
        furniture: [],
      }),
      'utf8',
    );
    const { app } = await buildApp({ dataDir: dir, webRoot: null, logger: false });
    const workspace = (await app.inject({ method: 'GET', url: '/api/workspace' })).json<Workspace>();
    expect(workspace.houses).toHaveLength(1);
    expect(workspace.houses[0].name).toBe('旧宅');
    expect(workspace.houses[0].floors[0].name).toBe('1F');
    expect(workspace.houses[0].floors[0].shapes[0].width).toBe(6);
    const persisted = JSON.parse(await readFile(path.join(dir, 'workspace.json'), 'utf8')) as Workspace;
    expect(persisted.schemaVersion).toBe(2);
    await app.close();
  });
});
