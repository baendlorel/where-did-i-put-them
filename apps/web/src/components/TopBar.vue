<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';
import FloorSwitcher from './FloorSwitcher.vue';
import HouseMenu from './HouseMenu.vue';
import {
  activeHouse,
  createHouse,
  openSearch,
  redo,
  renameHouse,
  setView,
  state,
  toggleHelp,
  undo,
} from '../stores/workspace';

const isMac = computed(() => /Mac|iPhone|iPad/.test(navigator.platform));
const syncLabel = computed(() => {
  switch (state.sync) {
    case 'saved':
      return '已同步';
    case 'saving':
      return '保存中';
    case 'connecting':
      return '连接中';
    case 'offline':
      return '仅本机';
    case 'error':
      return '同步异常';
    default:
      return '同步';
  }
});

function renameProject(event: Event): void {
  const target = event.target as HTMLInputElement;
  const name = target.value.trim();
  if (!name) {
    target.value = activeHouse.value.name;
    return;
  }
  if (name === activeHouse.value.name) return;
  renameHouse(name);
}

function addHouse(): void {
  createHouse('新的家');
}
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <div class="brand-mark">
        <svg viewBox="0 0 34 34" width="34" height="34" fill="none" aria-hidden="true">
          <rect x="0.75" y="0.75" width="32.5" height="32.5" rx="9" fill="#2e3933" />
          <path d="M9.5 14.4 17 8.8l7.5 5.6v11.4H9.5Z" stroke="#f1e8d9" stroke-width="1.4" />
          <path d="M14.2 25.8v-6.1h5.6v6.1" stroke="#c47049" stroke-width="1.4" />
          <circle cx="17" cy="13.3" r="1.15" fill="#c47049" />
        </svg>
      </div>
      <div class="wordmark">
        <strong class="serif">拾间</strong>
        <span>NOOK ARCHIVE</span>
      </div>
    </div>

    <div class="project-block">
      <span class="project-eyebrow">当前住宅</span>
      <input
        class="project-name"
        :value="activeHouse.name"
        maxlength="120"
        spellcheck="false"
        aria-label="住宅名称"
        @change="renameProject"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
    </div>

    <div class="topbar-center">
      <FloorSwitcher />
      <span class="center-divider" />
      <div class="view-switch" role="group" aria-label="视图模式">
        <button
          :class="{ active: state.view === '2d' }"
          title="平面模式"
          @click="setView('2d')"
        >
          <AppIcon name="2d" :size="16" />
          <span>平面</span>
        </button>
        <button
          :class="{ active: state.view === '3d' }"
          title="立体模式"
          @click="setView('3d')"
        >
          <AppIcon name="3d" :size="16" />
          <span>立体</span>
        </button>
      </div>
    </div>

    <div class="top-actions">
      <div class="history-group">
        <button class="icon-btn" title="新建一栋房子（可撤销）" @click="addHouse">
          <AppIcon name="plus" :size="17" />
        </button>
        <button
          class="icon-btn"
          title="撤销（Ctrl/⌘ + Z）"
          :disabled="state.undoDepth === 0"
          @click="undo"
        >
          <AppIcon name="undo" :size="17" />
        </button>
        <button
          class="icon-btn"
          title="重做（Ctrl/⌘ + Shift + Z）"
          :disabled="state.redoDepth === 0"
          @click="redo"
        >
          <AppIcon name="redo" :size="17" />
        </button>
      </div>

      <button class="search-trigger" title="全局查找物品" @click="openSearch">
        <AppIcon name="search" :size="16" />
        <span>找东西</span>
        <span class="search-key">{{ isMac ? '⌘' : 'Ctrl' }} K</span>
      </button>

      <div class="sync-pill" :class="state.sync" :title="state.lastSavedAt ? `上次保存 ${new Date(state.lastSavedAt).toLocaleTimeString('zh-CN')}` : ''">
        <span class="sync-dot" />
        <span>{{ syncLabel }}</span>
      </div>

      <HouseMenu />

      <div class="presence" :title="state.clients > 1 ? `${state.clients} 个窗口正在协同` : '当前仅一个窗口'">
        <AppIcon name="users" :size="15" />
        <span>{{ state.clients }}</span>
      </div>

      <button class="icon-btn" title="使用说明与快捷键" @click="toggleHelp()">
        <AppIcon name="help" :size="17" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  height: 66px;
  padding: 0 18px 0 17px;
  gap: 20px;
  background: rgba(251, 249, 244, 0.94);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(16px);
  z-index: 6;
  position: relative;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.brand-mark {
  display: flex;
  box-shadow: 0 4px 12px rgba(40, 50, 45, 0.2);
  border-radius: 9px;
}

.wordmark {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.wordmark strong {
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.06em;
}

.wordmark span {
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--muted);
}

.project-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 160px;
  max-width: 280px;
  padding-left: 20px;
  border-left: 1px solid var(--line);
}

.project-eyebrow {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--muted);
}

.project-name {
  width: 100%;
  font-family: var(--font-serif);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.01em;
  border-bottom: 1px solid transparent;
  padding: 1px 0;
  transition: border-color 160ms ease;
}

.project-name:hover {
  border-bottom-color: var(--line);
}

.project-name:focus {
  border-bottom-color: var(--accent);
}

.topbar-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-width: 0;
}

.center-divider {
  width: 1px;
  height: 24px;
  background: var(--line);
  flex-shrink: 0;
}

.view-switch {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(40, 50, 45, 0.06);
}

.view-switch button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 31px;
  padding: 0 15px;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  transition: all 170ms ease;
}

.view-switch button:hover {
  color: var(--ink-soft);
}

.view-switch button.active {
  background: var(--surface-raised);
  color: var(--ink);
  box-shadow: 0 1px 4px rgba(40, 50, 45, 0.15);
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.history-group {
  display: flex;
  gap: 1px;
  padding-right: 9px;
  border-right: 1px solid var(--line);
}

.search-trigger {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 7px 0 11px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(255, 253, 248, 0.65);
  color: var(--ink-soft);
  font-size: 11px;
  font-weight: 600;
  transition: all 160ms ease;
}

.search-trigger:hover {
  border-color: var(--line-strong);
  background: var(--surface);
  color: var(--ink);
}

.search-key {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 6px;
  margin-left: 2px;
  border-radius: 4px;
  background: rgba(40, 50, 45, 0.055);
  color: var(--muted);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.sync-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 27px;
  padding: 0 9px;
  border-radius: 20px;
  background: var(--sage-soft);
  color: var(--sage-deep);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.sync-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.sync-pill.saving {
  background: #f1e7d4;
  color: #92733f;
}

.sync-pill.saving .sync-dot {
  animation: blink 900ms infinite;
}

.sync-pill.connecting {
  background: #e8e6dd;
  color: #77786f;
}

.sync-pill.offline {
  background: #f0e2dc;
  color: #9a5d49;
}

.sync-pill.error {
  background: #f3ddd8;
  color: var(--danger);
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

.presence {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 27px;
  padding: 0 8px;
  border-radius: 7px;
  color: var(--muted);
  border: 1px solid var(--line);
  font-size: 10px;
  font-weight: 600;
}

.presence:hover {
  color: var(--ink-soft);
}

@media (max-width: 1360px) {
  .project-block {
    display: none;
  }
}

@media (max-width: 1240px) {
  .search-trigger span:not(.search-key) {
    display: none;
  }
  .search-trigger {
    padding: 0 9px;
  }
}

@media (max-width: 1080px) {
  .topbar {
    gap: 12px;
  }
  .sync-pill {
    display: none;
  }
  .view-switch button span {
    display: none;
  }
  .view-switch button {
    padding: 0 10px;
  }
}

@media (max-width: 980px) {
  .wordmark span {
    display: none;
  }
  .presence {
    display: none;
  }
}

@media (max-width: 720px) {
  .topbar {
    gap: 10px;
    padding: 0 10px;
  }
  .wordmark {
    display: none;
  }
  .history-group,
  .presence {
    display: none;
  }
  .view-switch button {
    padding: 0 10px;
  }
  .view-switch button span {
    display: none;
  }
  .search-key {
    display: none;
  }
  .search-trigger {
    padding: 0 9px;
  }
}
</style>
