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
  { keys: ['S'], label: '楼梯' },
  { keys: ['⌘', 'K'], label: '全局查找物品' },
  { keys: ['⇧', '拖拽'], label: '正方形 / 角度锁定' },
  { keys: ['Del'], label: '删除选中对象' },
  { keys: ['[', ']'], label: '旋转选中家具' },
  { keys: ['空格', '拖拽'], label: '平移画布' },
  { keys: ['⌘', 'Z'], label: '撤销' },
];

const steps = [
  {
    icon: 'home',
    title: '选一栋房子',
    text: '右上角「我的房子」可以新建和切换住宅。每栋房子独立保存，首页可以在不同房子之间移动。',
  },
  {
    icon: 'rect',
    title: '画出每层平面',
    text: '矩形和椭圆是地面画笔。交集让新图形融合，差集从地面挖除。顶部楼层条可以添加、复制、切换和删除楼层。',
  },
  {
    icon: 'stairs',
    title: '连接上下层',
    text: '用楼梯工具在下一层放置楼梯，默认升向上一层；上层地板会自动挖出楼梯洞口。',
  },
  {
    icon: 'search',
    title: '记住再找到',
    text: '点开家具写下物品。全局搜索会跨房子和楼层检索，点击结果自动切换到对应位置并高亮。',
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
