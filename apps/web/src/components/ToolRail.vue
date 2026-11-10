<script setup lang="ts">
import type { FurnitureKind, Tool } from '@shijian/shared';
import AppIcon from './AppIcon.vue';
import {
  setBooleanMode,
  setShapeKind,
  setTool,
  state,
  toggleHelp,
} from '../stores/workspace';

const furniture: { kind: FurnitureKind; label: string; icon: string }[] = [
  { kind: 'sofa', label: '沙发', icon: 'sofa' },
  { kind: 'table', label: '桌子', icon: 'table' },
  { kind: 'bed', label: '床', icon: 'bed' },
  { kind: 'cabinet', label: '柜子', icon: 'cabinet' },
  { kind: 'nightstand', label: '床头柜', icon: 'nightstand' },
];

const functionTools: { tool: Tool; label: string; icon: string; hint: string }[] = [
  { tool: 'wall', label: '墙体', icon: 'wall', hint: 'W' },
  { tool: 'door', label: '门', icon: 'door', hint: 'D' },
  { tool: 'window', label: '窗', icon: 'window', hint: 'N' },
];
</script>

<template>
  <aside class="tool-rail">
    <div class="rail-top">
      <button
        class="tool-button tool-select"
        :class="{ active: state.tool === 'select' }"
        title="选择与移动（V）"
        @click="setTool('select')"
      >
        <AppIcon name="cursor" :size="20" />
        <span>选择</span>
      </button>

      <div class="rail-section">
        <div class="rail-heading">
          <span>地面</span>
          <i />
        </div>
        <button
          class="tool-button"
          :class="{ active: state.tool === 'rect' }"
          title="矩形地面（R）"
          @click="setShapeKind('rect')"
        >
          <AppIcon name="rect" :size="19" />
          <span>矩形</span>
        </button>
        <button
          class="tool-button"
          :class="{ active: state.tool === 'ellipse' }"
          title="椭圆地面（O）"
          @click="setShapeKind('ellipse')"
        >
          <AppIcon name="ellipse" :size="19" />
          <span>椭圆</span>
        </button>

        <div class="boolean-switch" title="地面图形的组合方式">
          <button
            :class="{ active: state.booleanMode === 'union' }"
            title="交集：新图形与已有地面融合"
            @click="setBooleanMode('union')"
          >
            交集
          </button>
          <button
            :class="{ active: state.booleanMode === 'subtract' }"
            title="差集：从已有地面中挖除新图形"
            @click="setBooleanMode('subtract')"
          >
            差集
          </button>
        </div>
      </div>

      <div class="rail-section">
        <div class="rail-heading">
          <span>结构</span>
          <i />
        </div>
        <button
          v-for="item in functionTools"
          :key="item.tool"
          class="tool-button"
          :class="{ active: state.tool === item.tool }"
          :title="`${item.label}（${item.hint}）`"
          @click="setTool(item.tool)"
        >
          <AppIcon :name="item.icon" :size="19" />
          <span>{{ item.label }}</span>
        </button>
      </div>

      <div class="rail-section furniture-section">
        <div class="rail-heading">
          <span>家具</span>
          <i />
        </div>
        <button
          v-for="item in furniture"
          :key="item.kind"
          class="tool-button furniture-button"
          :class="{ active: state.tool === item.kind }"
          :title="`放置${item.label}`"
          @click="setTool(item.kind)"
        >
          <AppIcon :name="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </button>
      </div>
    </div>

    <div class="rail-bottom">
      <button class="rail-help" title="快捷键与使用说明" @click="toggleHelp()">
        <AppIcon name="help" :size="17" />
      </button>
    </div>
  </aside>
</template>

<style scoped>
.tool-rail {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  width: 74px;
  padding: 12px 9px 14px;
  background: var(--surface);
  border-right: 1px solid var(--line);
  z-index: 4;
}

.rail-top {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 1px;
}

.rail-top::-webkit-scrollbar {
  width: 0;
}

.tool-button {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 56px;
  min-height: 47px;
  padding: 5px 2px;
  border-radius: 10px;
  color: var(--ink-soft);
  transition: background 150ms ease, color 150ms ease, transform 120ms ease;
}

.tool-button span {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.tool-button:hover {
  background: rgba(40, 50, 45, 0.06);
  color: var(--ink);
}

.tool-button.active {
  background: var(--ink);
  color: #fbf9f4;
  box-shadow: 0 4px 12px rgba(40, 50, 45, 0.18);
}

.tool-button.active:hover {
  background: #38463e;
}

.tool-button:active {
  transform: scale(0.96);
}

.tool-select {
  min-height: 51px;
  margin-bottom: 2px;
}

.rail-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding-top: 8px;
}

.rail-heading {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 5px;
  padding: 0 2px 3px;
  color: #9aa19a;
}

.rail-heading span {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.rail-heading i {
  flex: 1;
  height: 1px;
  background: var(--line);
}

.boolean-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  width: 100%;
  padding: 2px;
  margin-top: 3px;
  border-radius: 7px;
  background: rgba(40, 50, 45, 0.065);
}

.boolean-switch button {
  height: 22px;
  border-radius: 5px;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--muted);
  transition: all 150ms ease;
}

.boolean-switch button.active {
  background: var(--surface-raised);
  color: var(--accent-deep);
  box-shadow: 0 1px 3px rgba(40, 50, 45, 0.12);
}

.furniture-section {
  padding-bottom: 4px;
}

.furniture-button {
  min-height: 43px;
}

.rail-bottom {
  display: flex;
  justify-content: center;
  padding-top: 8px;
}

.rail-help {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  color: var(--muted);
  border: 1px solid var(--line);
  transition: all 150ms ease;
}

.rail-help:hover {
  color: var(--ink);
  border-color: var(--line-strong);
  background: var(--paper);
}

@media (max-height: 760px) {
  .tool-button {
    min-height: 41px;
  }
  .tool-button span {
    display: none;
  }
  .furniture-button {
    min-height: 38px;
  }
  .rail-heading {
    padding-bottom: 1px;
  }
}
</style>
