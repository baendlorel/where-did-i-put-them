import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Polygon, Ring } from 'polygon-clipping';
import type {
  Bounds,
  FloorPlan,
  FloorShape,
  FloorStats,
  Opening,
  Stair,
  Vec2,
  Wall,
} from './types';

export interface FloorGeometry {
  polygons: MultiPolygon;
  area: number;
  bounds: Bounds;
}

export interface OpeningSegment {
  wallId: string;
  kind: Opening['kind'];
  a: Vec2;
  b: Vec2;
  center: Vec2;
  angle: number;
  length: number;
}

export function createId(prefix = 'id'): string {
  const raw =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${raw.replace(/-/g, '').slice(0, 12)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function snap(value: number, step = 0.1): number {
  return Math.round(value / step) * step;
}

function rotatePoint(x: number, y: number, angle: number): Vec2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/** Build a closed polygon for a rotated rectangle centred on (x, y). */
export function orientedRectRing(
  x: number,
  y: number,
  width: number,
  depth: number,
  rotation = 0,
): Ring {
  const hw = Math.abs(width) / 2;
  const hd = Math.abs(depth) / 2;
  const corners = [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ];
  const ring: Ring = corners.map((corner) => {
    const point = rotatePoint(corner.x, corner.y, rotation);
    return [x + point.x, y + point.y] as [number, number];
  });
  ring.push([ring[0][0], ring[0][1]]);
  return ring;
}

export function stairFootprint(stair: Stair, padding = 0): Ring {
  return orientedRectRing(
    stair.x,
    stair.y,
    stair.width + padding * 2,
    stair.depth + padding * 2,
    stair.rotation,
  );
}

export function shapeToRing(shape: FloorShape, segments = 64): Ring {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const hw = Math.abs(shape.width) / 2;
  const hh = Math.abs(shape.height) / 2;
  const points: Vec2[] = [];

  if (shape.kind === 'ellipse') {
    for (let i = 0; i < segments; i += 1) {
      const t = (i / segments) * Math.PI * 2;
      const p = rotatePoint(Math.cos(t) * hw, Math.sin(t) * hh, shape.rotation);
      points.push({ x: cx + p.x, y: cy + p.y });
    }
  } else {
    const corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ];
    for (const corner of corners) {
      const p = rotatePoint(corner.x, corner.y, shape.rotation);
      points.push({ x: cx + p.x, y: cy + p.y });
    }
  }

  const ring: Ring = points.map((p) => [p.x, p.y] as [number, number]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first?.[0] ?? 0, first?.[1] ?? 0]);
  }
  return ring;
}

const EMPTY_BOUNDS: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

export function boundsOfPolygons(polygons: MultiPolygon): Bounds {
  const bounds: Bounds = { ...EMPTY_BOUNDS, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [x, y] of ring) {
        bounds.minX = Math.min(bounds.minX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.maxY = Math.max(bounds.maxY, y);
      }
    }
  }
  if (!Number.isFinite(bounds.minX)) return { ...EMPTY_BOUNDS };
  return bounds;
}

function ringArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

export function areaOfPolygons(polygons: MultiPolygon): number {
  let area = 0;
  for (const polygon of polygons) {
    polygon.forEach((ring, index) => {
      const a = Math.abs(ringArea(ring));
      area += index === 0 ? a : -a;
    });
  }
  return Math.max(0, area);
}

/** Apply the ordered rectangle/ellipse operations to produce the floor footprint. */
export function buildFloorGeometry(shapes: FloorShape[], extraCuts: Ring[] = []): FloorGeometry {
  let result: MultiPolygon = [];
  for (const shape of shapes) {
    if (shape.width === 0 || shape.height === 0) continue;
    const ring = shapeToRing(shape);
    const geo: Polygon = [ring];
    if (shape.mode === 'union') {
      result = result.length === 0 ? [geo] : (polygonClipping.union(result, geo) as MultiPolygon);
    } else if (result.length > 0) {
      result = polygonClipping.difference(result, geo) as MultiPolygon;
    }
  }
  for (const ring of extraCuts) {
    if (result.length > 0) {
      result = polygonClipping.difference(result, [ring] as Polygon) as MultiPolygon;
    }
  }
  result = result.filter((polygon) => polygon.length > 0 && polygon[0].length > 3);
  return {
    polygons: result,
    area: areaOfPolygons(result),
    bounds: boundsOfPolygons(result),
  };
}

export function nearestPointOnWall(wall: Wall, point: Vec2): { point: Vec2; distance: number; t: number } {
  const dx = wall.b.x - wall.a.x;
  const dy = wall.b.y - wall.a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { point: { ...wall.a }, distance: distance(wall.a, point), t: 0 };
  const t = clamp(((point.x - wall.a.x) * dx + (point.y - wall.a.y) * dy) / lenSq, 0, 1);
  const projected = { x: wall.a.x + dx * t, y: wall.a.y + dy * t };
  return { point: projected, distance: distance(projected, point), t };
}

export function openingSegment(wall: Wall, opening: Opening): OpeningSegment {
  const wallLength = distance(wall.a, wall.b);
  const width = Math.min(opening.width, wallLength);
  const centerDistance = clamp(opening.offset, 0, 1) * wallLength;
  const start = clamp(centerDistance - width / 2, 0, wallLength);
  const end = clamp(centerDistance + width / 2, 0, wallLength);
  const ux = wallLength === 0 ? 1 : (wall.b.x - wall.a.x) / wallLength;
  const uy = wallLength === 0 ? 0 : (wall.b.y - wall.a.y) / wallLength;
  const a = { x: wall.a.x + ux * start, y: wall.a.y + uy * start };
  const b = { x: wall.a.x + ux * end, y: wall.a.y + uy * end };
  return {
    wallId: wall.id,
    kind: opening.kind,
    a,
    b,
    center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    angle: Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x),
    length: end - start,
  };
}

export function wallLength(wall: Wall): number {
  return distance(wall.a, wall.b);
}

export function floorStats(floor: FloorPlan): FloorStats {
  const geometry = buildFloorGeometry(floor.shapes);
  const itemCount = floor.furniture.reduce((sum, f) => sum + f.items.length, 0);
  return {
    area: geometry.area,
    wallLength: floor.walls.reduce((sum, wall) => sum + wallLength(wall), 0),
    furnitureCount: floor.furniture.length,
    itemCount,
    roomCount: geometry.polygons.length,
  };
}

export function formatArea(area: number): string {
  return `${area.toFixed(1)} ㎡`;
}

export function formatLength(length: number): string {
  return `${length.toFixed(2)} m`;
}

/** Vertical wall spans that remain solid after subtracting doors/windows. */
export function solidWallSpans(
  openings: { kind: Opening['kind']; start: number; end: number }[],
  height = 2.8,
  doorHeight = 2.1,
  windowSill = 0.85,
  windowTop = 2.15,
): { bottom: number; top: number }[] {
  const blocked: { bottom: number; top: number }[] = [];
  for (const opening of openings) {
    if (opening.kind === 'door') blocked.push({ bottom: 0, top: doorHeight });
    else blocked.push({ bottom: windowSill, top: windowTop });
  }
  blocked.sort((a, b) => a.bottom - b.bottom);
  const merged: { bottom: number; top: number }[] = [];
  for (const span of blocked) {
    const last = merged[merged.length - 1];
    if (last && span.bottom <= last.top + 1e-6) last.top = Math.max(last.top, span.top);
    else merged.push({ ...span });
  }
  const solid: { bottom: number; top: number }[] = [];
  let cursor = 0;
  for (const span of merged) {
    if (span.bottom > cursor + 1e-6) solid.push({ bottom: cursor, top: Math.min(span.bottom, height) });
    cursor = Math.max(cursor, span.top);
  }
  if (cursor < height - 1e-6) solid.push({ bottom: cursor, top: height });
  return solid.filter((span) => span.top - span.bottom > 1e-4);
}
