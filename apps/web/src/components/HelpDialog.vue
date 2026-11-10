<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import { state, toggleHelp } from '../stores/workspace';

const shortcuts = [
  { keys: ['V'], label: '选择 / 移动家具' },
  { keys: ['R'], label: '矩形地面' },
  { keys: ['O'], label: '椭圆地面' },
  { keys: ['W'], label: '墙体' },
  { keys: ['D'], label: '门' },
  { keys: ['N'], label: '窗' },
  { keys: ['⌘', 'K'], label: '全局查找物品' },
  { keys: ['⇧', '拖拽'], label: '正方形 / 角度锁定' },
  { keys: ['Del'], label: '删除选中对象' },
  { keys: ['[', ']'], label: '旋转选中家具' },
  { keys: ['空格', '拖拽'], label: '平移画布' },
  { keys: ['⌘', 'Z'], label: '撤销' },
];

const steps = [
  {
    icon: 'rect',
    title: '画出宅邸',
    text: '矩形和椭圆是地面画笔。选「交集」让新图形融合进已有地面，选「差集」从地面中挖掉新图形。',
  },
  {
    icon: 'wall',
    title: '立起结构',
    text: '拖拽绘制实线墙体；在墙上点击放置粗线门、虚线窗。切换到立体后，门窗会变成真实洞口。',
  },
  {
    icon: 'sofa',
    title: '摆放家具',
    text: '从左侧放置沙发、桌子、床、柜子和床头柜。每件家具都拥有自己的物品数组。',
  },
  {
    icon: 'search',
    title: '记住再找到',
    text: '点开家具，写下里面放了什么。用 Ctrl / ⌘ + K 全局搜索，位置会在平面与立体中同时高亮。',
  },
];
</script>

<template>
  <Teleport to="body">
    <div v-if="state.helpOpen" class="help-layer" @pointerdown.self="toggleHelp(false)">
      <Transition name="slide-up" appear>
        <div class="help-modal" role="dialog" aria-label="使用说明">
            <header class="help-head">
              <div>
                <span class="eyebrow">Field Guide</span>
                <h2 class="serif">把家画下来，也把东西记住</h2>
                <p>一套从平面图到立体模型的工作流，物品索引会跟着家具一起生长。</p>
              </div>
              <button class="icon-btn" title="关闭" @click="toggleHelp(false)">
                <AppIcon name="close" :size="18" />
              </button>
            </header>

            <div class="help-body">
              <div class="step-grid">
                <div v-for="(step, index) in steps" :key="step.title" class="step">
                  <div class="step-top">
                    <span class="step-icon"><AppIcon :name="step.icon" :size="19" /></span>
                    <span class="step-number">0{{ index + 1 }}</span>
                  </div>
                  <h3>{{ step.title }}</h3>
                  <p>{{ step.text }}</p>
                </div>
              </div>

              <div class="shortcut-panel">
                <div class="shortcut-title">
                  <span class="eyebrow">Shortcuts</span>
                  <span>画布上的快捷操作</span>
                </div>
                <div class="shortcut-grid">
                  <div v-for="item in shortcuts" :key="item.label" class="shortcut-row">
                    <span class="shortcut-keys">
                      <kbd v-for="key in item.keys" :key="key">{{ key }}</kbd>
                    </span>
                    <span>{{ item.label }}</span>
                  </div>
                </div>
              </div>
            </div>

            <footer class="help-footer">
              <span><AppIcon name="cloud" :size="13" /> 修改会通过 WebSocket 自动同步，支持多个窗口协同编辑</span>
              <button class="primary-btn" @click="toggleHelp(false)">开始布置</button>
            </footer>
          </div>
        </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.help-layer {
  position: fixed;
  inset: 0;
  z-index: 45;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(29, 38, 32, 0.46);
  backdrop-filter: blur(5px);
}

.help-modal {
  width: min(760px, 100%);
  max-height: 88vh;
  overflow: auto;
  border-radius: 22px;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  border: 1px solid rgba(255, 255, 255, 0.55);
}

.help-head {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 25px 28px 20px;
  border-bottom: 1px solid var(--line);
  background:
    radial-gradient(circle at 88% 10%, rgba(196, 112, 73, 0.09), transparent 40%),
    var(--surface-raised);
}

.help-head h2 {
  margin: 8px 0 7px;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.help-head p {
  max-width: 520px;
  font-size: 11px;
  line-height: 1.75;
  color: var(--ink-soft);
}

.help-body {
  padding: 22px 28px 24px;
}

.step-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.step {
  padding: 15px 16px 16px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: rgba(255, 253, 248, 0.6);
}

.step-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 33px;
  height: 33px;
  border-radius: 9px;
  background: var(--accent-soft);
  color: var(--accent-deep);
}

.step-number {
  font-family: var(--font-serif);
  font-size: 17px;
  color: #c3c2b9;
}

.step h3 {
  margin: 11px 0 5px;
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 600;
}

.step p {
  font-size: 10px;
  line-height: 1.75;
  color: var(--ink-soft);
}

.shortcut-panel {
  margin-top: 18px;
  padding: 16px 18px;
  border-radius: 12px;
  background: var(--paper);
}

.shortcut-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}

.shortcut-title > span:last-child {
  font-size: 9px;
  color: var(--muted);
}

.shortcut-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px 18px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 24px;
  font-size: 9.5px;
  color: var(--ink-soft);
}

.shortcut-keys {
  display: flex;
  gap: 3px;
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 21px;
  height: 21px;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid var(--line);
  border-bottom-color: var(--line-strong);
  background: var(--surface-raised);
  color: var(--ink-soft);
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}

.help-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 16px 28px;
  border-top: 1px solid var(--line);
  background: var(--surface-raised);
}

.help-footer > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  color: var(--muted);
}

.help-footer .primary-btn {
  height: 36px;
  font-size: 11px;
}

@media (max-width: 640px) {
  .step-grid,
  .shortcut-grid {
    grid-template-columns: 1fr;
  }
}
</style>
