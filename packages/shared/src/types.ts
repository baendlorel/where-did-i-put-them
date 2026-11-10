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

export interface Project {
  schemaVersion: 1;
  id: string;
  name: string;
  revision: number;
  updatedAt: string;
  floor: {
    shapes: FloorShape[];
    walls: Wall[];
    openings: Opening[];
  };
  furniture: Furniture[];
}

export interface SearchHit {
  furnitureId: string;
  furnitureName: string;
  furnitureKind: FurnitureKind;
  itemId: string | null;
  itemName: string;
  quantity: number;
  note: string;
  match: 'item' | 'furniture' | 'note';
}

export interface ProjectStats {
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
  | 'sofa'
  | 'table'
  | 'bed'
  | 'cabinet'
  | 'nightstand';

export type ViewMode = '2d' | '3d';
