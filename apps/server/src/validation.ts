import {
  FURNITURE_CATALOG,
  FURNITURE_KINDS,
  createId,
  floorName,
  STAIR_DEFAULTS,
} from '@shijian/shared';
import type {
  FloorPlan,
  FloorShape,
  Furniture,
  FurnitureKind,
  House,
  Opening,
  Stair,
  StoredItem,
  Wall,
  Workspace,
} from '@shijian/shared';

const MAX_HOUSES = 24;
const MAX_FLOORS = 16;
const MAX_SHAPES = 400;
const MAX_WALLS = 1200;
const MAX_FURNITURE = 600;
const MAX_ITEMS = 200;
const MAX_STAIRS = 40;

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
  const width = Math.min(500, Math.abs(asNumber(shape.width)));
  const height = Math.min(500, Math.abs(asNumber(shape.height)));
  if (width < 0.01 || height < 0.01) return null;
  return {
    id: asString(shape.id, '', 80) || createId('shape'),
    kind: shape.kind === 'ellipse' ? 'ellipse' : 'rect',
    x: asNumber(shape.x),
    y: asNumber(shape.y),
    width,
    height,
    rotation: asNumber(shape.rotation),
    mode: shape.mode === 'subtract' ? 'subtract' : 'union',
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

function normalizeStair(raw: unknown): Stair | null {
  if (!raw || typeof raw !== 'object') return null;
  const stair = raw as Record<string, unknown>;
  return {
    id: asString(stair.id, '', 80) || createId('stair'),
    x: Math.max(-500, Math.min(500, asNumber(stair.x))),
    y: Math.max(-500, Math.min(500, asNumber(stair.y))),
    width: Math.max(0.5, Math.min(4, asNumber(stair.width, STAIR_DEFAULTS.width))),
    depth: Math.max(1, Math.min(12, asNumber(stair.depth, STAIR_DEFAULTS.depth))),
    rotation: asNumber(stair.rotation),
    steps: Math.max(5, Math.min(28, Math.round(asNumber(stair.steps, STAIR_DEFAULTS.steps)))),
  };
}

function normalizeFloor(raw: unknown, level: number): FloorPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const floor = raw as Record<string, unknown>;
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
  const furniture = Array.isArray(floor.furniture)
    ? floor.furniture
        .slice(0, MAX_FURNITURE)
        .map(normalizeFurniture)
        .filter((item): item is Furniture => Boolean(item))
    : [];
  const stairs = Array.isArray(floor.stairs)
    ? floor.stairs
        .slice(0, MAX_STAIRS)
        .map(normalizeStair)
        .filter((stair): stair is Stair => Boolean(stair))
    : [];

  return {
    id: asString(floor.id, '', 80) || createId('floor'),
    name: asString(floor.name, floorName(level), 40).trim() || floorName(level),
    level,
    shapes,
    walls,
    openings,
    furniture,
    stairs,
  };
}

function normalizeHouse(raw: unknown): House | null {
  if (!raw || typeof raw !== 'object') return null;
  const house = raw as Record<string, unknown>;
  const rawFloors = Array.isArray(house.floors) ? house.floors.slice(0, MAX_FLOORS) : [];
  if (rawFloors.length === 0) return null;
  const indexed = rawFloors
    .map((floor, index) => ({
      floor,
      order: typeof (floor as Record<string, unknown>)?.level === 'number'
        ? asNumber((floor as Record<string, unknown>).level, index)
        : index,
    }))
    .sort((a, b) => a.order - b.order);
  const floors = indexed
    .map((entry, index) => normalizeFloor(entry.floor, index))
    .filter((floor): floor is FloorPlan => Boolean(floor));
  if (floors.length === 0) return null;
  return {
    id: asString(house.id, '', 80) || createId('house'),
    name: asString(house.name, '未命名住宅', 120).trim() || '未命名住宅',
    floors,
  };
}

function legacyWorkspace(input: Record<string, unknown>): Workspace {
  const legacyFloor = {
    ...(input.floor as Record<string, unknown>),
    id: 'floor_legacy_1',
    name: floorName(0),
    level: 0,
    furniture: input.furniture,
    stairs: [],
  };
  const floor = normalizeFloor(legacyFloor, 0);
  if (!floor) throw new Error('Legacy project has no usable floor');
  return {
    schemaVersion: 2,
    id: asString(input.id, '', 80) || createId('workspace'),
    revision: Math.max(0, Math.round(asNumber(input.revision, 0))),
    updatedAt: new Date().toISOString(),
    houses: [
      {
        id: 'house_legacy_1',
        name: asString(input.name, '我的住宅', 120).trim() || '我的住宅',
        floors: [floor],
      },
    ],
  };
}

/**
 * Accept a workspace document from disk or the network, strip unexpected
 * fields, migrate the single-project schema and guarantee cross references
 * (openings -> walls, floor levels).
 */
export function normalizeWorkspace(raw: unknown, fallback?: Workspace): Workspace {
  if (!raw || typeof raw !== 'object') {
    if (fallback) return structuredClone(fallback);
    throw new Error('Invalid workspace payload');
  }
  const input = raw as Record<string, unknown>;

  if (!Array.isArray(input.houses)) {
    if (input.floor && typeof input.floor === 'object') {
      return legacyWorkspace(input);
    }
    if (fallback) return structuredClone(fallback);
    throw new Error('Workspace.houses is required');
  }

  const houses = input.houses
    .slice(0, MAX_HOUSES)
    .map(normalizeHouse)
    .filter((house): house is House => Boolean(house));
  if (houses.length === 0) {
    if (fallback) return structuredClone(fallback);
    throw new Error('Workspace needs at least one valid house');
  }

  return {
    schemaVersion: 2,
    id: asString(input.id, '', 80) || fallback?.id || createId('workspace'),
    revision: Math.max(0, Math.round(asNumber(input.revision, fallback?.revision ?? 0))),
    updatedAt: new Date().toISOString(),
    houses,
  };
}
