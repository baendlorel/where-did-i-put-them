<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from './AppIcon.vue';
import {
  activeFloor,
  activeHouse,
  addFloor,
  deleteFloor,
  selectFloor,
  state,
} from '../stores/workspace';

const open = ref(false);
const root = ref<HTMLDivElement | null>(null);
const floors = computed(() => [...activeHouse.value.floors].sort((a, b) => b.level - a.level));

function choose(id: string): void {
  selectFloor(id);
  open.value = false;
}

function add(mode: 'blank' | 'copy'): void {
  addFloor(mode);
  open.value = false;
}

function removeCurrent(): void {
  deleteFloor(activeFloor.value.id);
  open.value = false;
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!open.value) return;
  if (root.value && !root.value.contains(event.target as Node)) open.value = false;
}

onMounted(() => document.addEventListener('pointerdown', handleDocumentPointerDown));
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleDocumentPointerDown));
</script>

<template>
  <div ref="root" class="floor-switcher">
    <span class="floor-label">Floors</span>
    <div class="floor-list">
      <button
        v-for="floor in floors"
        :key="floor.id"
        class="floor-chip"
        :class="{ active: floor.id === state.activeFloorId }"
        :title="`${floor.name} · ${floor.furniture.length} 件家具`"
        @click="choose(floor.id)"
      >
        {{ floor.name }}
      </button>
    </div>
    <button class="floor-plus" title="添加或管理楼层" @click.stop="open = !open">
      <AppIcon name="plus" :size="14" />
    </button>

    <div v-if="open" class="floor-popover">
        <header>
          <span class="eyebrow">Floors</span>
          <h3>{{ activeHouse.name }}</h3>
          <p>当前 {{ activeFloor.name }} · 共 {{ activeHouse.floors.length }} 层</p>
        </header>
        <button class="floor-action" @click="add('copy')">
          <span class="action-icon"><AppIcon name="layers" :size="16" /></span>
          <span><b>复制当前楼层结构</b><em>复制地面、墙体与门窗，不含家具</em></span>
        </button>
        <button class="floor-action" @click="add('blank')">
          <span class="action-icon"><AppIcon name="rect" :size="16" /></span>
          <span><b>新建空白楼层</b><em>从一张空画布开始布置</em></span>
        </button>
        <button
          v-if="activeHouse.floors.length > 1"
          class="floor-action danger"
          @click="removeCurrent"
        >
          <span class="action-icon"><AppIcon name="trash" :size="16" /></span>
          <span><b>删除 {{ activeFloor.name }}</b><em>楼层会重新编号，家具不会保留</em></span>
        </button>
      </div>
  </div>
</template>

<style scoped>
.floor-switcher {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 38px;
  padding: 3px 4px 3px 9px;
  border-radius: 10px;
  background: rgba(40, 50, 45, 0.045);
  border: 1px solid transparent;
}

.floor-label {
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--muted);
  margin-right: 2px;
}

.floor-list {
  display: flex;
  gap: 2px;
  max-width: 260px;
  overflow-x: auto;
  scrollbar-width: none;
}

.floor-list::-webkit-scrollbar {
  display: none;
}

.floor-chip {
  min-width: 31px;
  height: 28px;
  padding: 0 7px;
  border-radius: 6px;
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  transition: all 150ms ease;
}

.floor-chip:hover {
  background: rgba(255, 253, 248, 0.7);
  color: var(--ink-soft);
}

.floor-chip.active {
  background: var(--ink);
  color: #fbf9f4;
  box-shadow: 0 2px 6px rgba(40, 50, 45, 0.18);
}

.floor-plus {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: var(--muted);
  border: 1px dashed var(--line-strong);
  transition: all 150ms ease;
}

.floor-plus:hover {
  color: var(--accent-deep);
  border-color: var(--accent);
  background: rgba(196, 112, 73, 0.06);
}

.floor-popover {
  position: absolute;
  left: 50%;
  top: calc(100% + 9px);
  z-index: 40;
  width: 300px;
  padding: 14px;
  border-radius: 15px;
  transform: translateX(-50%);
  background: var(--surface);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: var(--shadow-lg);
}

.floor-popover header {
  padding: 2px 2px 10px;
}

.floor-popover h3 {
  margin: 3px 0 3px;
  font-family: var(--font-serif);
  font-size: 19px;
  font-weight: 600;
}

.floor-popover p {
  font-size: 9px;
  color: var(--muted);
}

.floor-action {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 8px;
  border-radius: 9px;
  text-align: left;
  transition: background 150ms ease;
}

.floor-action:hover {
  background: rgba(40, 50, 45, 0.05);
}

.action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent-deep);
}

.floor-action > span:last-child {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.floor-action b {
  font-size: 10.5px;
  font-weight: 600;
}

.floor-action em {
  font-style: normal;
  font-size: 8.5px;
  color: var(--muted);
}

.floor-action.danger {
  color: var(--danger);
  margin-top: 2px;
  border-top: 1px solid var(--line);
  border-radius: 0 0 9px 9px;
}

.floor-action.danger .action-icon {
  background: rgba(181, 87, 73, 0.1);
  color: var(--danger);
}

@media (max-width: 1400px) {
  .floor-label {
    display: none;
  }
  .floor-switcher {
    padding-left: 4px;
  }
}
</style>
