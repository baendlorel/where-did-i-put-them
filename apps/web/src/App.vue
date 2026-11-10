<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppIcon from './components/AppIcon.vue';
import HelpDialog from './components/HelpDialog.vue';
import InspectorPanel from './components/InspectorPanel.vue';
import PlanCanvas from './components/PlanCanvas.vue';
import SceneView from './components/SceneView.vue';
import SearchPalette from './components/SearchPalette.vue';
import ToolRail from './components/ToolRail.vue';
import TopBar from './components/TopBar.vue';
import {
  closeSearch,
  deleteSelection,
  dismissToast,
  loadWorkspace,
  openSearch,
  redo,
  rotateSelected,
  setShapeKind,
  setTool,
  state,
  toggleHelp,
  undo,
} from './stores/workspace';
import { startRealtime } from './lib/realtime';

const panelOpen = ref(false);

function isTyping(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return Boolean(
    target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable),
  );
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  const modifier = event.metaKey || event.ctrlKey;
  if (modifier && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (state.searchOpen) closeSearch();
    else openSearch();
    return;
  }

  if (event.key === 'Escape') {
    if (state.helpOpen) {
      toggleHelp(false);
      return;
    }
    if (state.searchOpen) {
      closeSearch();
      return;
    }
  }

  if (state.searchOpen || state.helpOpen) return;
  if (isTyping(event)) return;

  if (modifier && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (state.selection) {
      event.preventDefault();
      deleteSelection();
    }
    return;
  }

  if (event.key === 'Escape') {
    state.selection = null;
    state.highlight = null;
    setTool('select');
    return;
  }

  if (event.key === '[') {
    event.preventDefault();
    rotateSelected(-Math.PI / 24);
    return;
  }
  if (event.key === ']') {
    event.preventDefault();
    rotateSelected(Math.PI / 24);
    return;
  }

  if (state.view !== '2d') return;
  switch (event.key.toLowerCase()) {
    case 'v':
      setTool('select');
      break;
    case 'r':
      setShapeKind('rect');
      break;
    case 'o':
      setShapeKind('ellipse');
      break;
    case 'w':
      setTool('wall');
      break;
    case 'd':
      setTool('door');
      break;
    case 'n':
      setTool('window');
      break;
    case '0':
      event.preventDefault();
      window.dispatchEvent(new CustomEvent('shijian:fit'));
      break;
    default:
      break;
  }
}

function togglePanel(): void {
  panelOpen.value = !panelOpen.value;
}

watch(
  () => state.project.name,
  (name) => {
    document.title = `${name} · 拾间`;
  },
  { immediate: true },
);

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown);
  await loadWorkspace();
  startRealtime();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<template>
  <div class="app-shell">
    <TopBar />

    <main class="workspace" :class="{ 'hide-tools': state.view === '3d' }">
      <ToolRail v-if="state.view === '2d'" />
      <section class="viewport">
        <PlanCanvas v-if="state.view === '2d'" />
        <SceneView v-else />
        <button class="panel-fab" title="打开详情面板" @click="togglePanel">
          <AppIcon name="layers" :size="16" />
          详情
        </button>
      </section>
      <InspectorPanel :class="{ 'mobile-open': panelOpen }" />
    </main>

    <button v-if="panelOpen" class="mobile-panel-close" title="关闭详情面板" @click="panelOpen = false">
      <AppIcon name="close" :size="16" />
    </button>

    <SearchPalette />
    <HelpDialog />

    <div class="toast-stack">
      <TransitionGroup name="slide-up">
        <div
          v-for="toast in state.toasts"
          :key="toast.id"
          class="toast"
          :class="toast.tone"
          @click="dismissToast(toast.id)"
        >
          <span class="toast-icon">
            <AppIcon :name="toast.tone === 'success' ? 'check' : toast.tone === 'warn' ? 'info' : 'spark'" :size="14" />
          </span>
          <span>{{ toast.text }}</span>
        </div>
      </TransitionGroup>
    </div>

    <div v-if="!state.ready" class="boot-screen">
      <div class="boot-mark">
        <svg viewBox="0 0 56 56" width="56" height="56" fill="none">
          <rect x="1" y="1" width="54" height="54" rx="15" fill="#2e3933" />
          <path d="M15 24 28 14l13 10v19H15Z" stroke="#f1e8d9" stroke-width="1.8" />
          <path d="M23 43V33h10v10" stroke="#c47049" stroke-width="1.8" />
          <circle cx="28" cy="22" r="1.8" fill="#c47049" />
        </svg>
      </div>
      <div class="boot-word serif">拾间</div>
      <p>正在打开家的索引…</p>
      <span class="boot-line" />
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  min-height: 0;
  background: var(--paper);
  overflow: hidden;
}

.workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr) 358px;
  grid-template-rows: minmax(0, 1fr);
  overflow: hidden;
  transition: grid-template-columns 220ms ease;
}

.workspace > :deep(.tool-rail),
.workspace > :deep(.inspector) {
  min-height: 0;
}

.workspace.hide-tools {
  grid-template-columns: minmax(0, 1fr) 358px;
}

.viewport {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.panel-fab {
  display: none;
  position: absolute;
  right: 16px;
  top: 16px;
  z-index: 20;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border-radius: 9px;
  background: rgba(251, 249, 244, 0.92);
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(12px);
  font-size: 10px;
  font-weight: 600;
  color: var(--ink-soft);
}

.mobile-panel-close {
  display: none;
  position: fixed;
  right: 14px;
  top: 76px;
  z-index: 32;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface);
  color: var(--ink-soft);
  box-shadow: var(--shadow-sm);
}

.toast-stack {
  position: fixed;
  left: 50%;
  bottom: 72px;
  transform: translateX(-50%);
  z-index: 70;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 14px 0 8px;
  border-radius: 20px;
  background: rgba(40, 50, 45, 0.94);
  color: #f8f3e9;
  font-size: 10.5px;
  box-shadow: var(--shadow-md);
  pointer-events: auto;
  cursor: pointer;
  backdrop-filter: blur(10px);
}

.toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #d9b08f;
}

.toast.success .toast-icon {
  color: #b7d0b9;
}

.toast.warn {
  background: rgba(133, 70, 49, 0.95);
}

.toast.warn .toast-icon {
  color: #f2d4c2;
}

.boot-screen {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--paper);
}

.boot-mark {
  filter: drop-shadow(0 14px 25px rgba(40, 50, 45, 0.22));
}

.boot-word {
  margin-top: 4px;
  font-size: 25px;
  font-weight: 600;
  letter-spacing: 0.18em;
  padding-left: 0.18em;
}

.boot-screen p {
  font-size: 10px;
  color: var(--muted);
  letter-spacing: 0.06em;
}

.boot-line {
  width: 70px;
  height: 1px;
  margin-top: 6px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  animation: boot-line 1.4s ease-in-out infinite;
}

@keyframes boot-line {
  0%,
  100% {
    opacity: 0.25;
    transform: scaleX(0.5);
  }
  50% {
    opacity: 1;
    transform: scaleX(1);
  }
}

@media (max-width: 1180px) {
  .workspace,
  .workspace.hide-tools {
    grid-template-columns: 74px minmax(0, 1fr);
  }
  .workspace.hide-tools {
    grid-template-columns: minmax(0, 1fr);
  }
  .workspace > :deep(.inspector) {
    position: fixed;
    top: 66px;
    right: 0;
    bottom: 0;
    width: 345px;
    height: auto;
    box-shadow: -20px 0 50px rgba(40, 50, 45, 0.17);
    transform: translateX(102%);
    transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
    z-index: 25;
  }
  .workspace > :deep(.inspector.mobile-open) {
    transform: translateX(0);
  }
  .panel-fab {
    display: inline-flex;
  }
  .mobile-panel-close {
    display: inline-flex;
  }
}

@media (max-width: 760px) {
  .workspace {
    grid-template-columns: 74px minmax(0, 1fr);
  }
  .workspace.hide-tools {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
