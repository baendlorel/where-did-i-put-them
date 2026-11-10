import { describe, expect, it } from 'vitest';
import {
  areaOfPolygons,
  buildFloorGeometry,
  createDemoProject,
  openingSegment,
  searchProject,
  shapeToRing,
  solidWallSpans,
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

describe('search', () => {
  it('finds an item inside furniture and reports its container', () => {
    const hits = searchProject(createDemoProject(), '护照');
    expect(hits.length).toBe(1);
    expect(hits[0].furnitureName).toBe('左侧床头柜');
    expect(hits[0].itemName).toBe('护照');
  });

  it('is case-insensitive and searches notes', () => {
    const hits = searchProject(createDemoProject(), 'switch');
    expect(hits[0].itemName).toBe('Switch 游戏机');
    const noteHits = searchProject(createDemoProject(), '顶柜');
    expect(noteHits[0].itemName).toBe('登机箱');
  });
});
