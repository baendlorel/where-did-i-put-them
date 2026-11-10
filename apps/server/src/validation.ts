import {
  FURNITURE_CATALOG,
  FURNITURE_KINDS,
  createId,
} from '@shijian/shared';
import type {
  FloorShape,
  Furniture,
  FurnitureKind,
  Opening,
  Project,
  StoredItem,
  Wall,
} from '@shijian/shared';

const MAX_SHAPES = 400;
const MAX_WALLS = 1200;
const MAX_FURNITURE = 600;
const MAX_ITEMS = 200;

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = '', max = 200): string {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, max);
}

function asVec(value: unknown): { x: number; y: number } | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  return { x: asNumber(v.x), y: asNumber(v.y) };
}

function normalizeItem(raw: unknown): StoredItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const name = asString(item.name, '', 120).trim();
  if (!name) return null;
  return {
    id: asString(item.id, '', 80) || createId('item'),
    name,
    quantity: Math.max(1, Math.min(9999, Math.round(asNumber(item.quantity, 1)))),
    note: asString(item.note, '', 500),
  };
}

function normalizeShape(raw: unknown): FloorShape | null {
  if (!raw || typeof raw !== 'object') return null;
  const shape = raw as Record<string, unknown>;
  const kind = shape.kind === 'ellipse' ? 'ellipse' : 'rect';
  const mode = shape.mode === 'subtract' ? 'subtract' : 'union';
  const width = Math.min(500, Math.abs(asNumber(shape.width)));
  const height = Math.min(500, Math.abs(asNumber(shape.height)));
  if (width < 0.01 || height < 0.01) return null;
  return {
    id: asString(shape.id, '', 80) || createId('shape'),
    kind,
    x: asNumber(shape.x),
    y: asNumber(shape.y),
    width,
    height,
    rotation: asNumber(shape.rotation),
    mode,
  };
}

function normalizeWall(raw: unknown): Wall | null {
  if (!raw || typeof raw !== 'object') return null;
  const wall = raw as Record<string, unknown>;
  const a = asVec(wall.a);
  const b = asVec(wall.b);
  if (!a || !b) return null;
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 0.02 || length > 200) return null;
  return {
    id: asString(wall.id, '', 80) || createId('wall'),
    a,
    b,
    thickness: Math.max(0.05, Math.min(1, asNumber(wall.thickness, 0.18))),
  };
}

function normalizeOpening(raw: unknown, wallIds: Set<string>): Opening | null {
  if (!raw || typeof raw !== 'object') return null;
  const opening = raw as Record<string, unknown>;
  const wallId = asString(opening.wallId, '', 80);
  if (!wallIds.has(wallId)) return null;
  return {
    id: asString(opening.id, '', 80) || createId('opening'),
    wallId,
    kind: opening.kind === 'window' ? 'window' : 'door',
    offset: Math.max(0, Math.min(1, asNumber(opening.offset, 0.5))),
    width: Math.max(0.25, Math.min(20, asNumber(opening.width, 0.9))),
  };
}

function normalizeFurniture(raw: unknown): Furniture | null {
  if (!raw || typeof raw !== 'object') return null;
  const furniture = raw as Record<string, unknown>;
  const kind = FURNITURE_KINDS.includes(furniture.kind as FurnitureKind)
    ? (furniture.kind as FurnitureKind)
    : 'cabinet';
  const spec = FURNITURE_CATALOG[kind];
  const items = Array.isArray(furniture.items)
    ? furniture.items
        .slice(0, MAX_ITEMS)
        .map(normalizeItem)
        .filter((item): item is StoredItem => Boolean(item))
    : [];
  return {
    id: asString(furniture.id, '', 80) || createId('furniture'),
    kind,
    name: asString(furniture.name, spec.label, 80).trim() || spec.label,
    x: Math.max(-500, Math.min(500, asNumber(furniture.x))),
    y: Math.max(-500, Math.min(500, asNumber(furniture.y))),
    rotation: asNumber(furniture.rotation),
    width: Math.max(0.15, Math.min(20, asNumber(furniture.width, spec.width))),
    depth: Math.max(0.15, Math.min(20, asNumber(furniture.depth, spec.depth))),
    color: /^#[0-9a-f]{6}$/i.test(asString(furniture.color)) ? asString(furniture.color) : spec.color,
    items,
  };
}

/**
 * Accept a document from the network, strip anything unexpected and guarantee
 * that cross references (openings -> walls) remain intact.
 */
export function normalizeProject(raw: unknown, fallback?: Project): Project {
  if (!raw || typeof raw !== 'object') {
    if (fallback) return structuredClone(fallback);
    throw new Error('Invalid project payload');
  }
  const input = raw as Record<string, unknown>;
  if (!input.floor || typeof input.floor !== 'object') {
    if (fallback) return structuredClone(fallback);
    throw new Error('Project.floor is required');
  }
  const floor = input.floor as Record<string, unknown>;
  const shapes = Array.isArray(floor.shapes)
    ? floor.shapes
        .slice(0, MAX_SHAPES)
        .map(normalizeShape)
        .filter((shape): shape is FloorShape => Boolean(shape))
    : [];
  const walls = Array.isArray(floor.walls)
    ? floor.walls
        .slice(0, MAX_WALLS)
        .map(normalizeWall)
        .filter((wall): wall is Wall => Boolean(wall))
    : [];
  const wallIds = new Set(walls.map((wall) => wall.id));
  const openings = Array.isArray(floor.openings)
    ? floor.openings
        .slice(0, MAX_WALLS * 4)
        .map((opening) => normalizeOpening(opening, wallIds))
        .filter((opening): opening is Opening => Boolean(opening))
    : [];
  const furniture = Array.isArray(input.furniture)
    ? input.furniture
        .slice(0, MAX_FURNITURE)
        .map(normalizeFurniture)
        .filter((item): item is Furniture => Boolean(item))
    : [];

  return {
    schemaVersion: 1,
    id: asString(input.id, '', 80) || fallback?.id || createId('project'),
    name: asString(input.name, fallback?.name ?? '未命名住宅', 120).trim() || '未命名住宅',
    revision: Math.max(0, Math.round(asNumber(input.revision, fallback?.revision ?? 0))),
    updatedAt: new Date().toISOString(),
    floor: { shapes, walls, openings },
    furniture,
  };
}
