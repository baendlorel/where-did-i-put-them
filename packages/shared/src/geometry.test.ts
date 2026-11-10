import { describe, expect, it } from 'vitest';
import {
  areaOfPolygons,
  buildFloorGeometry,
  createDemoWorkspace,
  floorElevation,
  openingSegment,
  searchWorkspace,
  shapeToRing,
  solidWallSpans,
  stairFootprint,
} from './index';
import type { FloorShape } from './types';

const rect = (id: string, x: number, y: number, width: number, height: number, mode: 'union' | 'subtract'): FloorShape => ({
  id,
  kind: 'rect',
  x,
  y,
  width,
  height,
  rotation: 0,
  mode,
});

describe('floor boolean geometry', () => {
  it('merges overlapping rectangles', () => {
    const geometry = buildFloorGeometry([rect('a', 0, 0, 4, 3, 'union'), rect('b', 2, 0, 4, 3, 'union')]);
    expect(geometry.area).toBeCloseTo(18, 5);
    expect(geometry.polygons.length).toBe(1);
  });

  it('subtracts an inner rectangle, creating a hole', () => {
    const geometry = buildFloorGeometry([
      rect('a', 0, 0, 10, 8, 'union'),
      rect('b', 3, 2, 4, 4, 'subtract'),
    ]);
    expect(geometry.area).toBeCloseTo(64, 5);
    expect(geometry.polygons[0].length).toBe(2);
  });

  it('ignores subtraction before anything exists', () => {
    const geometry = buildFloorGeometry([rect('cut', 0, 0, 2, 2, 'subtract'), rect('a', 5, 5, 2, 2, 'union')]);
    expect(geometry.area).toBeCloseTo(4, 5);
  });

  it('tessellates ellipses with the requested precision', () => {
    const ring = shapeToRing(
      { id: 'e', kind: 'ellipse', x: 0, y: 0, width: 4, height: 2, rotation: 0, mode: 'union' },
      32,
    );
    expect(ring.length).toBe(33);
    expect(areaOfPolygons([[ring]])).toBeGreaterThan(5.8);
    expect(areaOfPolygons([[ring]])).toBeLessThan(6.3);
  });

  it('cuts a stairwell out of the upper floor slab', () => {
    const stair = { id: 's', x: 4.5, y: 2, width: 1.2, depth: 3, rotation: 0, steps: 14 };
    const base = buildFloorGeometry([rect('a', 0, 0, 8, 6, 'union')]);
    const withStair = buildFloorGeometry([rect('a', 0, 0, 8, 6, 'union')], [stairFootprint(stair, 0.04)]);
    expect(base.area).toBeCloseTo(48, 5);
    expect(withStair.area).toBeLessThan(base.area);
    expect(withStair.polygons[0].length).toBe(2);
  });
});

describe('walls and openings', () => {
  it('centers an opening on the wall', () => {
    const segment = openingSegment(
      { id: 'w', a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, thickness: 0.2 },
      { id: 'o', wallId: 'w', kind: 'door', offset: 0.5, width: 1 },
    );
    expect(segment.a.x).toBeCloseTo(4.5);
    expect(segment.b.x).toBeCloseTo(5.5);
    expect(segment.center.x).toBeCloseTo(5);
  });

  it('keeps a lintel over a door and a sill below a window', () => {
    const doorSpans = solidWallSpans([{ kind: 'door', start: 1, end: 2 }]);
    expect(doorSpans).toEqual([{ bottom: 2.1, top: 2.8 }]);
    const windowSpans = solidWallSpans([{ kind: 'window', start: 1, end: 2 }]);
    expect(windowSpans[0]).toEqual({ bottom: 0, top: 0.85 });
    expect(windowSpans[1]).toEqual({ bottom: 2.15, top: 2.8 });
  });
});

describe('multi-storey demo', () => {
  it('contains two houses, two floors and a staircase', () => {
    const workspace = createDemoWorkspace();
    expect(workspace.houses).toHaveLength(2);
    const wutong = workspace.houses.find((house) => house.name === '梧桐宅');
    expect(wutong?.floors).toHaveLength(2);
    expect(wutong?.floors[0].stairs).toHaveLength(1);
    expect(wutong?.floors[0].level).toBe(0);
    expect(wutong?.floors[1].level).toBe(1);
    expect(floorElevation(1)).toBeGreaterThan(floorElevation(0));
  });
});

describe('search', () => {
  it('finds an item inside furniture and reports its house and floor', () => {
    const hits = searchWorkspace(createDemoWorkspace(), '护照');
    expect(hits.length).toBe(1);
    expect(hits[0]).toMatchObject({
      houseName: '梧桐宅',
      floorName: '1F',
      furnitureName: '左侧床头柜',
      itemName: '护照',
    });
  });

  it('searches across floors and houses', () => {
    const workspace = createDemoWorkspace();
    const upper = searchWorkspace(workspace, '暖炉');
    expect(upper[0]).toMatchObject({ floorName: '2F', itemName: '暖炉' });
    const otherHouse = searchWorkspace(workspace, '备用相机');
    expect(otherHouse[0]).toMatchObject({ houseName: '河畔工作室', itemName: '备用相机' });
  });

  it('is case-insensitive and searches notes', () => {
    const workspace = createDemoWorkspace();
    const hits = searchWorkspace(workspace, 'switch');
    expect(hits[0].itemName).toBe('Switch 游戏机');
    const noteHits = searchWorkspace(workspace, '顶柜');
    expect(noteHits.some((hit) => hit.itemName === '登机箱')).toBe(true);
  });
});
