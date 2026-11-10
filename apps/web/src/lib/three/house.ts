import {
  FLOOR_HEIGHT,
  FURNITURE_CATALOG,
  buildFloorGeometry,
  floorElevation,
  openingSegment,
  solidWallSpans,
  stairFootprint,
  wallLength,
} from '@shijian/shared';
import type { FloorPlan, House, Opening, Stair, Wall } from '@shijian/shared';
import * as THREE from 'three';
import { buildFurniture } from './furniture';
import { createCountTexture } from './textures';

export interface WallVisual {
  group: THREE.Group;
  center: THREE.Vector3;
  exterior: boolean;
  level: number;
}

export interface FloorVisual {
  level: number;
  elevation: number;
  group: THREE.Group;
}

export interface HouseBuild {
  root: THREE.Group;
  furnitureObjects: Map<string, THREE.Object3D>;
  wallVisuals: WallVisual[];
  floorGroups: Map<number, FloorVisual>;
  center: THREE.Vector3;
  radius: number;
  topHeight: number;
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial) {
          for (const key of ['map', 'alphaMap', 'normalMap', 'roughnessMap'] as const) {
            const texture = material[key];
            if (texture instanceof THREE.Texture) texture.dispose();
          }
        }
        material.dispose();
      }
    }
    if (child instanceof THREE.Sprite) {
      child.material.map?.dispose();
      child.material.dispose();
    }
  });
}

function floorMeshes(floor: FloorPlan, wood: THREE.Texture, extraCuts = [] as [number, number][][]): THREE.Group {
  const group = new THREE.Group();
  const geometry = buildFloorGeometry(floor.shapes, extraCuts);
  if (geometry.polygons.length === 0) return group;

  const floorTexture = wood.clone();
  floorTexture.needsUpdate = true;
  const topMaterial = new THREE.MeshStandardMaterial({
    map: floorTexture,
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0,
  });
  const sideMaterial = new THREE.MeshStandardMaterial({ color: 0xb8a88e, roughness: 0.92 });
  const undersideMaterial = new THREE.MeshStandardMaterial({ color: 0xd8cbb5, roughness: 0.95 });

  for (const polygon of geometry.polygons) {
    const outer = polygon[0];
    if (!outer || outer.length < 4) continue;
    const shape = new THREE.Shape(outer.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y)));
    for (let i = 1; i < polygon.length; i += 1) {
      const hole = polygon[i];
      if (!hole || hole.length < 4) continue;
      shape.holes.push(new THREE.Path(hole.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y))));
    }
    const extrude = new THREE.ExtrudeGeometry(shape, {
      depth: 0.16,
      bevelEnabled: false,
      curveSegments: 24,
    });
    extrude.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(extrude, [topMaterial, undersideMaterial, sideMaterial]);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    group.add(mesh);
  }
  return group;
}

function wallIntervalBoxes(
  wall: Wall,
  openings: Opening[],
  wallMaterial: THREE.Material,
  baseboardMaterial: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  const length = wallLength(wall);
  if (length < 0.05) return group;
  const ux = (wall.b.x - wall.a.x) / length;
  const uy = (wall.b.y - wall.a.y) / length;
  const angle = Math.atan2(uy, ux);

  const cuts = new Set<number>([0, length]);
  const ranges = openings.map((opening) => {
    const start = Math.max(0, opening.offset * length - opening.width / 2);
    const end = Math.min(length, opening.offset * length + opening.width / 2);
    cuts.add(start);
    cuts.add(end);
    return { opening, start, end };
  });
  const ordered = [...cuts].sort((a, b) => a - b);

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const start = ordered[index];
    const end = ordered[index + 1];
    const intervalLength = end - start;
    if (intervalLength < 0.012) continue;
    const active = ranges
      .filter((range) => range.start < end - 1e-4 && range.end > start + 1e-4)
      .map((range) => ({ kind: range.opening.kind, start: range.start, end: range.end }));
    const spans = solidWallSpans(active);
    const centerDistance = (start + end) / 2;
    const cx = wall.a.x + ux * centerDistance;
    const cz = wall.a.y + uy * centerDistance;

    for (const span of spans) {
      const height = span.top - span.bottom;
      if (height < 0.01) continue;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(intervalLength + 0.004, height, wall.thickness),
        wallMaterial,
      );
      mesh.position.set(cx, (span.bottom + span.top) / 2, cz);
      mesh.rotation.y = -angle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    if (spans.some((span) => span.bottom < 0.01)) {
      const baseboard = new THREE.Mesh(
        new THREE.BoxGeometry(intervalLength + 0.006, 0.09, wall.thickness + 0.024),
        baseboardMaterial,
      );
      baseboard.position.set(cx, 0.045, cz);
      baseboard.rotation.y = -angle;
      baseboard.castShadow = false;
      baseboard.receiveShadow = true;
      group.add(baseboard);
    }
  }
  return group;
}

function windowMesh(wall: Wall, opening: Opening): THREE.Group {
  const group = new THREE.Group();
  const segment = openingSegment(wall, opening);
  group.position.set(segment.center.x, 0, segment.center.y);
  group.rotation.y = -segment.angle;

  const width = segment.length;
  const sill = 0.85;
  const top = 2.15;
  const height = top - sill;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xe9e1d2, roughness: 0.55 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x9dc6cb,
    roughness: 0.06,
    metalness: 0,
    transparent: true,
    opacity: 0.42,
    transmission: 0.4,
    thickness: 0.02,
    side: THREE.DoubleSide,
  });

  const glass = new THREE.Mesh(new THREE.BoxGeometry(width - 0.06, height - 0.04, 0.028), glassMat);
  glass.position.y = sill + height / 2;
  group.add(glass);

  const barDepth = wall.thickness + 0.015;
  const bar = (w: number, h: number, x: number, y: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, barDepth), frameMat);
    mesh.position.set(x, y, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  bar(width, 0.055, 0, sill + 0.027);
  bar(width, 0.055, 0, top - 0.027);
  bar(0.055, height, -width / 2 + 0.028, sill + height / 2);
  bar(0.055, height, width / 2 - 0.028, sill + height / 2);
  bar(0.028, height - 0.06, 0, sill + height / 2);

  const sillBoard = new THREE.Mesh(new THREE.BoxGeometry(width + 0.14, 0.045, wall.thickness + 0.18), frameMat);
  sillBoard.position.y = sill - 0.015;
  sillBoard.castShadow = true;
  sillBoard.receiveShadow = true;
  group.add(sillBoard);
  return group;
}

function doorMesh(wall: Wall, opening: Opening): THREE.Group {
  const group = new THREE.Group();
  const segment = openingSegment(wall, opening);
  group.position.set(segment.center.x, 0, segment.center.y);
  group.rotation.y = -segment.angle;

  const width = segment.length;
  const doorHeight = 2.1;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xece4d6, roughness: 0.6 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x9b7551, roughness: 0.48 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc3a26a, roughness: 0.32, metalness: 0.6 });

  const jamb = (x: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, doorHeight, wall.thickness + 0.03), frameMat);
    mesh.position.set(x, doorHeight / 2, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  jamb(-width / 2 + 0.03);
  jamb(width / 2 - 0.03);
  const head = new THREE.Mesh(new THREE.BoxGeometry(width, 0.07, wall.thickness + 0.03), frameMat);
  head.position.y = doorHeight - 0.035;
  head.castShadow = true;
  group.add(head);

  const leafWidth = width - 0.09;
  const hinge = new THREE.Group();
  hinge.position.set(-width / 2 + 0.045, 0, 0);
  hinge.rotation.y = -0.92;
  group.add(hinge);

  const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafWidth, 2.02, 0.042), doorMat);
  leaf.position.set(leafWidth / 2, 1.01, 0);
  leaf.castShadow = true;
  leaf.receiveShadow = true;
  hinge.add(leaf);

  const insetMat = new THREE.MeshStandardMaterial({ color: 0x8a6647, roughness: 0.52 });
  for (const z of [-0.024, 0.024]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(leafWidth - 0.16, 1.62, 0.008), insetMat);
    panel.position.set(leafWidth / 2, 1.0, z);
    hinge.add(panel);
  }

  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), brass);
  handle.position.set(leafWidth - 0.11, 1.02, 0.055);
  hinge.add(handle);
  const handleBack = handle.clone();
  handleBack.position.z = -0.055;
  hinge.add(handleBack);

  const threshold = new THREE.Mesh(new THREE.BoxGeometry(width, 0.025, wall.thickness + 0.02), frameMat);
  threshold.position.y = 0.0125;
  threshold.receiveShadow = true;
  group.add(threshold);

  return group;
}

function stairMesh(stair: Stair): THREE.Group {
  const group = new THREE.Group();
  group.position.set(stair.x, 0, stair.y);
  group.rotation.y = -stair.rotation;
  group.userData.stairId = stair.id;

  const wood = new THREE.MeshStandardMaterial({ color: 0xb08a62, roughness: 0.52 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x8e6b48, roughness: 0.6 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb49460, roughness: 0.35, metalness: 0.5 });
  const run = stair.depth / stair.steps;
  const rise = FLOOR_HEIGHT / stair.steps;

  for (let i = 0; i < stair.steps; i += 1) {
    const height = (i + 1) * rise;
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(stair.width, height, run * 0.96),
      i % 2 === 0 ? wood : edge,
    );
    step.position.set(0, height / 2, stair.depth / 2 - run * (i + 0.5));
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);
  }

  const stringerLength = Math.hypot(stair.depth, FLOOR_HEIGHT);
  const railAngle = Math.atan2(FLOOR_HEIGHT, stair.depth);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, stringerLength), brass);
    rail.position.set(side * (stair.width / 2 - 0.04), FLOOR_HEIGHT / 2 + 0.9, 0);
    rail.rotation.x = railAngle;
    rail.castShadow = true;
    group.add(rail);

    for (let i = 0; i <= stair.steps; i += 4) {
      const y = i * rise;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.9, 0.028), brass);
      post.position.set(side * (stair.width / 2 - 0.04), y + 0.45, stair.depth / 2 - run * i);
      post.castShadow = true;
      group.add(post);
    }
  }

  const base = new THREE.Mesh(new THREE.BoxGeometry(stair.width, 0.035, stair.depth), edge);
  base.position.y = 0.017;
  base.receiveShadow = true;
  group.add(base);

  return group;
}

function addCountBadge(group: THREE.Group, count: number, height: number): void {
  if (count <= 0) return;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createCountTexture(count),
      transparent: true,
      depthTest: true,
      depthWrite: false,
    }),
  );
  sprite.scale.set(0.5, 0.28, 1);
  sprite.position.y = height + 0.26;
  sprite.renderOrder = 2;
  sprite.userData.isCountBadge = true;
  group.add(sprite);
}

function pointSegmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(x - ax, y - ay);
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSq));
  return Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
}

function isExteriorWall(wall: Wall, rings: [number, number][][]): boolean {
  const mx = (wall.a.x + wall.b.x) / 2;
  const my = (wall.a.y + wall.b.y) / 2;
  let nearest = Infinity;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i += 1) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[i + 1];
      nearest = Math.min(nearest, pointSegmentDistance(mx, my, ax, ay, bx, by));
    }
  }
  return nearest <= wall.thickness / 2 + 0.16;
}

/**
 * Build the whole house, one group per storey. Stair openings are subtracted
 * from the slab above because the stairs rise to the next elevation.
 */
export function buildHouse(
  house: House,
  wood: THREE.Texture,
  wallMaterial: THREE.Material,
  anisotropy: number,
): HouseBuild {
  const root = new THREE.Group();
  const furnitureObjects = new Map<string, THREE.Object3D>();
  const wallVisuals: WallVisual[] = [];
  const floorGroups = new Map<number, FloorVisual>();
  const floors = [...house.floors].sort((a, b) => a.level - b.level);
  const baseboardMaterial = new THREE.MeshStandardMaterial({ color: 0xe4dbcb, roughness: 0.7 });

  let bounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  let topHeight = FLOOR_HEIGHT;

  for (const floor of floors) {
    const floorGroup = new THREE.Group();
    const elevation = floorElevation(floor.level);
    floorGroup.position.y = elevation;
    floorGroup.name = `floor:${floor.level}`;

    const geometry = buildFloorGeometry(floor.shapes);
    if (geometry.polygons.length > 0) {
      bounds = bounds
        ? {
            minX: Math.min(bounds.minX, geometry.bounds.minX),
            minY: Math.min(bounds.minY, geometry.bounds.minY),
            maxX: Math.max(bounds.maxX, geometry.bounds.maxX),
            maxY: Math.max(bounds.maxY, geometry.bounds.maxY),
          }
        : { ...geometry.bounds };
    }
    const rings = geometry.polygons.map((polygon) => polygon[0] as [number, number][]);
    const lower = floors.find((entry) => entry.level === floor.level - 1);
    const extraCuts = lower ? lower.stairs.map((stair) => stairFootprint(stair, 0.04)) : [];

    floorGroup.add(floorMeshes(floor, wood, extraCuts));

    const openingsByWall = new Map<string, Opening[]>();
    for (const opening of floor.openings) {
      const list = openingsByWall.get(opening.wallId) ?? [];
      list.push(opening);
      openingsByWall.set(opening.wallId, list);
    }

    for (const wall of floor.walls) {
      const wallGroup = new THREE.Group();
      wallGroup.name = `wall:${floor.level}:${wall.id}`;
      wallGroup.add(
        wallIntervalBoxes(wall, openingsByWall.get(wall.id) ?? [], wallMaterial, baseboardMaterial),
      );
      for (const opening of openingsByWall.get(wall.id) ?? []) {
        wallGroup.add(opening.kind === 'window' ? windowMesh(wall, opening) : doorMesh(wall, opening));
      }
      floorGroup.add(wallGroup);
      wallVisuals.push({
        group: wallGroup,
        center: new THREE.Vector3((wall.a.x + wall.b.x) / 2, elevation, (wall.a.y + wall.b.y) / 2),
        exterior: isExteriorWall(wall, rings),
        level: floor.level,
      });
    }

    for (const stair of floor.stairs) {
      floorGroup.add(stairMesh(stair));
    }

    for (const furniture of floor.furniture) {
      const object = buildFurniture(furniture, anisotropy);
      const count = furniture.items.reduce((sum, item) => sum + item.quantity, 0);
      addCountBadge(object, count, FURNITURE_CATALOG[furniture.kind].height);
      object.userData.floorId = floor.id;
      object.userData.floorLevel = floor.level;
      object.traverse((child) => {
        child.userData.floorLevel = floor.level;
      });
      floorGroup.add(object);
      furnitureObjects.set(furniture.id, object);
    }

    root.add(floorGroup);
    floorGroups.set(floor.level, { level: floor.level, elevation, group: floorGroup });
    topHeight = elevation + FLOOR_HEIGHT;
  }

  const center = new THREE.Vector3(
    bounds ? (bounds.minX + bounds.maxX) / 2 : 4,
    topHeight / 2,
    bounds ? (bounds.minY + bounds.maxY) / 2 : 3,
  );
  let radius = bounds ? Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 8) / 2 : 5;
  if (!Number.isFinite(radius) || radius <= 0) radius = 5;

  return { root, furnitureObjects, wallVisuals, floorGroups, center, radius, topHeight };
}

export { disposeObject };
