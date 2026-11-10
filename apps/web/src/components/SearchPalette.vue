<script setup lang="ts">
import type { SearchHit } from '@shijian/shared';
import { computed, nextTick, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import {
  closeSearch,
  revealSearchHit,
  searchHits,
  setSearchQuery,
  setView,
  state,
} from '../stores/workspace';

const input = ref<HTMLInputElement | null>(null);
const activeIndex = ref(0);
const results = searchHits;
const totalFurniture = computed(() =>
  state.workspace.houses.reduce(
    (sum, house) => sum + house.floors.reduce((inner, floor) => inner + floor.furniture.length, 0),
    0,
  ),
);
const totalItems = computed(() =>
  state.workspace.houses.reduce(
    (sum, house) =>
      sum +
      house.floors.reduce(
        (inner, floor) => inner + floor.furniture.reduce((count, f) => count + f.items.length, 0),
        0,
      ),
    0,
  ),
);

const suggestions = ['护照', '充电器', '咖啡豆', 'Switch', '备用钥匙'];

watch(
  () => state.searchOpen,
  async (open) => {
    if (open) {
      activeIndex.value = 0;
      await nextTick();
      input.value?.focus();
    }
  },
);

watch(
  () => state.searchQuery,
  () => {
    activeIndex.value = 0;
  },
);

watch(results, () => {
  if (activeIndex.value >= results.value.length) activeIndex.value = Math.max(0, results.value.length - 1);
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function marked(value: string): string {
  const query = state.searchQuery.trim();
  if (!query) return escapeHtml(value);
  const source = escapeHtml(value);
  const safeQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.replace(new RegExp(`(${safeQuery})`, 'gi'), '<mark>$1</mark>');
}

function choose(index = activeIndex.value, view?: '2d' | '3d'): void {
  const hit = results.value[index];
  if (!hit) return;
  if (view) setView(view);
  revealSearchHit(hit);
}

function updateQuery(value: string): void {
  setSearchQuery(value);
}

function pickSuggestion(value: string): void {
  updateQuery(value);
  nextTick(() => input.value?.focus());
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (results.value.length) activeIndex.value = (activeIndex.value + 1) % results.value.length;
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (results.value.length) activeIndex.value = (activeIndex.value - 1 + results.value.length) % results.value.length;
  } else if (event.key === 'Enter') {
    event.preventDefault();
    choose();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    closeSearch();
  }
}

function hitSubtitle(hit: SearchHit): string {
  const context = `${hit.houseName} · ${hit.floorName} · ${hit.furnitureName}`;
  if (hit.match === 'furniture') return `${context} · ${hit.quantity} 类物品`;
  return hit.note ? `${context} · ${hit.note}` : context;
}
</script>

<template>
  <Teleport to="body">
    <div v-if="state.searchOpen" class="search-backdrop" @pointerdown.self="closeSearch">
      <Transition name="slide-up" appear>
        <div class="search-modal" role="dialog" aria-modal="true" aria-label="全局查找物品" @keydown="handleKeydown">
            <div class="search-head">
              <div class="search-icon"><AppIcon name="search" :size="22" /></div>
              <input
                ref="input"
                :value="state.searchQuery"
                placeholder="搜索物品、家具或备注…"
                autocomplete="off"
                spellcheck="false"
                aria-label="搜索关键词"
                @input="updateQuery(($event.target as HTMLInputElement).value)"
              />
              <button class="search-close" title="关闭" @click="closeSearch">
                <span class="kbd">Esc</span>
              </button>
            </div>

            <div class="search-meta">
              <span>在 {{ totalFurniture }} 件家具 · {{ totalItems }} 类物品中查找</span>
              <span v-if="state.searchQuery.trim() && results.length">{{ results.length }} 个结果</span>
              <span v-else>试试家具名、物品名或备注</span>
            </div>

            <div v-if="!state.searchQuery.trim()" class="search-start">
              <span class="eyebrow">Quick find</span>
              <h3>想找什么？</h3>
              <div class="suggestions">
                <button v-for="word in suggestions" :key="word" @click="pickSuggestion(word)">
                  <AppIcon name="search" :size="12" />
                  {{ word }}
                </button>
              </div>
              <div class="search-note">
                <AppIcon name="spark" :size="15" />
                <p>物品名称和备注都会被检索。选中结果后，平面或立体视图会自动移到它的位置并高亮。</p>
              </div>
            </div>

            <div v-else-if="results.length === 0" class="search-empty">
              <div class="empty-orbit"><AppIcon name="box" :size="28" /></div>
              <h3>没有找到「{{ state.searchQuery }}」</h3>
              <p>换一个关键词，或者先在家具详情里把它记下来。</p>
              <div class="suggestions">
                <button v-for="word in suggestions.slice(0, 3)" :key="word" @click="pickSuggestion(word)">
                  {{ word }}
                </button>
              </div>
            </div>

            <div v-else class="result-list">
              <button
                v-for="(hit, index) in results"
                :key="`${hit.houseId}-${hit.floorId}-${hit.furnitureId}-${hit.itemId ?? 'container'}`"
                class="result-row"
                :class="{ active: index === activeIndex }"
                @mouseenter="activeIndex = index"
                @click="choose(index)"
              >
                <span class="result-icon" :class="hit.furnitureKind">
                  <AppIcon :name="hit.furnitureKind" :size="19" />
                </span>
                <span class="result-main">
                  <span class="result-title">
                    <span v-html="marked(hit.itemName)" />
                    <em v-if="hit.match === 'furniture'" class="result-tag">位置</em>
                    <em v-else-if="hit.quantity > 1" class="result-qty">×{{ hit.quantity }}</em>
                  </span>
                  <span class="result-sub" v-html="marked(hitSubtitle(hit))" />
                </span>
                <span class="result-side">
                  <span class="result-place">{{ hit.floorName }} · {{ hit.houseName }}</span>
                  <span class="result-go">
                    <AppIcon name="arrow-right" :size="14" />
                  </span>
                </span>
              </button>
            </div>

            <footer class="search-footer">
              <span><span class="kbd">↑</span><span class="kbd">↓</span> 选择</span>
              <span><span class="kbd">↵</span> 定位</span>
              <span class="footer-tip">
                <AppIcon name="pin" :size="12" />
                定位后保持当前视图
              </span>
            </footer>
          </div>
        </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.search-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 11vh 20px 20px;
  background: rgba(29, 38, 32, 0.44);
  backdrop-filter: blur(5px) saturate(0.9);
}

.search-modal {
  width: min(640px, 100%);
  max-height: 76vh;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.55);
}

.search-head {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-raised);
}

.search-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  flex-shrink: 0;
}

.search-head input {
  flex: 1;
  height: 32px;
  font-family: var(--font-serif);
  font-size: 19px;
  letter-spacing: 0.01em;
}

.search-head input::placeholder {
  color: #a9aea8;
  font-family: var(--font-sans);
  font-size: 15px;
}

.search-close {
  display: flex;
  align-items: center;
  height: 30px;
  padding: 0 8px;
  border-radius: 6px;
  color: var(--muted);
}

.search-close:hover {
  background: rgba(40, 50, 45, 0.06);
}

.search-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 20px;
  border-bottom: 1px solid var(--line);
  background: rgba(241, 236, 227, 0.38);
  font-size: 9px;
  color: var(--muted);
  letter-spacing: 0.02em;
}

.search-start {
  padding: 25px 24px 23px;
  overflow-y: auto;
}

.search-start h3 {
  margin: 5px 0 14px;
  font-family: var(--font-serif);
  font-size: 23px;
  font-weight: 600;
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.suggestions button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 29px;
  padding: 0 11px;
  border-radius: 16px;
  border: 1px solid var(--line);
  color: var(--ink-soft);
  font-size: 10px;
  font-weight: 600;
  transition: all 150ms ease;
}

.suggestions button:hover {
  background: var(--accent-soft);
  border-color: transparent;
  color: var(--accent-deep);
}

.search-note {
  display: flex;
  gap: 10px;
  margin-top: 22px;
  padding: 13px 14px;
  border-radius: 10px;
  background: #eef1e9;
  color: var(--sage-deep);
}

.search-note p {
  font-size: 10px;
  line-height: 1.7;
  color: #68786b;
}

.search-note svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.search-empty {
  padding: 35px 24px 30px;
  text-align: center;
}

.empty-orbit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 58px;
  height: 58px;
  margin: 0 auto 13px;
  border-radius: 50%;
  border: 1px dashed var(--line-strong);
  color: var(--muted);
}

.search-empty h3 {
  font-family: var(--font-serif);
  font-size: 19px;
  font-weight: 600;
}

.search-empty p {
  margin: 6px 0 15px;
  font-size: 10px;
  color: var(--muted);
}

.search-empty .suggestions {
  justify-content: center;
}

.result-list {
  overflow-y: auto;
  padding: 7px;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 9px 11px;
  border-radius: 10px;
  text-align: left;
  transition: background 120ms ease;
}

.result-row.active {
  background: rgba(196, 112, 73, 0.08);
}

.result-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 9px;
  background: rgba(40, 50, 45, 0.06);
  color: var(--ink-soft);
}

.result-icon.sofa {
  background: #f1e6da;
  color: #9a6848;
}

.result-icon.bed {
  background: #eae5dc;
  color: #8b7d6b;
}

.result-icon.cabinet {
  background: #e5ebe3;
  color: #657a68;
}

.result-icon.nightstand {
  background: #f0e8db;
  color: #9c7c58;
}

.result-icon.table {
  background: #eee5d9;
  color: #8d6647;
}

.result-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.result-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink);
}

.result-title :deep(mark) {
  background: rgba(196, 112, 73, 0.2);
  color: var(--accent-deep);
  border-radius: 2px;
  padding: 0 1px;
}

.result-tag {
  display: inline-flex;
  height: 16px;
  padding: 0 5px;
  align-items: center;
  border-radius: 4px;
  background: var(--sage-soft);
  color: var(--sage-deep);
  font-style: normal;
  font-size: 8px;
  font-weight: 700;
}

.result-qty {
  font-style: normal;
  font-size: 8.5px;
  font-weight: 700;
  color: var(--accent-deep);
}

.result-sub {
  font-size: 9.5px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-sub :deep(mark) {
  background: rgba(196, 112, 73, 0.16);
  color: var(--accent-deep);
}

.result-side {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.result-place {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #b0b5af;
}

.result-go {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: #a9afa8;
  opacity: 0;
  transform: translateX(-3px);
  transition: all 150ms ease;
}

.result-row.active .result-go {
  opacity: 1;
  transform: translateX(0);
  color: var(--accent);
}

.search-footer {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 10px 18px;
  border-top: 1px solid var(--line);
  background: rgba(241, 236, 227, 0.36);
  font-size: 9px;
  color: var(--muted);
}

.search-footer span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.footer-tip {
  margin-left: auto;
  color: #a0a69f;
}

.footer-tip svg {
  color: var(--accent);
}
</style>
