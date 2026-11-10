<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from './AppIcon.vue';
import {
  activeHouse,
  createHouse,
  state,
  selectHouse,
} from '../stores/workspace';

const open = ref(false);
const root = ref<HTMLDivElement | null>(null);

const totalFloors = computed(() =>
  state.workspace.houses.reduce((sum, house) => sum + house.floors.length, 0),
);

function summary(houseId: string): string {
  const house = state.workspace.houses.find((item) => item.id === houseId);
  if (!house) return '';
  const furniture = house.floors.reduce((sum, floor) => sum + floor.furniture.length, 0);
  return `${house.floors.length} 层 · ${furniture} 件家具`;
}

function choose(id: string): void {
  selectHouse(id);
  open.value = false;
}

function addHouse(): void {
  createHouse('新的家');
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
  <div ref="root" class="house-menu">
    <button class="house-trigger" :class="{ open }" title="我的房子" @click.stop="open = !open">
      <span class="house-icon"><AppIcon name="home" :size="16" /></span>
      <span class="house-trigger-text">
        <span class="house-trigger-label">我的房子</span>
        <b>{{ activeHouse.name }}</b>
      </span>
      <span class="house-count">{{ activeHouse.floors.length }}层</span>
      <AppIcon name="chevron-down" :size="13" />
    </button>

    <div v-if="open" class="house-dropdown">
        <header>
          <div>
            <span class="eyebrow">My houses</span>
            <h3>我的房子</h3>
          </div>
          <span class="house-total">{{ state.workspace.houses.length }} 栋 · {{ totalFloors }} 层</span>
        </header>

        <div class="house-list">
          <button
            v-for="house in state.workspace.houses"
            :key="house.id"
            class="house-option"
            :class="{ active: house.id === state.activeHouseId }"
            @click="choose(house.id)"
          >
            <span class="option-icon"><AppIcon name="home" :size="18" /></span>
            <span class="option-main">
              <b>{{ house.name }}</b>
              <em>{{ summary(house.id) }}</em>
            </span>
            <span v-if="house.id === state.activeHouseId" class="option-check">
              <AppIcon name="check" :size="14" />
            </span>
            <span v-else class="option-arrow"><AppIcon name="arrow-right" :size="13" /></span>
          </button>
        </div>

        <button class="house-add" @click="addHouse">
          <AppIcon name="plus" :size="15" />
          新建一栋房子
        </button>
        <p class="house-hint">每栋房子可以有多个楼层，楼层在顶部切换。</p>
      </div>
  </div>
</template>

<style scoped>
.house-menu {
  position: relative;
}

.house-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  max-width: 205px;
  padding: 0 9px 0 6px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(255, 253, 248, 0.66);
  color: var(--ink);
  transition: all 160ms ease;
}

.house-trigger:hover,
.house-trigger.open {
  border-color: var(--line-strong);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.house-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 27px;
  height: 27px;
  flex-shrink: 0;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent-deep);
}

.house-trigger-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.house-trigger-label {
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--muted);
  text-transform: uppercase;
}

.house-trigger-text b {
  max-width: 118px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-serif);
  font-size: 11.5px;
  font-weight: 600;
}

.house-count {
  height: 18px;
  padding: 0 5px;
  border-radius: 4px;
  background: rgba(40, 50, 45, 0.06);
  color: var(--muted);
  font-size: 8px;
  font-weight: 700;
  line-height: 18px;
  flex-shrink: 0;
}

.house-dropdown {
  position: absolute;
  top: calc(100% + 9px);
  right: 0;
  z-index: 40;
  width: 330px;
  padding: 14px;
  border-radius: 16px;
  background: var(--surface);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: var(--shadow-lg);
  transform-origin: top right;
}

.house-dropdown header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 2px 3px 10px;
}

.house-dropdown h3 {
  margin-top: 3px;
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 600;
}

.house-total {
  font-size: 8px;
  color: var(--muted);
  letter-spacing: 0.04em;
  padding-top: 2px;
}

.house-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.house-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px;
  border-radius: 10px;
  border: 1px solid transparent;
  text-align: left;
  transition: background 150ms ease, border-color 150ms ease;
}

.house-option:hover {
  background: rgba(40, 50, 45, 0.045);
}

.house-option.active {
  background: var(--accent-soft);
  border-color: rgba(196, 112, 73, 0.18);
}

.option-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 9px;
  background: rgba(40, 50, 45, 0.06);
  color: var(--ink-soft);
}

.house-option.active .option-icon {
  background: rgba(255, 253, 248, 0.65);
  color: var(--accent-deep);
}

.option-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.option-main b {
  font-size: 11.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-main em {
  font-style: normal;
  font-size: 8.5px;
  color: var(--muted);
}

.option-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent);
  color: #fffaf4;
}

.option-arrow {
  display: flex;
  color: var(--muted);
  opacity: 0;
  transition: opacity 150ms ease;
}

.house-option:hover .option-arrow {
  opacity: 1;
}

.house-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 36px;
  margin-top: 9px;
  border-radius: 9px;
  border: 1px dashed var(--line-strong);
  color: var(--ink-soft);
  font-size: 10px;
  font-weight: 600;
  transition: all 150ms ease;
}

.house-add:hover {
  border-color: var(--accent);
  color: var(--accent-deep);
  background: rgba(196, 112, 73, 0.05);
}

.house-hint {
  padding: 9px 3px 0;
  font-size: 8px;
  line-height: 1.6;
  color: #a1a7a0;
}

@media (max-width: 1380px) {
  .house-trigger-text {
    display: none;
  }
  .house-trigger {
    max-width: none;
  }
}
</style>
