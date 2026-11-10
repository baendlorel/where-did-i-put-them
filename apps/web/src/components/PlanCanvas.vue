<script setup lang="ts">
import {
  FURNITURE_CATALOG,
  buildFloorGeometry,
  clamp,
  distance,
  snap,
} from '@shijian/shared';
import type { ShapeKind, Vec2 } from '@shijian/shared';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import {
  addFurniture,
  addOpening,
  addShape,
  addWall,
  clearHighlight,
  findWallAt,
  moveFurniture,
  pushToast,
  requestSyncNow,
  selectedFurniture,
  setTool,
  state,
} from '../stores/workspace';
import {
  fitCamera,
  hitFurniture,
  hitOpening,
  hitWall,
  renderPlan,
  screenToWorld,
} from '../lib/plan';
import type { PlanCamera, Preview } from '../lib/plan';

const container = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const camera = reactive<PlanCamera>({ x: 5, y: 3.5, scale: 80, width: 0, height: 0, dpr: 1 });
const preview = reactive<Preview>({});
const mouse = ref<Vec2 | null>(null);
const hoverFurnitureId = ref<string | null>(null);
const spacePanning = ref(false);
const dragging = ref(false);
const fitted = ref(false);

const floor = computed(() => buildFloorGeometry(state.project.floor.shapes));
const stats = computed(() => ({
  area: floor.value.area,
  items: state.project.furniture.reduce((sum, f) => sum + f.items.length, 0),
}));
const activeFurnitureLabel = computed(() => {
  if (state.tool in FURNITURE_CATALOG) {
    return FURNITURE_CATALOG[state.tool as keyof typeof FURNITURE_CATALOG].label;
  }
  return '';
});

type Interaction =
  | { type: 'pan'; startX: number; startY: number; cameraX: number; cameraY: number; moved: boolean }
  | { type: 'shape'; start: Vec2; current: Vec2; shift: boolean }
  | { type: 'wall'; start: Vec2; current: Vec2; shift: boolean }
  | { type: 'move'; id: string; offset: Vec2; moved: boolean };

let interaction: Interaction | null = null;
let raf = 0;
let resizeObserver: ResizeObserver | null = null;
let cameraTween:
  | { start: number; from: { x: number; y: number; scale: number }; to: { x: number; y: number; scale: number } }
  | null = null;

const isDrawingTool = computed(() =>
  ['rect', 'ellipse', 'wall'].includes(state.tool),
);

function canvasPoint(event: PointerEvent | WheelEvent): Vec2 {
  const rect = canvas.value!.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function worldPoint(event: PointerEvent | WheelEvent): Vec2 {
  return screenToWorld(canvasPoint(event), camera);
}

function snapPoint(point: Vec2, step = 0.05): Vec2 {
  return { x: snap(point.x, step), y: snap(point.y, step) };
}

function nearestWallEndpoint(point: Vec2, threshold = 0.25): Vec2 | null {
  let best: { point: Vec2; dist: number } | null = null;
  for (const wall of state.project.floor.walls) {
    for (const candidate of [wall.a, wall.b]) {
      const dist = distance(point, candidate);
      if (dist <= threshold && (!best || dist < best.dist)) best = { point: candidate, dist };
    }
  }
  return best?.point ?? null;
}

function constrainAngle(start: Vec2, point: Vec2, stepDeg = 15): Vec2 {
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return point;
  const step = (stepDeg * Math.PI) / 180;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length };
}

function clearPreview(): void {
  preview.shape = undefined;
  preview.wall = undefined;
  preview.opening = undefined;
  preview.furniture = undefined;
}

function updateHover(world: Vec2): void {
  if (state.tool !== 'select') {
    hoverFurnitureId.value = null;
    return;
  }
  hoverFurnitureId.value = hitFurniture(state.project, world)?.id ?? null;
}

function updateOpeningPreview(world: Vec2): void {
  const found = findWallAt(world);
  if (found) {
    preview.opening = {
      wallId: found.wall.id,
      kind: state.tool === 'door' ? 'door' : 'window',
      offset: found.offset,
    };
  } else {
    preview.opening = undefined;
  }
}

function updateShapePreview(current: Vec2, shift: boolean): void {
  if (!interaction || interaction.type !== 'shape') return;
  const start = interaction.start;
  let dx = current.x - start.x;
  let dy = current.y - start.y;
  if (shift) {
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * size;
    dy = Math.sign(dy || 1) * size;
  }
  preview.shape = {
    kind: (state.tool === 'ellipse' ? 'ellipse' : 'rect') as ShapeKind,
    x: Math.min(start.x, start.x + dx),
    y: Math.min(start.y, start.y + dy),
    width: Math.abs(dx),
    height: Math.abs(dy),
  };
}

function startPan(event: PointerEvent, point: Vec2): void {
  interaction = {
    type: 'pan',
    startX: point.x,
    startY: point.y,
    cameraX: camera.x,
    cameraY: camera.y,
    moved: false,
  };
  dragging.value = true;
  canvas.value?.setPointerCapture(event.pointerId);
}

function handlePointerDown(event: PointerEvent): void {
  const canvasEl = canvas.value;
  if (!canvasEl) return;
  const point = canvasPoint(event);
  const world = screenToWorld(point, camera);

  if (event.button === 1 || event.button === 2 || spacePanning.value) {
    event.preventDefault();
    startPan(event, point);
    return;
  }
  if (event.button !== 0) return;

  if (state.tool === 'select') {
    const furniture = hitFurniture(state.project, world);
    if (furniture) {
      state.selection = { kind: 'furniture', id: furniture.id };
      clearHighlight();
      interaction = {
        type: 'move',
        id: furniture.id,
        offset: { x: world.x - furniture.x, y: world.y - furniture.y },
        moved: false,
      };
      dragging.value = true;
      canvasEl.setPointerCapture(event.pointerId);
      return;
    }
    const opening = hitOpening(state.project, world);
    if (opening) {
      state.selection = { kind: 'opening', id: opening.id };
      clearHighlight();
      startPan(event, point);
      return;
    }
    const wall = hitWall(state.project, world);
    if (wall) {
      state.selection = { kind: 'wall', id: wall.id };
      clearHighlight();
      startPan(event, point);
      return;
    }
    state.selection = null;
    clearHighlight();
    startPan(event, point);
    return;
  }

  if (state.tool === 'rect' || state.tool === 'ellipse') {
    const start = snapPoint(world);
    interaction = { type: 'shape', start, current: start, shift: event.shiftKey };
    preview.shape = { kind: state.tool, x: start.x, y: start.y, width: 0, height: 0 };
    dragging.value = true;
    canvasEl.setPointerCapture(event.pointerId);
    return;
  }

  if (state.tool === 'wall') {
    const snapped = snapPoint(world);
    const start = nearestWallEndpoint(snapped) ?? snapped;
    interaction = { type: 'wall', start, current: start, shift: event.shiftKey };
    preview.wall = { a: start, b: start };
    dragging.value = true;
    canvasEl.setPointerCapture(event.pointerId);
    return;
  }

  if (state.tool === 'door' || state.tool === 'window') {
    const found = findWallAt(world);
    if (!found) {
      pushToast('请点击已有墙体来放置门窗', 'warn');
      return;
    }
    addOpening(found.wall.id, state.tool, found.offset);
    return;
  }

  if (['sofa', 'table', 'bed', 'cabinet', 'nightstand'].includes(state.tool)) {
    const position = snapPoint(world, 0.1);
    addFurniture(state.tool as keyof typeof FURNITURE_CATALOG, position.x, position.y);
    clearPreview();
  }
}

function handlePointerMove(event: PointerEvent): void {
  const point = canvasPoint(event);
  const world = screenToWorld(point, camera);
  mouse.value = world;

  if (!interaction) {
    updateHover(world);
    if (state.tool === 'door' || state.tool === 'window') updateOpeningPreview(world);
    if (['sofa', 'table', 'bed', 'cabinet', 'nightstand'].includes(state.tool)) {
      const kind = state.tool as keyof typeof FURNITURE_CATALOG;
      const spec = FURNITURE_CATALOG[kind];
      preview.furniture = {
        kind,
        x: snap(world.x, 0.1),
        y: snap(world.y, 0.1),
        width: spec.width,
        depth: spec.depth,
        rotation: 0,
        color: spec.color,
      };
    } else if (state.tool !== 'door' && state.tool !== 'window') {
      preview.furniture = undefined;
    }
    return;
  }

  if (interaction.type === 'pan') {
    const dx = point.x - interaction.startX;
    const dy = point.y - interaction.startY;
    if (Math.abs(dx) + Math.abs(dy) > 2) interaction.moved = true;
    camera.x = interaction.cameraX - dx / camera.scale;
    camera.y = interaction.cameraY - dy / camera.scale;
    return;
  }

  if (interaction.type === 'shape') {
    interaction.current = snapPoint(world);
    interaction.shift = event.shiftKey;
    updateShapePreview(interaction.current, event.shiftKey);
    return;
  }

  if (interaction.type === 'wall') {
    let end = snapPoint(world);
    const endpoint = nearestWallEndpoint(end, 0.25);
    if (endpoint) end = endpoint;
    if (event.shiftKey) end = constrainAngle(interaction.start, end);
    interaction.current = end;
    interaction.shift = event.shiftKey;
    preview.wall = { a: interaction.start, b: end };
    return;
  }

  if (interaction.type === 'move') {
    const target = {
      x: snap(world.x - interaction.offset.x, 0.05),
      y: snap(world.y - interaction.offset.y, 0.05),
    };
    const furniture = selectedFurniture.value;
    if (furniture) {
      interaction.moved = true;
      moveFurniture(furniture.id, target.x, target.y);
    }
  }
}

function finishInteraction(event: PointerEvent): void {
  if (!interaction) return;
  const active = interaction;
  interaction = null;
  dragging.value = false;
  try {
    canvas.value?.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture may already be released.
  }

  if (active.type === 'shape') {
    const shape = preview.shape;
    if (shape && shape.width >= 0.1 && shape.height >= 0.1) {
      addShape({
        kind: shape.kind,
        x: snap(shape.x, 0.05),
        y: snap(shape.y, 0.05),
        width: snap(shape.width, 0.05),
        height: snap(shape.height, 0.05),
      });
    }
    clearPreview();
    return;
  }

  if (active.type === 'wall') {
    if (distance(active.start, active.current) >= 0.2) {
      addWall(active.start, active.current);
    }
    clearPreview();
    return;
  }

  if (active.type === 'move' && active.moved) {
    requestSyncNow();
  }
  if (active.type === 'pan' && !active.moved) {
    updateHover(screenToWorld(canvasPoint(event), camera));
  }
}

function handlePointerLeave(): void {
  if (!interaction) {
    mouse.value = null;
    hoverFurnitureId.value = null;
    preview.furniture = undefined;
    preview.opening = undefined;
  }
}

function handleWheel(event: WheelEvent): void {
  event.preventDefault();
  const point = canvasPoint(event);
  const before = screenToWorld(point, camera);
  const factor = Math.exp(-event.deltaY * 0.0014);
  const scale = clamp(camera.scale * factor, 18, 280);
  camera.scale = scale;
  const after = screenToWorld(point, camera);
  camera.x += before.x - after.x;
  camera.y += before.y - after.y;
  state.zoom = scale;
}

function zoomBy(factor: number): void {
  const before = { x: camera.x, y: camera.y };
  camera.scale = clamp(camera.scale * factor, 18, 280);
  camera.x = before.x;
  camera.y = before.y;
  state.zoom = camera.scale;
}

function fitToView(): void {
  const result = fitCamera(camera, state.project, camera.width, camera.height);
  camera.x = result.x;
  camera.y = result.y;
  camera.scale = result.scale;
  state.zoom = result.scale;
}

function focusOn(x: number, y: number, zoom?: number): void {
  cameraTween = {
    start: performance.now(),
    from: { x: camera.x, y: camera.y, scale: camera.scale },
    to: {
      x,
      y,
      scale: clamp(zoom ?? Math.max(camera.scale, 100), 40, 220),
    },
  };
}

function tickCamera(now: number): void {
  if (!cameraTween) return;
  const t = clamp((now - cameraTween.start) / 480, 0, 1);
  const eased = 1 - Math.pow(1 - t, 3);
  camera.x = cameraTween.from.x + (cameraTween.to.x - cameraTween.from.x) * eased;
  camera.y = cameraTween.from.y + (cameraTween.to.y - cameraTween.from.y) * eased;
  camera.scale = cameraTween.from.scale + (cameraTween.to.scale - cameraTween.from.scale) * eased;
  state.zoom = camera.scale;
  if (t >= 1) cameraTween = null;
}

function resize(): void {
  const element = container.value;
  const canvasEl = canvas.value;
  if (!element || !canvasEl) return;
  const rect = element.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  camera.width = rect.width;
  camera.height = rect.height;
  camera.dpr = dpr;
  canvasEl.width = Math.round(rect.width * dpr);
  canvasEl.height = Math.round(rect.height * dpr);
  canvasEl.style.width = `${rect.width}px`;
  canvasEl.style.height = `${rect.height}px`;
  if (!fitted.value && rect.width > 10) {
    fitted.value = true;
    fitToView();
    if (state.focusRequest) {
      focusOn(state.focusRequest.x, state.focusRequest.y, state.focusRequest.zoom);
    }
  }
}

function frame(now: number): void {
  tickCamera(now);
  const ctx = canvas.value?.getContext('2d');
  if (ctx) {
    renderPlan(ctx, {
      project: state.project,
      camera,
      floor: floor.value,
      now,
      selection: state.selection,
      highlightId: state.highlight?.furnitureId ?? null,
      highlightName: state.highlight?.itemName ?? '',
      hoverFurnitureId: hoverFurnitureId.value,
      preview,
      tool: state.tool,
      booleanMode: state.booleanMode,
      mouse: mouse.value,
      spacePanning: spacePanning.value,
    });
  }
  raf = requestAnimationFrame(frame);
}

function cancelDrawing(): void {
  interaction = null;
  dragging.value = false;
  clearPreview();
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.code === 'Space' && !isTyping(event)) {
    spacePanning.value = true;
    event.preventDefault();
  }
  if (event.key === 'Escape') cancelDrawing();
}

function onKeyUp(event: KeyboardEvent): void {
  if (event.code === 'Space') spacePanning.value = false;
}

function isTyping(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return Boolean(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable));
}

watch(
  () => state.focusRequest,
  (request) => {
    if (!request) return;
    focusOn(request.x, request.y, request.zoom);
  },
);

watch(
  () => state.tool,
  () => {
    cancelDrawing();
    hoverFurnitureId.value = null;
    if (state.tool !== 'select') state.selection = null;
  },
);

watch(
  () => state.project.floor.shapes.length,
  () => {
    // A shape edit changes the floor silhouette; repaint happens in the loop.
  },
);

onMounted(() => {
  resizeObserver = new ResizeObserver(resize);
  if (container.value) resizeObserver.observe(container.value);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('shijian:fit', fitToView);
  requestAnimationFrame(frame);
  requestAnimationFrame(resize);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  resizeObserver?.disconnect();
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  window.removeEventListener('shijian:fit', fitToView);
});
</script>

<template>
  <div
    ref="container"
    class="plan-shell"
    :class="{
      'is-drawing': isDrawingTool,
      'is-grabbing': dragging,
      'is-panning': spacePanning,
    }"
  >
    <canvas
      ref="canvas"
      class="plan-canvas"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="finishInteraction"
      @pointercancel="finishInteraction"
      @pointerleave="handlePointerLeave"
      @wheel="handleWheel"
      @contextmenu.prevent
    />

    <div class="plan-hud hud-top">
      <div class="hud-block">
        <span class="eyebrow">平面工作台</span>
        <strong>{{ stats.area.toFixed(1) }}<small>㎡</small></strong>
      </div>
      <span class="hud-divider" />
      <div class="hud-meta">
        <div><span>{{ state.project.floor.walls.length }}</span> 面墙</div>
        <div><span>{{ state.project.furniture.length }}</span> 件家具</div>
        <div><span>{{ stats.items }}</span> 类物品</div>
      </div>
    </div>

    <div v-if="state.tool !== 'select'" class="tool-tip">
      <span class="tool-dot" />
      <template v-if="state.tool === 'rect' || state.tool === 'ellipse'">
        按住拖动绘制{{ state.tool === 'rect' ? '矩形' : '椭圆' }} · {{ state.booleanMode === 'union' ? '融合' : '挖除' }}
      </template>
      <template v-else-if="state.tool === 'wall'">按住拖动绘制墙体 · 按住 Shift 锁定角度</template>
      <template v-else-if="state.tool === 'door'">点击墙体放置门</template>
      <template v-else-if="state.tool === 'window'">点击墙体放置窗</template>
      <template v-else>点击画布放置{{ activeFurnitureLabel }}</template>
    </div>

    <div class="plan-legend">
      <span><i class="legend-wall" />墙体</span>
      <span><i class="legend-door" />门</span>
      <span><i class="legend-window" />窗</span>
    </div>

    <div class="plan-controls">
      <button class="canvas-control" title="放大" @click="zoomBy(1.25)">
        <AppIcon name="plus" :size="17" />
      </button>
      <button class="canvas-control" title="适应画布" @click="fitToView">
        <AppIcon name="fit" :size="17" />
      </button>
      <button class="canvas-control" title="缩小" @click="zoomBy(0.8)">
        <AppIcon name="zoom-out" :size="17" />
      </button>
      <span class="zoom-readout">{{ Math.round(state.zoom) }} px/m</span>
    </div>

    <div v-if="state.project.floor.shapes.length === 0 && !preview.shape" class="empty-stage">
      <div class="empty-mark"><AppIcon name="rect" :size="27" /></div>
      <h2>从一块地面开始</h2>
      <p>用矩形或椭圆勾勒宅邸轮廓。重叠的图形会融合，切换「差集」可以挖出天井、凹口或走廊。</p>
      <div class="empty-actions">
        <button class="primary-btn accent" @click="setTool('rect')">画矩形</button>
        <button class="ghost-btn" @click="setTool('ellipse')">画椭圆</button>
      </div>
    </div>

    <div class="coords-readout">
      <AppIcon name="cursor" :size="12" />
      <span v-if="mouse">X {{ mouse.x.toFixed(2) }} · Y {{ mouse.y.toFixed(2) }}</span>
      <span v-else>X — · Y —</span>
    </div>
  </div>
</template>

<style scoped>
.plan-shell {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: #eee8dc;
  user-select: none;
  touch-action: none;
}

.plan-canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: default;
}

.plan-shell.is-drawing .plan-canvas {
  cursor: crosshair;
}

.plan-shell.is-grabbing .plan-canvas {
  cursor: grabbing;
}

.plan-shell.is-panning .plan-canvas {
  cursor: grab;
}

.plan-hud {
  position: absolute;
  top: 20px;
  left: 22px;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 11px 16px;
  border-radius: 12px;
  background: rgba(251, 249, 244, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(14px);
  pointer-events: none;
}

.hud-block {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.hud-block strong {
  font-family: var(--font-serif);
  font-size: 24px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.02em;
}

.hud-block strong small {
  margin-left: 2px;
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  color: var(--muted);
}

.hud-divider {
  width: 1px;
  align-self: stretch;
  background: var(--line);
}

.hud-meta {
  display: flex;
  gap: 14px;
  font-size: 10px;
  color: var(--muted);
}

.hud-meta div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hud-meta span {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}

.tool-tip {
  position: absolute;
  left: 50%;
  top: 20px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 13px;
  border-radius: 20px;
  background: rgba(40, 50, 45, 0.9);
  color: #f7f2e9;
  font-size: 11px;
  letter-spacing: 0.01em;
  box-shadow: var(--shadow-sm);
  pointer-events: none;
  white-space: nowrap;
  backdrop-filter: blur(8px);
}

.tool-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #d98c66;
  box-shadow: 0 0 0 3px rgba(217, 140, 102, 0.18);
}

.plan-legend {
  position: absolute;
  left: 22px;
  bottom: 22px;
  display: flex;
  align-items: center;
  gap: 14px;
  height: 34px;
  padding: 0 13px;
  border-radius: 9px;
  background: rgba(251, 249, 244, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.55);
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(10px);
  font-size: 10px;
  color: var(--ink-soft);
  pointer-events: none;
}

.plan-legend span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.plan-legend i {
  display: inline-block;
  width: 16px;
  height: 3px;
  border-radius: 2px;
}

.legend-wall {
  background: #2e3933;
  height: 4px !important;
}

.legend-door {
  background: #b76b46;
  height: 5px !important;
}

.legend-window {
  background: repeating-linear-gradient(90deg, #5d8d96 0 3px, transparent 3px 6px);
  height: 4px !important;
}

.plan-controls {
  position: absolute;
  right: 22px;
  bottom: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 5px;
  border-radius: 11px;
  background: rgba(251, 249, 244, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(12px);
}

.canvas-control {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  color: var(--ink-soft);
  transition: background 150ms ease;
}

.canvas-control:hover {
  background: rgba(40, 50, 45, 0.08);
  color: var(--ink);
}

.zoom-readout {
  padding: 4px 1px 7px;
  font-size: 8px;
  letter-spacing: 0.04em;
  color: var(--muted);
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.coords-readout {
  position: absolute;
  right: 78px;
  bottom: 28px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  font-variant-numeric: tabular-nums;
  color: rgba(40, 50, 45, 0.55);
  pointer-events: none;
}

.empty-stage {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(370px, 70%);
  transform: translate(-50%, -50%);
  text-align: center;
  padding: 28px;
  border-radius: 18px;
  background: rgba(251, 249, 244, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(12px);
}

.empty-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin: 0 auto 15px;
  border-radius: 14px;
  background: var(--accent-soft);
  color: var(--accent-deep);
}

.empty-stage h2 {
  font-family: var(--font-serif);
  font-size: 24px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.empty-stage p {
  margin: 9px auto 18px;
  max-width: 290px;
  font-size: 12px;
  line-height: 1.75;
  color: var(--ink-soft);
}

.empty-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
}
</style>
