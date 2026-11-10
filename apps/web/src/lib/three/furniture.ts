import { FURNITURE_CATALOG } from '@shijian/shared';
import type { Furniture } from '@shijian/shared';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createFabricTexture } from './textures';

interface Placement {
  x?: number;
  y?: number;
  z?: number;
}

function material(color: THREE.ColorRepresentation, roughness = 0.82, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addRounded(
  group: THREE.Group,
  width: number,
  height: number,
  depth: number,
  mat: THREE.Material,
  placement: Placement = {},
  radius = 0.035,
): THREE.Mesh {
  const safeRadius = Math.max(0.005, Math.min(radius, width / 2 - 0.001, height / 2 - 0.001, depth / 2 - 0.001));
  const geometry = new RoundedBoxGeometry(width, height, depth, 3, safeRadius);
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(placement.x ?? 0, placement.y ?? 0, placement.z ?? 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addBox(
  group: THREE.Group,
  width: number,
  height: number,
  depth: number,
  mat: THREE.Material,
  placement: Placement = {},
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
  mesh.position.set(placement.x ?? 0, placement.y ?? 0, placement.z ?? 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addCylinder(
  group: THREE.Group,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  mat: THREE.Material,
  placement: Placement = {},
  segments = 16,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), mat);
  mesh.position.set(placement.x ?? 0, placement.y ?? 0, placement.z ?? 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addLegs(
  group: THREE.Group,
  width: number,
  depth: number,
  height: number,
  inset: number,
  mat: THREE.Material,
): void {
  const positions: [number, number][] = [
    [-width / 2 + inset, -depth / 2 + inset],
    [width / 2 - inset, -depth / 2 + inset],
    [-width / 2 + inset, depth / 2 - inset],
    [width / 2 - inset, depth / 2 - inset],
  ];
  for (const [x, z] of positions) {
    addCylinder(group, 0.022, 0.028, height, mat, { x, y: height / 2, z }, 10);
  }
}

function buildSofa(furniture: Furniture, anisotropy: number): THREE.Group {
  const group = new THREE.Group();
  const w = furniture.width;
  const d = furniture.depth;
  const fabric = material('#ffffff');
  fabric.map = createFabricTexture(furniture.color, anisotropy);
  const darker = material(new THREE.Color(furniture.color).multiplyScalar(0.76).getStyle());
  const pillowMat = material(new THREE.Color(furniture.color).offsetHSL(0.02, -0.06, 0.16).getStyle());
  const legMat = material('#58483a', 0.65);

  addLegs(group, w, d, 0.11, 0.13, legMat);
  addRounded(group, w - 0.06, 0.2, d - 0.04, darker, { y: 0.19 }, 0.05);
  addRounded(group, w - 0.12, 0.24, d - 0.12, fabric, { y: 0.36 }, 0.06);
  addRounded(group, w, 0.6, 0.18, fabric, { y: 0.53, z: -d / 2 + 0.09 }, 0.07);
  const armW = Math.max(0.12, Math.min(0.2, w * 0.085));
  addRounded(group, armW, 0.46, d - 0.08, darker, { x: -w / 2 + armW / 2 + 0.02, y: 0.42 }, 0.06);
  addRounded(group, armW, 0.46, d - 0.08, darker, { x: w / 2 - armW / 2 - 0.02, y: 0.42 }, 0.06);

  const cushions = w > 1.7 ? 3 : 2;
  const innerW = w - armW * 2 - 0.16;
  const gap = 0.035;
  const cushionW = (innerW - gap * (cushions - 1)) / cushions;
  for (let i = 0; i < cushions; i += 1) {
    addRounded(
      group,
      cushionW,
      0.17,
      d - 0.34,
      fabric,
      {
        x: -innerW / 2 + cushionW / 2 + i * (cushionW + gap),
        y: 0.5,
        z: 0.08,
      },
      0.055,
    );
  }
  const pillow = addRounded(group, 0.36, 0.36, 0.12, pillowMat, { x: -w / 2 + 0.38, y: 0.66, z: -d / 2 + 0.28 }, 0.06);
  pillow.rotation.z = -0.12;
  pillow.rotation.y = 0.24;
  const pillow2 = addRounded(group, 0.33, 0.33, 0.12, pillowMat, { x: w / 2 - 0.36, y: 0.64, z: -d / 2 + 0.3 }, 0.06);
  pillow2.rotation.z = 0.08;
  pillow2.rotation.y = -0.18;
  return group;
}

function buildTable(furniture: Furniture): THREE.Group {
  const group = new THREE.Group();
  const w = furniture.width;
  const d = furniture.depth;
  const height = 0.74;
  const wood = material(furniture.color, 0.62);
  const darkWood = material(new THREE.Color(furniture.color).multiplyScalar(0.7).getStyle(), 0.7);
  addRounded(group, w, 0.065, d, wood, { y: height }, 0.025);
  addBox(group, w - 0.16, 0.09, d - 0.14, darkWood, { y: height - 0.075 });
  const legInset = 0.09;
  for (const [x, z] of [
    [-w / 2 + legInset, -d / 2 + legInset],
    [w / 2 - legInset, -d / 2 + legInset],
    [-w / 2 + legInset, d / 2 - legInset],
    [w / 2 - legInset, d / 2 - legInset],
  ]) {
    addBox(group, 0.055, height - 0.1, 0.055, darkWood, { x, y: (height - 0.1) / 2, z });
  }
  addBox(group, w - 0.25, 0.06, d - 0.22, darkWood, { y: 0.16 });
  return group;
}

function buildBed(furniture: Furniture, anisotropy: number): THREE.Group {
  const group = new THREE.Group();
  const w = furniture.width;
  const d = furniture.depth;
  const frameMat = material(furniture.color, 0.7);
  const mattressMat = material('#f5f0e6', 0.92);
  const linen = material('#ffffff', 0.95);
  linen.map = createFabricTexture('#7f9484', anisotropy);
  const blanketMat = material('#809686', 0.96);
  const pillowMat = material('#fbf7ee', 0.92);

  addLegs(group, w, d, 0.1, 0.12, material('#5d4b3c', 0.7));
  addRounded(group, w, 0.24, d, frameMat, { y: 0.22 }, 0.035);
  addRounded(group, w - 0.08, 0.24, d - 0.08, mattressMat, { y: 0.41 }, 0.07);
  addRounded(group, w - 0.06, 0.07, d * 0.48, blanketMat, { y: 0.545, z: d * 0.23 }, 0.035);
  addRounded(group, w - 0.06, 0.05, 0.16, linen, { y: 0.57, z: d * 0.06 }, 0.025);

  addRounded(group, w, 0.82, 0.085, frameMat, { y: 0.53, z: -d / 2 - 0.045 }, 0.04);
  const pillowW = (w - 0.28) / 2;
  const p1 = addRounded(group, pillowW, 0.16, d * 0.26, pillowMat, { x: -w / 4 + 0.02, y: 0.57, z: -d * 0.31 }, 0.075);
  p1.rotation.x = -0.1;
  const p2 = addRounded(group, pillowW, 0.16, d * 0.26, pillowMat, { x: w / 4 - 0.02, y: 0.57, z: -d * 0.31 }, 0.075);
  p2.rotation.x = -0.08;

  addBox(group, w - 0.1, 0.035, 0.045, material('#6b7f70', 0.9), { y: 0.585, z: d * 0.03 });
  return group;
}

function buildCabinet(furniture: Furniture): THREE.Group {
  const group = new THREE.Group();
  const w = furniture.width;
  const d = furniture.depth;
  const h = FURNITURE_CATALOG[furniture.kind].height;
  const body = material(furniture.color, 0.6);
  const front = material(new THREE.Color(furniture.color).offsetHSL(0, -0.015, 0.07).getStyle(), 0.55);
  const trim = material(new THREE.Color(furniture.color).multiplyScalar(0.68).getStyle(), 0.7);
  const brass = material('#b48a51', 0.42, 0.55);

  addLegs(group, w, d, 0.08, 0.09, trim);
  addRounded(group, w, h - 0.08, d, body, { y: h / 2 }, 0.018);
  addBox(group, w - 0.08, 0.035, d + 0.01, trim, { y: h - 0.02 });
  const doorGap = 0.012;
  const panelW = (w - 0.1 - doorGap) / 2;
  for (const side of [-1, 1]) {
    addBox(group, panelW, h - 0.2, 0.024, front, {
      x: side * (panelW / 2 + doorGap / 2 + 0.012),
      y: h / 2 - 0.02,
      z: d / 2 + 0.012,
    });
    addCylinder(group, 0.011, 0.011, 0.12, brass, {
      x: side * 0.055,
      y: h * 0.56,
      z: d / 2 + 0.04,
    }, 10).rotation.z = Math.PI / 2;
  }
  addBox(group, w - 0.1, 0.04, 0.03, trim, { y: 0.15, z: d / 2 + 0.005 });
  return group;
}

function buildNightstand(furniture: Furniture): THREE.Group {
  const group = new THREE.Group();
  const w = furniture.width;
  const d = furniture.depth;
  const h = FURNITURE_CATALOG[furniture.kind].height;
  const body = material(furniture.color, 0.62);
  const drawer = material(new THREE.Color(furniture.color).offsetHSL(0, 0, 0.08).getStyle(), 0.56);
  const trim = material(new THREE.Color(furniture.color).multiplyScalar(0.66).getStyle(), 0.7);
  const brass = material('#c3a36b', 0.35, 0.5);

  addLegs(group, w, d, 0.08, 0.055, trim);
  addRounded(group, w, h - 0.08, d, body, { y: h / 2 }, 0.018);
  addBox(group, w - 0.06, 0.03, d + 0.01, trim, { y: h - 0.015 });
  for (const [index, ratio] of [0.34, 0.7].entries()) {
    addBox(group, w - 0.1, h * 0.28, 0.02, drawer, { y: h * ratio, z: d / 2 + 0.011 });
    const knob = addCylinder(group, 0.018, 0.018, 0.035, brass, { y: h * ratio, z: d / 2 + 0.045 }, 12);
    knob.rotation.x = Math.PI / 2;
    if (index === 1) knob.position.y = h * ratio;
  }
  return group;
}

export function buildFurniture(furniture: Furniture, anisotropy = 4): THREE.Group {
  let group: THREE.Group;
  switch (furniture.kind) {
    case 'sofa':
      group = buildSofa(furniture, anisotropy);
      break;
    case 'table':
      group = buildTable(furniture);
      break;
    case 'bed':
      group = buildBed(furniture, anisotropy);
      break;
    case 'cabinet':
      group = buildCabinet(furniture);
      break;
    case 'nightstand':
    default:
      group = buildNightstand(furniture);
      break;
  }
  group.position.set(furniture.x, 0, furniture.y);
  group.rotation.y = -furniture.rotation;
  group.userData.furnitureId = furniture.id;
  group.traverse((child) => {
    child.userData.furnitureId = furniture.id;
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return group;
}
