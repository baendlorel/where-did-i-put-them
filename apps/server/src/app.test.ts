import { createDemoWorkspace } from '@shijian/shared';
import type { Workspace } from '@shijian/shared';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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

  it('rejects single-project payloads on the workspace API', async () => {
    const { app } = await boot();
    const response = await app.inject({
      method: 'PUT',
      url: '/api/workspace',
      payload: {
        schemaVersion: 1,
        name: '旧宅',
        floor: { shapes: [], walls: [], openings: [] },
        furniture: [],
      },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('does not auto-migrate legacy files; directs users to the migration command', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'shijian-legacy-'));
    cleanups.push(dir);
    await writeFile(
      path.join(dir, 'project.json'),
      JSON.stringify({
        schemaVersion: 1,
        id: 'legacy_project',
        name: '旧宅',
        floor: { shapes: [], walls: [], openings: [] },
        furniture: [],
      }),
      'utf8',
    );
    await expect(buildApp({ dataDir: dir, webRoot: null, logger: false })).rejects.toThrow(
      /migrate:legacy/,
    );
  });

  it('moves a house to trash and restores it', async () => {
    const { app } = await boot();
    const before = (await app.inject({ method: 'GET', url: '/api/workspace' })).json<Workspace>();
    const target = before.houses[1];
    const trashResponse = await app.inject({
      method: 'POST',
      url: `/api/houses/${target.id}/trash`,
    });
    expect(trashResponse.statusCode).toBe(200);
    const trashed = trashResponse.json<{ workspace: Workspace; trash: { house: { id: string } }[] }>();
    expect(trashed.workspace.houses).toHaveLength(1);
    expect(trashed.trash).toHaveLength(1);
    expect(trashed.trash[0].house.id).toBe(target.id);

    const restoreResponse = await app.inject({
      method: 'POST',
      url: `/api/trash/${target.id}/restore`,
    });
    expect(restoreResponse.statusCode).toBe(200);
    const restored = restoreResponse.json<{ workspace: Workspace; trash: unknown[] }>();
    expect(restored.workspace.houses).toHaveLength(2);
    expect(restored.trash).toHaveLength(0);
    await app.close();
  });

  it('requires the last active house to stay out of the trash', async () => {
    const { app } = await boot();
    const before = (await app.inject({ method: 'GET', url: '/api/workspace' })).json<Workspace>();
    await app.inject({ method: 'POST', url: `/api/houses/${before.houses[1].id}/trash` });
    const last = await app.inject({
      method: 'POST',
      url: `/api/houses/${before.houses[0].id}/trash`,
    });
    expect(last.statusCode).toBe(409);
    expect(last.json<{ error: string }>().error).toMatch(/至少需要保留一栋住宅/);
    await app.close();
  });

  it('permanently deletes only after the 4-digit challenge', async () => {
    const { app } = await boot();
    const before = (await app.inject({ method: 'GET', url: '/api/workspace' })).json<Workspace>();
    const target = before.houses[1];
    await app.inject({ method: 'POST', url: `/api/houses/${target.id}/trash` });

    const challengeResponse = await app.inject({
      method: 'POST',
      url: `/api/trash/${target.id}/challenge`,
    });
    expect(challengeResponse.statusCode).toBe(200);
    const challenge = challengeResponse.json<{ challengeId: string; code: string }>();
    expect(challenge.code).toMatch(/^\d{4}$/);

    const wrong = await app.inject({
      method: 'DELETE',
      url: `/api/trash/${target.id}`,
      payload: { challengeId: challenge.challengeId, code: '0000' },
    });
    expect(wrong.statusCode).toBe(400);

    const right = await app.inject({
      method: 'DELETE',
      url: `/api/trash/${target.id}`,
      payload: { challengeId: challenge.challengeId, code: challenge.code },
    });
    expect(right.statusCode).toBe(200);
    const trash = (await app.inject({ method: 'GET', url: '/api/trash' })).json<unknown[]>();
    expect(trash).toHaveLength(0);
    await app.close();
  });

  it('does not allow a workspace save to remove an active house', async () => {
    const { app } = await boot();
    const before = (await app.inject({ method: 'GET', url: '/api/workspace' })).json<Workspace>();
    const payload = JSON.parse(JSON.stringify(before)) as Workspace;
    payload.houses = payload.houses.slice(0, 1);
    const response = await app.inject({ method: 'PUT', url: '/api/workspace', payload });
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toMatch(/回收站/);
    await app.close();
  });
});
