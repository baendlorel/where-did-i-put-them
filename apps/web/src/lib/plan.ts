import {
  buildFloorGeometry,
  distance,
  openingSegment,
  solidWallSpans,
  wallLength,
} from '@shijian/shared';
import type {
  BooleanMode,
  FloorGeometry,
  FloorShape,
  Furniture,
  FurnitureKind,
  Opening,
  Project,
  ShapeKind,
  Tool,
  Vec2,
  Wall,
} from '@shijian/shared';
import type { Selection } from '../stores/workspace';

export interface PlanCamera {
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
  dpr: number;
}

export interface ShapePreview {
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Preview {
  shape?: ShapePreview;
  wall?: { a: Vec2; b: Vec2 };
  opening?: { wallId: string; kind: Opening['kind']; offset: number };
  furniture?: {
    kind: FurnitureKind;
    x: number;
    y: number;
    width: number;
    depth: number;
    rotation: number;
    color: string;
  };
}

export interface RenderOptions {
  project: Project;
  camera: PlanCamera;
  floor: FloorGeometry;
  now: number;
  selection: Selection | null;
  highlightId: string | null;
  highlightName: string;
  hoverFurnitureId: string | null;
  preview: Preview;
  tool: Tool;
  booleanMode: BooleanMode;
  mouse: Vec2 | null;
  spacePanning: boolean;
}

const COLORS = {
  bg: '#eee8dc',
  gridMinor: 'rgba(86, 94, 86, 0.075)',
  gridMajor: 'rgba(86, 94, 86, 0.15)',
  floor: '#f7f0e3',
  floorEdge: '#cbbda7',
  plank: 'rgba(166, 142, 106, 0.16)',
  wall: '#2e3933',
  wallHi: 'rgba(255,255,255,0.13)',
  window: '#5d8d96',
  door: '#b76b46',
  accent: '#c47049',
  sage: '#74897a',
  ink: '#2e3933',
  muted: '#8b938c',
  danger: '#b55749',
  label: 'rgba(251,249,244,0.92)',
};

export function worldToScreen(point: Vec2, camera: PlanCamera): Vec2 {
  return {
    x: (point.x - camera.x) * camera.scale + camera.width / 2,
    y: (point.y - camera.y) * camera.scale + camera.height / 2,
  };
}

export function screenToWorld(point: Vec2, camera: PlanCamera): Vec2 {
  return {
    x: (point.x - camera.width / 2) / camera.scale + camera.x,
    y: (point.y - camera.height / 2) / camera.scale + camera.y,
  };
}

export function hitFurniture(project: Project, point: Vec2): Furniture | null {
  for (let i = project.furniture.length - 1; i >= 0; i -= 1) {
    const furniture = project.furniture[i];
    const dx = point.x - furniture.x;
    const dy = point.y - furniture.y;
    const cos = Math.cos(-furniture.rotation);
    const sin = Math.sin(-furniture.rotation);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    const pad = 0.04;
    if (Math.abs(localX) <= furniture.width / 2 + pad && Math.abs(localY) <= furniture.depth / 2 + pad) {
      return furniture;
    }
  }
  return null;
}

export function hitWall(project: Project, point: Vec2): Wall | null {
  let closest: { wall: Wall; distance: number } | null = null;
  for (const wall of project.floor.walls) {
    const dx = wall.b.x - wall.a.x;
    const dy = wall.b.y - wall.a.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) continue;
    const t = Math.max(0, Math.min(1, ((point.x - wall.a.x) * dx + (point.y - wall.a.y) * dy) / lengthSq));
    const px = wall.a.x + dx * t;
    const py = wall.a.y + dy * t;
    const dist = Math.hypot(point.x - px, point.y - py);
    if (dist <= wall.thickness / 2 + 0.14 && (!closest || dist < closest.distance)) closest = { wall, distance: dist };
  }
  return closest?.wall ?? null;
}

export function hitOpening(project: Project, point: Vec2): Opening | null {
  for (const opening of project.floor.openings) {
    const wall = project.floor.walls.find((item) => item.id === opening.wallId);
    if (!wall) continue;
    const segment = openingSegment(wall, opening);
    const dx = segment.b.x - segment.a.x;
    const dy = segment.b.y - segment.a.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) continue;
    const t = Math.max(0, Math.min(1, ((point.x - segment.a.x) * dx + (point.y - segment.a.y) * dy) / lengthSq));
    const px = segment.a.x + dx * t;
    const py = segment.a.y + dy * t;
    if (Math.hypot(point.x - px, point.y - py) <= 0.18) return opening;
  }
  return null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16) || 0,
    g: parseInt(value.slice(2, 4), 16) || 0,
    b: parseInt(value.slice(4, 6), 16) || 0,
  };
}

export function shade(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const adjust = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount))));
  return `rgb(${adjust(r)}, ${adjust(g)}, ${adjust(b)})`;
}

export function alpha(hex: string, value: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${value})`;
}

function addRing(path: Path2D, ring: [number, number][], camera: PlanCamera): void {
  ring.forEach(([x, y], index) => {
    const screen = worldToScreen({ x, y }, camera);
    if (index === 0) path.moveTo(screen.x, screen.y);
    else path.lineTo(screen.x, screen.y);
  });
  path.closePath();
}

function floorPath(floor: FloorGeometry, camera: PlanCamera): Path2D {
  const path = new Path2D();
  for (const polygon of floor.polygons) {
    for (const ring of polygon) addRing(path, ring as [number, number][], camera);
  }
  return path;
}

function drawGrid(ctx: CanvasRenderingContext2D, camera: PlanCamera): void {
  const { width, height, x, y, scale } = camera;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  const step = scale >= 105 ? 0.5 : scale >= 45 ? 1 : 2;
  const left = x - width / 2 / scale;
  const right = x + width / 2 / scale;
  const top = y - height / 2 / scale;
  const bottom = y + height / 2 / scale;
  const startX = Math.floor(left / step) * step;
  const startY = Math.floor(top / step) * step;

  ctx.lineWidth = 1;
  for (let gx = startX; gx <= right; gx += step) {
    const screenX = Math.round((gx - x) * scale + width / 2) + 0.5;
    const major = Math.abs(gx / (step * 5) - Math.round(gx / (step * 5))) < 0.001;
    ctx.strokeStyle = major ? COLORS.gridMajor : COLORS.gridMinor;
    ctx.beginPath();
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, height);
    ctx.stroke();
  }
  for (let gy = startY; gy <= bottom; gy += step) {
    const screenY = Math.round((gy - y) * scale + height / 2) + 0.5;
    const major = Math.abs(gy / (step * 5) - Math.round(gy / (step * 5))) < 0.001;
    ctx.strokeStyle = major ? COLORS.gridMajor : COLORS.gridMinor;
    ctx.beginPath();
    ctx.moveTo(0, screenY);
    ctx.lineTo(width, screenY);
    ctx.stroke();
  }

  const origin = worldToScreen({ x: 0, y: 0 }, camera);
  ctx.strokeStyle = 'rgba(196, 112, 73, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(origin.x, 0);
  ctx.lineTo(origin.x, height);
  ctx.moveTo(0, origin.y);
  ctx.lineTo(width, origin.y);
  ctx.stroke();
}

function drawFloor(ctx: CanvasRenderingContext2D, floor: FloorGeometry, camera: PlanCamera): void {
  if (floor.polygons.length === 0) return;
  const path = floorPath(floor, camera);
  ctx.save();
  ctx.shadowColor = 'rgba(66, 52, 36, 0.16)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = COLORS.floor;
  ctx.fill(path, 'evenodd');
  ctx.restore();

  ctx.save();
  ctx.clip(path, 'evenodd');
  const { x, y, width, height, scale } = camera;
  const left = x - width / 2 / scale;
  const right = x + width / 2 / scale;
  const top = y - height / 2 / scale;
  const bottom = y + height / 2 / scale;
  if (scale > 30) {
    const step = 0.42;
    ctx.strokeStyle = COLORS.plank;
    ctx.lineWidth = 0.8;
    const start = Math.floor(top / step) * step;
    for (let gy = start; gy <= bottom; gy += step) {
      const sy = worldToScreen({ x: 0, y: gy }, camera).y;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
      ctx.stroke();
    }
    const jointStep = 1.26;
    const startX = Math.floor(left / jointStep) * jointStep;
    for (let gx = startX; gx <= right; gx += jointStep) {
      const sx = worldToScreen({ x: gx, y: 0 }, camera).x;
      ctx.beginPath();
      for (let gy = start; gy <= bottom; gy += step) {
        const offset = Math.round(gy / step) % 2 === 0 ? 0 : jointStep / 2;
        ctx.moveTo(sx + offset * scale, worldToScreen({ x: 0, y: gy }, camera).y);
        ctx.lineTo(sx + offset * scale, worldToScreen({ x: 0, y: gy + step }, camera).y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();

  for (const polygon of floor.polygons) {
    const outer = polygon[0] as [number, number][];
    ctx.beginPath();
    outer.forEach(([px, py], index) => {
      const screen = worldToScreen({ x: px, y: py }, camera);
      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    });
    ctx.closePath();
    ctx.strokeStyle = COLORS.floorEdge;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

function drawWallSegment(
  ctx: CanvasRenderingContext2D,
  a: Vec2,
  b: Vec2,
  thickness: number,
  camera: PlanCamera,
  color = COLORS.wall,
): void {
  const pa = worldToScreen(a, camera);
  const pb = worldToScreen(b, camera);
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, thickness * camera.scale);
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.lineWidth = Math.max(1, thickness * camera.scale * 0.35);
  ctx.strokeStyle = COLORS.wallHi;
  ctx.stroke();
}

function drawWalls(ctx: CanvasRenderingContext2D, project: Project, camera: PlanCamera): void {
  const openingsByWall = new Map<string, Opening[]>();
  for (const opening of project.floor.openings) {
    const list = openingsByWall.get(opening.wallId) ?? [];
    list.push(opening);
    openingsByWall.set(opening.wallId, list);
  }

  ctx.save();
  ctx.shadowColor = 'rgba(38, 48, 42, 0.18)';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 3;
  for (const wall of project.floor.walls) {
    const length = wallLength(wall);
    if (length < 0.03) continue;
    const ux = (wall.b.x - wall.a.x) / length;
    const uy = (wall.b.y - wall.a.y) / length;
    const openings = (openingsByWall.get(wall.id) ?? [])
      .map((opening) => {
        const center = opening.offset * length;
        const half = Math.min(opening.width, length) / 2;
        return { opening, start: Math.max(0, center - half), end: Math.min(length, center + half) };
      })
      .sort((a, b) => a.start - b.start);

    let cursor = 0;
    for (const item of openings) {
      if (item.start > cursor + 0.01) {
        drawWallSegment(
          ctx,
          { x: wall.a.x + ux * cursor, y: wall.a.y + uy * cursor },
          { x: wall.a.x + ux * item.start, y: wall.a.y + uy * item.start },
          wall.thickness,
          camera,
        );
      }
      cursor = Math.max(cursor, item.end);
    }
    if (cursor < length - 0.01) {
      drawWallSegment(
        ctx,
        { x: wall.a.x + ux * cursor, y: wall.a.y + uy * cursor },
        wall.b,
        wall.thickness,
        camera,
      );
    }
  }
  ctx.restore();
}

function drawOpenings(ctx: CanvasRenderingContext2D, project: Project, camera: PlanCamera): void {
  for (const opening of project.floor.openings) {
    const wall = project.floor.walls.find((item) => item.id === opening.wallId);
    if (!wall) continue;
    const segment = openingSegment(wall, opening);
    const a = worldToScreen(segment.a, camera);
    const b = worldToScreen(segment.b, camera);
    const nx = -Math.sin(segment.angle);
    const ny = Math.cos(segment.angle);
    const px = Math.cos(segment.angle);
    const py = Math.sin(segment.angle);

    if (opening.kind === 'window') {
      ctx.save();
      ctx.strokeStyle = COLORS.window;
      ctx.lineWidth = Math.max(3, Math.min(7, camera.scale * 0.045));
      ctx.setLineDash([Math.max(5, camera.scale * 0.09), Math.max(4, camera.scale * 0.055)]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = alpha(COLORS.window, 0.65);
      for (const point of [a, b]) {
        ctx.beginPath();
        ctx.moveTo(point.x - nx * Math.max(5, wall.thickness * camera.scale * 0.8), point.y - ny * Math.max(5, wall.thickness * camera.scale * 0.8));
        ctx.lineTo(point.x + nx * Math.max(5, wall.thickness * camera.scale * 0.8), point.y + ny * Math.max(5, wall.thickness * camera.scale * 0.8));
        ctx.stroke();
      }
      ctx.restore();
    } else {
      ctx.save();
      ctx.strokeStyle = COLORS.door;
      ctx.lineWidth = Math.max(5, Math.min(12, camera.scale * 0.075));
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x + px * 1, a.y + py * 1);
      ctx.lineTo(b.x - px * 1, b.y - py * 1);
      ctx.stroke();

      const radius = Math.min(segment.length * camera.scale, camera.scale * 1.1);
      const startAngle = Math.atan2(py, px);
      const direction = camera.scale > 0 ? 1 : 1;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = alpha(COLORS.door, 0.5);
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(a.x, a.y, radius, startAngle, startAngle + direction * Math.PI * 0.46);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      const openAngle = startAngle + direction * Math.PI * 0.46;
      ctx.lineTo(a.x + Math.cos(openAngle) * radius, a.y + Math.sin(openAngle) * radius);
      ctx.stroke();
      ctx.fillStyle = COLORS.door;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
}

function drawFurnitureShape(
  ctx: CanvasRenderingContext2D,
  furniture: Pick<Furniture, 'kind' | 'width' | 'depth' | 'color'>,
): void {
  const w = furniture.width;
  const d = furniture.depth;
  const color = furniture.color;
  const dark = shade(color, -0.22);
  const light = shade(color, 0.14);
  ctx.lineJoin = 'round';

  if (furniture.kind === 'sofa') {
    const radius = Math.min(0.11, d * 0.16);
    ctx.fillStyle = dark;
    roundRect(ctx, -w / 2, -d / 2, w, d, radius);
    ctx.fill();

    ctx.fillStyle = light;
    roundRect(ctx, -w / 2 + 0.07, -d / 2 + 0.05, w - 0.14, d * 0.26, 0.06);
    ctx.fill();

    const armW = Math.max(0.1, Math.min(0.19, w * 0.09));
    ctx.fillStyle = shade(color, -0.08);
    roundRect(ctx, -w / 2 + 0.045, -d / 2 + 0.2, armW, d - 0.28, 0.05);
    ctx.fill();
    roundRect(ctx, w / 2 - 0.045 - armW, -d / 2 + 0.2, armW, d - 0.28, 0.05);
    ctx.fill();

    const cushions = w > 1.7 ? 3 : 2;
    const innerW = w - armW * 2 - 0.22;
    const gap = 0.045;
    const cw = (innerW - gap * (cushions - 1)) / cushions;
    for (let i = 0; i < cushions; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? light : shade(color, 0.07);
      roundRect(
        ctx,
        -w / 2 + armW + 0.11 + i * (cw + gap),
        -d * 0.06,
        cw,
        d * 0.42,
        0.065,
      );
      ctx.fill();
      ctx.strokeStyle = alpha(dark, 0.35);
      ctx.lineWidth = 0.012;
      ctx.stroke();
    }

    ctx.fillStyle = shade(color, -0.34);
    roundRect(ctx, -w / 2 + 0.09, d / 2 - 0.12, w - 0.18, 0.075, 0.03);
    ctx.fill();
    return;
  }

  if (furniture.kind === 'table') {
    ctx.fillStyle = shade(color, -0.32);
    roundRect(ctx, -w / 2 + 0.06, -d / 2 + 0.06, w - 0.12, d - 0.12, 0.06);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, -w / 2, -d / 2, w, d, 0.075);
    ctx.fill();
    ctx.strokeStyle = alpha(shade(color, 0.42), 0.65);
    ctx.lineWidth = 0.018;
    ctx.stroke();
    ctx.strokeStyle = alpha(dark, 0.28);
    ctx.lineWidth = 0.012;
    for (let i = 1; i <= 3; i += 1) {
      const y = -d / 2 + (d * i) / 4;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 0.07, y);
      ctx.lineTo(w / 2 - 0.07, y);
      ctx.stroke();
    }
    ctx.fillStyle = light;
    for (const [cx, cy] of [
      [-w / 2 + 0.08, -d / 2 + 0.08],
      [w / 2 - 0.14, -d / 2 + 0.08],
      [-w / 2 + 0.08, d / 2 - 0.14],
      [w / 2 - 0.14, d / 2 - 0.14],
    ]) {
      ctx.fillRect(cx, cy, 0.06, 0.06);
    }
    return;
  }

  if (furniture.kind === 'bed') {
    ctx.fillStyle = shade(color, -0.24);
    roundRect(ctx, -w / 2, -d / 2, w, d, 0.1);
    ctx.fill();
    ctx.fillStyle = shade(color, 0.42);
    roundRect(ctx, -w / 2 + 0.07, -d / 2 + 0.08, w - 0.14, d - 0.16, 0.07);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 253, 247, 0.92)';
    const pillowW = (w - 0.36) / 2;
    roundRect(ctx, -w / 2 + 0.12, -d / 2 + 0.16, pillowW, d * 0.23, 0.08);
    ctx.fill();
    roundRect(ctx, 0.06, -d / 2 + 0.16, pillowW, d * 0.23, 0.08);
    ctx.fill();
    ctx.strokeStyle = 'rgba(130, 120, 102, 0.25)';
    ctx.lineWidth = 0.01;
    ctx.stroke();

    ctx.fillStyle = 'rgba(126, 148, 131, 0.72)';
    roundRect(ctx, -w / 2 + 0.07, -d * 0.02, w - 0.14, d * 0.47, 0.055);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 0.07, d * 0.08);
    ctx.lineTo(w / 2 - 0.07, d * 0.08);
    ctx.stroke();

    ctx.fillStyle = shade(color, -0.4);
    roundRect(ctx, -w / 2 + 0.06, -d / 2 + 0.025, w - 0.12, 0.055, 0.02);
    ctx.fill();
    return;
  }

  if (furniture.kind === 'cabinet') {
    ctx.fillStyle = shade(color, -0.36);
    roundRect(ctx, -w / 2, -d / 2, w, d, 0.045);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, -w / 2 + 0.025, -d / 2 + 0.025, w - 0.05, d - 0.05, 0.035);
    ctx.fill();
    ctx.strokeStyle = alpha(shade(color, 0.4), 0.45);
    ctx.lineWidth = 0.013;
    ctx.stroke();
    ctx.strokeStyle = alpha(shade(color, -0.5), 0.42);
    ctx.beginPath();
    ctx.moveTo(0, -d / 2 + 0.05);
    ctx.lineTo(0, d / 2 - 0.05);
    ctx.stroke();
    for (const x of [-0.06, 0.06]) {
      ctx.fillStyle = '#c7a66f';
      ctx.fillRect(x - 0.012, -0.035, 0.024, 0.07);
    }
    ctx.strokeStyle = alpha(shade(color, 0.5), 0.35);
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 0.06, -d / 2 + 0.045);
    ctx.lineTo(w / 2 - 0.06, -d / 2 + 0.045);
    ctx.stroke();
    return;
  }

  ctx.fillStyle = shade(color, -0.3);
  roundRect(ctx, -w / 2, -d / 2, w, d, 0.05);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, -w / 2 + 0.02, -d / 2 + 0.02, w - 0.04, d - 0.04, 0.04);
  ctx.fill();
  ctx.strokeStyle = alpha(shade(color, -0.5), 0.35);
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 0.05, 0);
  ctx.lineTo(w / 2 - 0.05, 0);
  ctx.stroke();
  for (const y of [-d * 0.23, d * 0.23]) {
    ctx.fillStyle = '#d1b27b';
    ctx.beginPath();
    ctx.arc(0, y, 0.022, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFurniture(
  ctx: CanvasRenderingContext2D,
  furniture: Furniture,
  camera: PlanCamera,
  options: {
    selected: boolean;
    hovered: boolean;
    highlighted: boolean;
    now: number;
    showLabel: boolean;
  },
): void {
  const screen = worldToScreen(furniture, camera);
  const itemTotal = furniture.items.reduce((sum, item) => sum + item.quantity, 0);

  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.rotate(furniture.rotation);
  ctx.scale(camera.scale, camera.scale);
  ctx.shadowColor = 'rgba(46, 38, 28, 0.18)';
  ctx.shadowBlur = 7 / camera.scale;
  ctx.shadowOffsetY = 4 / camera.scale;
  drawFurnitureShape(ctx, furniture);
  ctx.restore();

  const radius = Math.hypot(furniture.width, furniture.depth) * 0.5 * camera.scale;
  if (options.highlighted) {
    const pulse = (Math.sin(options.now / 360) + 1) / 2;
    ctx.save();
    for (let i = 0; i < 2; i += 1) {
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius + 8 + i * 7 + pulse * 4, 0, Math.PI * 2);
      ctx.strokeStyle = alpha(COLORS.accent, 0.56 - i * 0.17);
      ctx.lineWidth = 2 - i * 0.5;
      ctx.setLineDash(i === 0 ? [] : [5, 5]);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius + 10, 0, Math.PI * 2);
    ctx.fillStyle = alpha(COLORS.accent, 0.055 + pulse * 0.05);
    ctx.fill();
    ctx.restore();
  }

  if (options.selected || options.hovered) {
    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(furniture.rotation);
    const pad = 7;
    const w = furniture.width * camera.scale + pad * 2;
    const d = furniture.depth * camera.scale + pad * 2;
    ctx.strokeStyle = options.selected ? COLORS.accent : alpha(COLORS.ink, 0.35);
    ctx.lineWidth = options.selected ? 1.6 : 1;
    ctx.setLineDash(options.selected ? [] : [4, 4]);
    ctx.strokeRect(-w / 2, -d / 2, w, d);
    if (options.selected) {
      ctx.setLineDash([]);
      ctx.fillStyle = COLORS.accent;
      for (const [hx, hy] of [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [-w / 2, d / 2],
        [w / 2, d / 2],
      ]) {
        ctx.beginPath();
        ctx.arc(hx, hy, 3.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  if (itemTotal > 0 || options.highlighted) {
    const badgeX = screen.x + (furniture.width / 2) * camera.scale * 0.9;
    const badgeY = screen.y - (furniture.depth / 2) * camera.scale * 0.9 - 4;
    ctx.save();
    ctx.shadowColor = 'rgba(46, 38, 28, 0.2)';
    ctx.shadowBlur = 5;
    ctx.fillStyle = options.highlighted ? COLORS.accent : COLORS.ink;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fbf9f4';
    ctx.font = '600 9px "Avenir Next", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(itemTotal > 99 ? '99+' : String(itemTotal), badgeX, badgeY + 0.5);
    ctx.restore();
  }

  if (options.showLabel) {
    const label = furniture.name;
    ctx.save();
    ctx.font = `${options.selected ? 600 : 500} 10.5px "Avenir Next", "PingFang SC", sans-serif`;
    const textWidth = ctx.measureText(label).width;
    const y = screen.y + (furniture.depth / 2) * camera.scale + 11;
    ctx.fillStyle = options.selected ? 'rgba(196, 112, 73, 0.94)' : 'rgba(251, 249, 244, 0.82)';
    roundRect(ctx, screen.x - textWidth / 2 - 5, y - 8, textWidth + 10, 15, 4);
    ctx.fill();
    ctx.fillStyle = options.selected ? '#fffaf3' : 'rgba(46, 57, 51, 0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, screen.x, y);
    ctx.restore();
  }
}

function drawShapePreview(ctx: CanvasRenderingContext2D, preview: ShapePreview, camera: PlanCamera, mode: BooleanMode): void {
  const shape: FloorShape = {
    id: 'preview',
    kind: preview.kind,
    x: preview.x,
    y: preview.y,
    width: preview.width,
    height: preview.height,
    rotation: 0,
    mode,
  };
  const color = mode === 'union' ? '#6e8c77' : COLORS.danger;
  ctx.save();
  ctx.fillStyle = alpha(color, 0.14);
  ctx.strokeStyle = alpha(color, 0.92);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);

  if (shape.kind === 'ellipse') {
    const center = worldToScreen({ x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 }, camera);
    ctx.beginPath();
    ctx.ellipse(
      center.x,
      center.y,
      Math.abs(shape.width / 2) * camera.scale,
      Math.abs(shape.height / 2) * camera.scale,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.stroke();
  } else {
    const a = worldToScreen({ x: shape.x, y: shape.y }, camera);
    ctx.fillRect(a.x, a.y, shape.width * camera.scale, shape.height * camera.scale);
    ctx.strokeRect(a.x, a.y, shape.width * camera.scale, shape.height * camera.scale);
  }

  const label = `${Math.abs(preview.width).toFixed(2)} × ${Math.abs(preview.height).toFixed(2)} m`;
  const top = worldToScreen({ x: shape.x + shape.width / 2, y: shape.y }, camera);
  ctx.setLineDash([]);
  ctx.font = '600 10px "Avenir Next", "PingFang SC", sans-serif';
  const tw = ctx.measureText(label).width + 14;
  ctx.fillStyle = 'rgba(40, 50, 45, 0.88)';
  roundRect(ctx, top.x - tw / 2, top.y - 26, tw, 18, 5);
  ctx.fill();
  ctx.fillStyle = '#fbf9f4';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, top.x, top.y - 17);
  ctx.restore();
}

function drawWallPreview(ctx: CanvasRenderingContext2D, preview: { a: Vec2; b: Vec2 }, camera: PlanCamera): void {
  const a = worldToScreen(preview.a, camera);
  const b = worldToScreen(preview.b, camera);
  const length = distance(preview.a, preview.b);
  ctx.save();
  ctx.strokeStyle = alpha(COLORS.ink, 0.8);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const point of [a, b]) {
    ctx.fillStyle = '#fbf9f4';
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  const label = `${length.toFixed(2)} m`;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  ctx.font = '600 10px "Avenir Next", "PingFang SC", sans-serif';
  const tw = ctx.measureText(label).width + 14;
  ctx.fillStyle = 'rgba(40, 50, 45, 0.9)';
  roundRect(ctx, mid.x - tw / 2, mid.y - 26, tw, 18, 5);
  ctx.fill();
  ctx.fillStyle = '#fbf9f4';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, mid.x, mid.y - 17);
  ctx.restore();
}

function drawOpeningPreview(
  ctx: CanvasRenderingContext2D,
  project: Project,
  preview: { wallId: string; kind: Opening['kind']; offset: number },
  camera: PlanCamera,
): void {
  const wall = project.floor.walls.find((item) => item.id === preview.wallId);
  if (!wall) return;
  const segment = openingSegment(wall, {
    id: 'preview',
    wallId: wall.id,
    kind: preview.kind,
    offset: preview.offset,
    width: preview.kind === 'door' ? 0.9 : 1.4,
  });
  const a = worldToScreen(segment.a, camera);
  const b = worldToScreen(segment.b, camera);
  ctx.save();
  ctx.strokeStyle = alpha(preview.kind === 'door' ? COLORS.door : COLORS.window, 0.9);
  ctx.lineWidth = 4;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '600 10px "Avenir Next", "PingFang SC", sans-serif';
  ctx.fillStyle = 'rgba(40, 50, 45, 0.88)';
  const label = preview.kind === 'door' ? '门 · 0.9m' : '窗 · 1.4m';
  const tw = ctx.measureText(label).width + 14;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  roundRect(ctx, mid.x - tw / 2, mid.y - 28, tw, 18, 5);
  ctx.fill();
  ctx.fillStyle = '#fbf9f4';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, mid.x, mid.y - 19);
  ctx.restore();
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  project: Project,
  selection: Selection | null,
  camera: PlanCamera,
): void {
  if (!selection) return;
  if (selection.kind === 'wall') {
    const wall = project.floor.walls.find((item) => item.id === selection.id);
    if (!wall) return;
    const a = worldToScreen(wall.a, camera);
    const b = worldToScreen(wall.b, camera);
    ctx.save();
    ctx.strokeStyle = alpha(COLORS.accent, 0.65);
    ctx.lineWidth = Math.max(8, wall.thickness * camera.scale + 7);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }
  if (selection.kind === 'opening') {
    const opening = project.floor.openings.find((item) => item.id === selection.id);
    if (!opening) return;
    const wall = project.floor.walls.find((item) => item.id === opening.wallId);
    if (!wall) return;
    const segment = openingSegment(wall, opening);
    const a = worldToScreen(segment.a, camera);
    const b = worldToScreen(segment.b, camera);
    ctx.save();
    ctx.strokeStyle = alpha(COLORS.accent, 0.85);
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc((a.x + b.x) / 2, (a.y + b.y) / 2, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export function renderPlan(ctx: CanvasRenderingContext2D, options: RenderOptions): void {
  const { camera, now } = options;
  ctx.setTransform(camera.dpr, 0, 0, camera.dpr, 0, 0);
  ctx.clearRect(0, 0, camera.width, camera.height);
  drawGrid(ctx, camera);
  drawFloor(ctx, options.floor, camera);
  drawWalls(ctx, options.project, camera);
  drawOpenings(ctx, options.project, camera);
  drawSelection(ctx, options.project, options.selection, camera);

  if (options.preview.shape) drawShapePreview(ctx, options.preview.shape, camera, options.booleanMode);
  if (options.preview.wall) drawWallPreview(ctx, options.preview.wall, camera);
  if (options.preview.opening) drawOpeningPreview(ctx, options.project, options.preview.opening, camera);

  for (const furniture of options.project.furniture) {
    drawFurniture(ctx, furniture, camera, {
      selected: options.selection?.kind === 'furniture' && options.selection.id === furniture.id,
      hovered: options.hoverFurnitureId === furniture.id,
      highlighted: options.highlightId === furniture.id,
      now,
      showLabel:
        camera.scale > 46 ||
        options.selection?.id === furniture.id ||
        options.hoverFurnitureId === furniture.id ||
        options.highlightId === furniture.id,
    });
  }

  if (options.preview.furniture) {
    const ghost: Furniture = {
      id: 'ghost',
      kind: options.preview.furniture.kind,
      name: '',
      x: options.preview.furniture.x,
      y: options.preview.furniture.y,
      width: options.preview.furniture.width,
      depth: options.preview.furniture.depth,
      rotation: options.preview.furniture.rotation,
      color: options.preview.furniture.color,
      items: [],
    };
    ctx.save();
    ctx.globalAlpha = 0.5;
    const screen = worldToScreen(ghost, camera);
    ctx.translate(screen.x, screen.y);
    ctx.rotate(ghost.rotation);
    ctx.scale(camera.scale, camera.scale);
    drawFurnitureShape(ctx, ghost);
    ctx.restore();
  }

  if (options.highlightId) {
    const furniture = options.project.furniture.find((item) => item.id === options.highlightId);
    if (furniture && options.highlightName) {
      const screen = worldToScreen(furniture, camera);
      const label = options.highlightName;
      ctx.save();
      ctx.font = '600 11px "Avenir Next", "PingFang SC", sans-serif';
      const tw = ctx.measureText(label).width + 24;
      const x = screen.x - tw / 2;
      const y = screen.y - (furniture.depth / 2) * camera.scale - 32;
      ctx.fillStyle = COLORS.accent;
      roundRect(ctx, x, y, tw, 22, 6);
      ctx.fill();
      ctx.fillStyle = '#fffaf4';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, screen.x, y + 11.5);
      ctx.restore();
    }
  }
}

export function fitCamera(
  camera: PlanCamera,
  project: Project,
  width: number,
  height: number,
): PlanCamera {
  const floor = buildFloorGeometry(project.floor.shapes);
  let minX = floor.bounds.minX;
  let minY = floor.bounds.minY;
  let maxX = floor.bounds.maxX;
  let maxY = floor.bounds.maxY;
  if (floor.polygons.length === 0) {
    minX = 0;
    minY = 0;
    maxX = 8;
    maxY = 6;
  }
  for (const furniture of project.furniture) {
    minX = Math.min(minX, furniture.x - furniture.width / 2);
    minY = Math.min(minY, furniture.y - furniture.depth / 2);
    maxX = Math.max(maxX, furniture.x + furniture.width / 2);
    maxY = Math.max(maxY, furniture.y + furniture.depth / 2);
  }
  const padding = 74;
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.max(18, Math.min(210, Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY)));
  return {
    ...camera,
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    scale,
    width,
    height,
  };
}

export function wallLengthLabel(wall: Wall): string {
  return `${wallLength(wall).toFixed(2)} m`;
}

export function wallSolidIntervals(wall: Wall, openings: Opening[]): { start: number; end: number }[] {
  const length = wallLength(wall);
  const cuts = new Set<number>([0, length]);
  for (const opening of openings) {
    const center = opening.offset * length;
    const half = Math.min(opening.width, length) / 2;
    cuts.add(Math.max(0, center - half));
    cuts.add(Math.min(length, center + half));
  }
  const ordered = [...cuts].sort((a, b) => a - b);
  return ordered.slice(0, -1).map((start, index) => ({ start, end: ordered[index + 1] }));
}

export function solidSpansFor(
  wall: Wall,
  openings: Opening[],
  wallHeight = 2.8,
): { start: number; end: number; spans: { bottom: number; top: number }[] }[] {
  return wallSolidIntervals(wall, openings).map((interval) => {
    const active = openings
      .map((opening) => {
        const center = opening.offset * wallLength(wall);
        const half = Math.min(opening.width, wallLength(wall)) / 2;
        return { kind: opening.kind, start: center - half, end: center + half };
      })
      .filter((opening) => opening.start < interval.end - 1e-5 && opening.end > interval.start + 1e-5);
    return {
      ...interval,
      spans: solidWallSpans(active, wallHeight),
    };
  });
}
