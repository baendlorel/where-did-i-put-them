export interface Vec2 {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type ShapeKind = 'rect' | 'ellipse';
export type BooleanMode = 'union' | 'subtract';

/** A procedural floor slab. Shapes are applied in order to build the footprint. */
export interface FloorShape {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  mode: BooleanMode;
}

export interface Wall {
  id: string;
  a: Vec2;
  b: Vec2;
  thickness: number;
}

export type OpeningKind = 'door' | 'window';

/** A door or window embedded in a wall, positioned along its normalized length. */
export interface Opening {
  id: string;
  wallId: string;
  kind: OpeningKind;
  offset: number;
  width: number;
}

export type FurnitureKind = 'sofa' | 'table' | 'bed' | 'cabinet' | 'nightstand';

export interface StoredItem {
  id: string;
  name: string;
  quantity: number;
  note: string;
}

/** A placed piece of furniture. Every object can hold a list of stored items. */
export interface Furniture {
  id: string;
  kind: FurnitureKind;
  name: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  depth: number;
  color: string;
  items: StoredItem[];
}

/** A staircase placed on a floor, visually connecting it to the floor above. */
export interface Stair {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation: number;
  steps: number;
}

/** One editable storey. Coordinates are local to the storey. */
export interface FloorPlan {
  id: string;
  name: string;
  level: number;
  shapes: FloorShape[];
  walls: Wall[];
  openings: Opening[];
  furniture: Furniture[];
  stairs: Stair[];
}

export interface House {
  id: string;
  name: string;
  floors: FloorPlan[];
}

/** The persisted, synced document. It can contain many independent houses. */
export interface Workspace {
  schemaVersion: 2;
  id: string;
  revision: number;
  updatedAt: string;
  houses: House[];
}

export interface SearchHit {
  houseId: string;
  houseName: string;
  floorId: string;
  floorName: string;
  floorLevel: number;
  furnitureId: string;
  furnitureName: string;
  furnitureKind: FurnitureKind;
  itemId: string | null;
  itemName: string;
  quantity: number;
  note: string;
  match: 'item' | 'furniture' | 'note';
}

export interface FloorStats {
  area: number;
  wallLength: number;
  furnitureCount: number;
  itemCount: number;
  roomCount: number;
}

export type Tool =
  | 'select'
  | 'rect'
  | 'ellipse'
  | 'wall'
  | 'door'
  | 'window'
  | 'stair'
  | 'sofa'
  | 'table'
  | 'bed'
  | 'cabinet'
  | 'nightstand';

export type ViewMode = '2d' | '3d';

/** Vertical distance from one storey's floor to the next. */
export const FLOOR_HEIGHT = 2.85;

export function floorName(level: number): string {
  return `${level + 1}F`;
}

export function floorElevation(level: number): number {
  return Math.max(0, level) * FLOOR_HEIGHT;
}
