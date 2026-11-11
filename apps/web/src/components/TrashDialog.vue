<script setup lang="ts">
import type { DeleteChallenge, TrashEntry } from '@shijian/shared';
import { computed, nextTick, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import {
  closeTrash,
  permanentlyDeleteHouse,
  refreshTrash,
  requestDeleteChallenge,
  restoreHouse,
  state,
} from '../stores/workspace';

const busyId = ref('');
const target = ref<TrashEntry | null>(null);
const challenge = ref<DeleteChallenge | null>(null);
const code = ref('');
const error = ref('');
const codeInput = ref<HTMLInputElement | null>(null);

const hasTrash = computed(() => state.trash.length > 0);
const canSubmit = computed(() => /^\d{4}$/.test(code.value) && !busyId.value);

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function entryStats(entry: TrashEntry): { floors: number; furniture: number; items: number } {
  return {
    floors: entry.house.floors.length,
    furniture: entry.house.floors.reduce((sum, floor) => sum + floor.furniture.length, 0),
    items: entry.house.floors.reduce(
      (sum, floor) => sum + floor.furniture.reduce((count, f) => count + f.items.length, 0),
      0,
    ),
  };
}

function resetChallenge(): void {
  target.value = null;
  challenge.value = null;
  code.value = '';
  error.value = '';
  busyId.value = '';
}

function close(): void {
  resetChallenge();
  closeTrash();
}

async function startPermanent(entry: TrashEntry): Promise<void> {
  error.value = '';
  busyId.value = entry.id;
  try {
    const result = await requestDeleteChallenge(entry.id);
    target.value = entry;
    challenge.value = result;
    code.value = '';
    await nextTick();
    codeInput.value?.focus();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '无法创建验证码';
  } finally {
    busyId.value = '';
  }
}

async function confirmPermanent(): Promise<void> {
  if (!target.value || !challenge.value || !canSubmit.value) return;
  error.value = '';
  busyId.value = target.value.id;
  try {
    const deleted = await permanentlyDeleteHouse(
      target.value.id,
      challenge.value.challengeId,
      code.value,
    );
    if (deleted) resetChallenge();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '永久删除失败';
  } finally {
    busyId.value = '';
  }
}

async function restore(entry: TrashEntry): Promise<void> {
  busyId.value = entry.id;
  error.value = '';
  try {
    await restoreHouse(entry.id);
    if (target.value?.id === entry.id) resetChallenge();
  } finally {
    busyId.value = '';
  }
}

watch(
  () => state.trashOpen,
  (open) => {
    if (open) {
      resetChallenge();
      void refreshTrash();
    }
  },
);
</script>

<template>
  <Teleport to="body">
    <div v-if="state.trashOpen" class="trash-layer" @pointerdown.self="close">
      <div class="trash-modal" role="dialog" aria-modal="true" aria-label="住宅回收站" @keydown.esc="close">
        <header class="trash-head">
          <div class="trash-head-main">
            <span class="trash-mark"><AppIcon name="trash" :size="20" /></span>
            <div>
              <span class="eyebrow">Recycle bin</span>
              <h2 class="serif">住宅回收站</h2>
              <p>删除的住宅会保留在这里。恢复后回到「我的房子」；永久删除不可撤销。</p>
            </div>
          </div>
          <button class="icon-btn" title="关闭回收站" @click="close">
            <AppIcon name="close" :size="17" />
          </button>
        </header>

        <div class="trash-body">
          <div v-if="!hasTrash" class="trash-empty">
            <div class="empty-icon"><AppIcon name="box" :size="28" /></div>
            <h3>回收站是空的</h3>
            <p>在「我的房子」菜单里删除的住宅会出现在这里。</p>
          </div>

          <template v-else>
            <div class="trash-list">
              <div v-for="entry in state.trash" :key="entry.id" class="trash-item">
                <span class="trash-item-icon"><AppIcon name="home" :size="20" /></span>
                <div class="trash-item-main">
                  <b>{{ entry.house.name }}</b>
                  <span>
                    {{ entryStats(entry).floors }} 层 ·
                    {{ entryStats(entry).furniture }} 件家具 ·
                    {{ entryStats(entry).items }} 类物品
                  </span>
                  <em>删除于 {{ formatDate(entry.deletedAt) }}</em>
                </div>
                <div class="trash-item-actions">
                  <button
                    class="trash-restore"
                    :disabled="busyId === entry.id"
                    @click="restore(entry)"
                  >
                    <AppIcon name="undo" :size="13" />
                    恢复
                  </button>
                  <button
                    class="trash-permanent"
                    :disabled="busyId === entry.id"
                    @click="startPermanent(entry)"
                  >
                    永久删除
                  </button>
                </div>
              </div>
            </div>

            <div v-if="challenge && target" class="challenge-card">
              <div class="challenge-head">
                <span class="challenge-icon"><AppIcon name="shield" :size="20" /></span>
                <div>
                  <span class="eyebrow">Confirm permanent deletion</span>
                  <h3>永久删除「{{ target.house.name }}」</h3>
                </div>
              </div>
              <p>这是一次不可恢复的操作。请输入下面显示的 4 位验证码以确认删除。</p>
              <div class="challenge-code" aria-label="验证码">{{ challenge.code }}</div>
              <label class="code-field">
                <input
                  ref="codeInput"
                  v-model="code"
                  maxlength="4"
                  inputmode="numeric"
                  pattern="[0-9]{4}"
                  autocomplete="one-time-code"
                  placeholder="输入 4 位验证码"
                  @keydown.enter.prevent="confirmPermanent"
                />
                <span>验证码 5 分钟内有效</span>
              </label>
              <div v-if="error" class="challenge-error">{{ error }}</div>
              <div class="challenge-actions">
                <button class="ghost-btn" @click="resetChallenge">取消</button>
                <button class="danger-confirm" :disabled="!canSubmit" @click="confirmPermanent">
                  <AppIcon name="trash" :size="14" />
                  确认永久删除
                </button>
              </div>
            </div>
          </template>
        </div>

        <footer class="trash-footer">
          <AppIcon name="info" :size="13" />
          永久删除会一并移除该住宅的所有楼层、家具和物品记录。
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.trash-layer {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(29, 38, 32, 0.46);
  backdrop-filter: blur(5px);
}

.trash-modal {
  width: min(720px, 100%);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  background: var(--surface);
  border: 1px solid rgba(255, 255, 255, 0.55);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.trash-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px 18px;
  border-bottom: 1px solid var(--line);
  background:
    radial-gradient(circle at 90% 5%, rgba(196, 112, 73, 0.1), transparent 40%),
    var(--surface-raised);
}

.trash-head-main {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.trash-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 12px;
  background: var(--accent-soft);
  color: var(--accent-deep);
}

.trash-head h2 {
  margin: 4px 0 5px;
  font-size: 24px;
  font-weight: 600;
}

.trash-head p {
  max-width: 470px;
  font-size: 10px;
  line-height: 1.65;
  color: var(--ink-soft);
}

.trash-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 24px 20px;
}

.trash-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 20px;
  text-align: center;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 58px;
  height: 58px;
  margin-bottom: 12px;
  border-radius: 50%;
  border: 1px dashed var(--line-strong);
  color: var(--muted);
}

.trash-empty h3 {
  font-family: var(--font-serif);
  font-size: 19px;
  font-weight: 600;
}

.trash-empty p {
  margin-top: 6px;
  font-size: 10px;
  color: var(--muted);
}

.trash-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.trash-item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 12px;
  border-radius: 11px;
  border: 1px solid var(--line);
  background: rgba(255, 253, 248, 0.55);
}

.trash-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 9px;
  background: #eee9df;
  color: var(--ink-soft);
}

.trash-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.trash-item-main b {
  font-size: 12px;
  font-weight: 600;
}

.trash-item-main span,
.trash-item-main em {
  font-style: normal;
  font-size: 8.5px;
  color: var(--muted);
}

.trash-item-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

.trash-restore,
.trash-permanent {
  height: 30px;
  padding: 0 9px;
  border-radius: 7px;
  font-size: 9px;
  font-weight: 600;
  transition: all 150ms ease;
}

.trash-restore {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--line);
  color: var(--ink-soft);
}

.trash-restore:hover:not(:disabled) {
  border-color: var(--line-strong);
  background: var(--paper);
  color: var(--ink);
}

.trash-permanent {
  color: var(--danger);
}

.trash-permanent:hover:not(:disabled) {
  background: rgba(181, 87, 73, 0.07);
}

.challenge-card {
  margin-top: 14px;
  padding: 16px;
  border-radius: 12px;
  background: #fbf3eb;
  border: 1px solid rgba(196, 112, 73, 0.24);
}

.challenge-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.challenge-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent-deep);
}

.challenge-head h3 {
  margin-top: 3px;
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 600;
}

.challenge-card > p {
  margin: 11px 0 12px;
  font-size: 9.5px;
  line-height: 1.65;
  color: #7c6a5c;
}

.challenge-code {
  padding: 10px 16px;
  border-radius: 9px;
  background: var(--surface-raised);
  border: 1px dashed rgba(196, 112, 73, 0.5);
  color: var(--accent-deep);
  font-family: 'Avenir Next', monospace;
  font-size: 27px;
  font-weight: 700;
  letter-spacing: 0.32em;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.code-field {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.code-field input {
  width: 158px;
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--surface-raised);
  font-family: 'Avenir Next', monospace;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.code-field input::placeholder {
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.03em;
  color: var(--muted);
}

.code-field input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(196, 112, 73, 0.1);
}

.code-field span {
  font-size: 8.5px;
  color: var(--muted);
}

.challenge-error {
  margin-top: 9px;
  font-size: 9px;
  color: var(--danger);
}

.challenge-actions {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  margin-top: 12px;
}

.danger-confirm {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 12px;
  border-radius: 7px;
  background: var(--danger);
  color: #fff9f4;
  font-size: 9.5px;
  font-weight: 700;
  transition: background 150ms ease;
}

.danger-confirm:hover:not(:disabled) {
  background: #9f4539;
}

.trash-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 11px 24px;
  border-top: 1px solid var(--line);
  background: rgba(241, 236, 227, 0.4);
  color: var(--muted);
  font-size: 8.5px;
}

@media (max-width: 640px) {
  .trash-layer {
    padding: 10px;
  }

  .trash-modal {
    max-height: 92vh;
    border-radius: 14px;
  }

  .trash-head {
    padding: 16px;
  }

  .trash-head h2 {
    font-size: 20px;
  }

  .trash-body {
    padding: 14px 16px 16px;
  }

  .trash-item {
    flex-wrap: wrap;
  }

  .trash-item-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .challenge-code {
    font-size: 24px;
  }
}
</style>
