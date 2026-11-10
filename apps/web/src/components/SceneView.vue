<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import {
  clearHighlight,
  selectFurniture,
  state,
} from '../stores/workspace';
import { buildFloorGeometry } from '@shijian/shared';
import { createScene } from '../lib/three/SceneController';
import type { SceneController } from '../lib/three/SceneController';

const container = ref<HTMLDivElement | null>(null);
const cutaway = ref(true);
let scene: SceneController | null = null;
let rebuildTimer = 0;

const stats = computed(() => ({
  items: state.project.furniture.reduce((sum, f) => sum + f.items.length, 0),
  walls: state.project.floor.walls.length,
  area: `${buildFloorGeometry(state.project.floor.shapes).area.toFixed(1)}㎡`,
}));

function scheduleRebuild(): void {
  window.clearTimeout(rebuildTimer);
  rebuildTimer = window.setTimeout(() => {
    scene?.updateProject(state.project);
    scene?.setSelection(state.selection?.kind === 'furniture' ? state.selection.id : null);
  }, 140);
}

function syncSelection(): void {
  scene?.setSelection(state.selection?.kind === 'furniture' ? state.selection.id : null);
}

function syncHighlight(): void {
  if (state.highlight) {
    const furniture = state.project.furniture.find((item) => item.id === state.highlight?.furnitureId);
    scene?.setHighlight(state.highlight.furnitureId, state.highlight.itemName);
    if (furniture && state.focusRequest) scene?.focusOn(furniture.x, furniture.y, state.focusRequest.zoom);
  } else {
    scene?.setHighlight(null, '');
  }
}

onMounted(() => {
  if (!container.value) return;
  scene = createScene(container.value, {
    onPick: (id) => {
      if (id) {
        selectFurniture(id);
        clearHighlight();
      } else {
        selectFurniture(null);
      }
    },
  });
  scene.updateProject(state.project);
  scene.setCutaway(cutaway.value);
  syncSelection();
  syncHighlight();
  if (state.focusRequest) {
    scene.focusOn(state.focusRequest.x, state.focusRequest.y, state.focusRequest.zoom);
  }
});

watch(
  () => state.project.floor.shapes,
  () => scheduleRebuild(),
  { deep: true },
);
watch(
  () => state.project.floor.walls,
  () => scheduleRebuild(),
  { deep: true },
);
watch(
  () => state.project.floor.openings,
  () => scheduleRebuild(),
  { deep: true },
);
watch(
  () => state.project.furniture,
  () => scheduleRebuild(),
  { deep: true },
);

watch(() => state.selection, syncSelection, { deep: true });
watch(
  () => state.highlight,
  () => {
    syncHighlight();
  },
  { deep: true },
);
watch(
  () => state.focusRequest,
  (request) => {
    if (request) scene?.focusOn(request.x, request.y, request.zoom);
  },
);

onBeforeUnmount(() => {
  window.clearTimeout(rebuildTimer);
  scene?.dispose();
  scene = null;
});

function toggleCutaway(): void {
  cutaway.value = !cutaway.value;
  scene?.setCutaway(cutaway.value);
}
</script>

<template>
  <div class="scene-shell">
    <div ref="container" class="scene-canvas" />

    <div class="scene-hud">
      <div class="scene-eyebrow">
        <span class="live-dot" />
        立体视图 · 实时建模
      </div>
      <h2>{{ state.project.name }}</h2>
      <div class="scene-metrics">
        <span><b>{{ stats.area }}</b> 面积</span>
        <span><b>{{ stats.walls }}</b> 墙体</span>
        <span><b>{{ stats.items }}</b> 类物品</span>
      </div>
    </div>

    <div class="scene-actions">
      <button class="scene-control" title="适应视野" @click="scene?.resetView()">
        <AppIcon name="fit" :size="18" />
      </button>
      <button class="scene-control" title="俯视" @click="scene?.topView()">
        <AppIcon name="layers" :size="18" />
      </button>
      <button class="scene-control" :class="{ active: cutaway }" title="剖切近处外墙" @click="toggleCutaway">
        <AppIcon name="wall" :size="18" />
      </button>
    </div>

    <div class="scene-tip">
      <AppIcon name="cursor" :size="13" />
      拖动旋转 · 滚轮缩放 · 点击家具查看物品
    </div>

    <div v-if="state.highlight" class="locate-chip">
      <AppIcon name="pin" :size="14" />
      <span>正在定位「{{ state.highlight.itemName }}」</span>
      <button @click="clearHighlight"><AppIcon name="close" :size="13" /></button>
    </div>

    <div class="scene-vignette" />
  </div>
</template>

<style scoped>
.scene-shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #dfe6dc;
}

.scene-canvas {
  position: absolute;
  inset: 0;
}

.scene-canvas :deep(canvas) {
  display: block;
}

.scene-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(27, 38, 30, 0.34), transparent 22%, transparent 78%, rgba(27, 38, 30, 0.28)),
    radial-gradient(circle at 50% 42%, transparent 42%, rgba(49, 61, 51, 0.16) 100%);
}

.scene-hud {
  position: absolute;
  top: 20px;
  left: 22px;
  z-index: 2;
  padding: 12px 16px 14px;
  border-radius: 14px;
  color: #f6f1e7;
  pointer-events: none;
  text-shadow: 0 1px 10px rgba(27, 36, 30, 0.3);
  background: linear-gradient(135deg, rgba(28, 39, 31, 0.62), rgba(28, 39, 31, 0.24));
  border: 1px solid rgba(255, 255, 255, 0.13);
  backdrop-filter: blur(12px);
  box-shadow: 0 10px 30px rgba(25, 34, 27, 0.13);
}

.scene-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.78;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d6a06f;
  box-shadow: 0 0 0 4px rgba(214, 160, 111, 0.18);
  animation: live 2.6s infinite;
}

@keyframes live {
  0%,
  100% {
    box-shadow: 0 0 0 3px rgba(214, 160, 111, 0.14);
  }
  50% {
    box-shadow: 0 0 0 7px rgba(214, 160, 111, 0);
  }
}

.scene-hud h2 {
  margin: 7px 0 10px;
  font-family: var(--font-serif);
  font-size: clamp(24px, 2.4vw, 34px);
  font-weight: 600;
  letter-spacing: 0.01em;
}

.scene-metrics {
  display: flex;
  gap: 7px;
}

.scene-metrics span {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  height: 25px;
  padding: 0 9px;
  border-radius: 6px;
  background: rgba(28, 38, 31, 0.34);
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(10px);
  font-size: 9px;
  letter-spacing: 0.04em;
  color: rgba(245, 240, 230, 0.72);
}

.scene-metrics b {
  font-size: 11px;
  color: #f6f1e7;
}

.scene-actions {
  position: absolute;
  right: 22px;
  top: 22px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 5px;
  border-radius: 11px;
  background: rgba(27, 37, 30, 0.34);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
}

.scene-control {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  color: rgba(247, 242, 232, 0.82);
  transition: background 160ms ease, color 160ms ease;
}

.scene-control:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fffdf7;
}

.scene-control.active {
  background: rgba(196, 112, 73, 0.82);
  color: #fff9f1;
}

.scene-tip {
  position: absolute;
  left: 24px;
  bottom: 24px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 7px;
  height: 31px;
  padding: 0 12px;
  border-radius: 8px;
  background: rgba(27, 37, 30, 0.32);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  color: rgba(246, 241, 231, 0.75);
  font-size: 10px;
  letter-spacing: 0.02em;
  pointer-events: none;
}

.locate-chip {
  position: absolute;
  left: 50%;
  bottom: 26px;
  z-index: 2;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 9px;
  height: 38px;
  padding: 0 8px 0 13px;
  border-radius: 20px;
  background: rgba(251, 249, 244, 0.94);
  color: var(--ink);
  box-shadow: var(--shadow-md);
  font-size: 11px;
  backdrop-filter: blur(12px);
}

.locate-chip > :first-child {
  color: var(--accent);
}

.locate-chip button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  color: var(--muted);
}

.locate-chip button:hover {
  background: rgba(40, 50, 45, 0.08);
}
</style>
