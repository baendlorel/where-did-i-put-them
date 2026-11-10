<script setup lang="ts">
import {
  FURNITURE_CATALOG,
  FURNITURE_COLORS,
  buildFloorGeometry,
  formatArea,
  furnitureKindLabel,
  wallLength,
} from '@shijian/shared';
import type { FurnitureKind } from '@shijian/shared';
import { computed, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import {
  addItem,
  deleteFurniture,
  deleteItem,
  deleteOpening,
  deleteStair,
  deleteWall,
  focusFurniture,
  highlightStoredItem,
  openSearch,
  pushToast,
  rotateSelected,
  selectFurniture,
  selectOpening,
  setView,
  setTool,
  state,
  updateFurniture,
  updateItem,
  updateOpening,
  updateStair,
  updateWall,
  useWorkspace,
} from '../stores/workspace';

const {
  activeHouse,
  activeFloor,
  selectedFurniture,
  selectedWall,
  selectedOpening,
  selectedStair,
} = useWorkspace();
const newItemName = ref('');
const newItemQty = ref(1);

const area = computed(() => buildFloorGeometry(activeFloor.value.shapes).area);
const itemKinds = computed(() =>
  activeFloor.value.furniture.reduce((sum, furniture) => sum + furniture.items.length, 0),
);
const itemUnits = computed(() =>
  activeFloor.value.furniture.reduce(
    (sum, furniture) => sum + furniture.items.reduce((inner, item) => inner + item.quantity, 0),
    0,
  ),
);
const wallOpenings = computed(() =>
  selectedWall.value
    ? activeFloor.value.openings.filter((opening) => opening.wallId === selectedWall.value?.id)
    : [],
);
const selectedOpeningHost = computed(() => {
  if (!selectedOpening.value) return null;
  return activeFloor.value.walls.find((wall) => wall.id === selectedOpening.value?.wallId) ?? null;
});

const openingDegrees = computed({
  get: () => {
    const furniture = selectedFurniture.value;
    return furniture ? Math.round((((furniture.rotation * 180) / Math.PI) % 360 + 360) % 360) : 0;
  },
  set: (value: number) => {
    const furniture = selectedFurniture.value;
    if (furniture) updateFurniture(furniture.id, { rotation: (value * Math.PI) / 180 }, `rot-${furniture.id}`);
  },
});

const stairDegrees = computed({
  get: () => {
    const stair = selectedStair.value;
    return stair ? Math.round((((stair.rotation * 180) / Math.PI) % 360 + 360) % 360) : 0;
  },
  set: (value: number) => {
    const stair = selectedStair.value;
    if (stair) updateStair(stair.id, { rotation: (value * Math.PI) / 180 }, `stair-rot-${stair.id}`);
  },
});

watch(
  () => state.selection,
  () => {
    newItemName.value = '';
    newItemQty.value = 1;
  },
  { deep: true },
);

function changeName(event: Event): void {
  const furniture = selectedFurniture.value;
  if (!furniture) return;
  const name = (event.target as HTMLInputElement).value.trim();
  if (!name) return;
  updateFurniture(furniture.id, { name: name.slice(0, 80) }, `name-${furniture.id}`);
}

function changeNumber(
  field: 'x' | 'y' | 'width' | 'depth',
  event: Event,
  min = -100,
  max = 100,
): void {
  const furniture = selectedFurniture.value;
  if (!furniture) return;
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(value)) return;
  updateFurniture(
    furniture.id,
    { [field]: Math.max(min, Math.min(max, value)) },
    `dim-${furniture.id}-${field}`,
  );
}

function changeWallThickness(event: Event): void {
  const wall = selectedWall.value;
  if (!wall) return;
  const value = Number((event.target as HTMLInputElement).value);
  updateWall(wall.id, { thickness: Math.max(0.06, Math.min(0.5, value)) }, `wall-thickness-${wall.id}`);
}

function changeStairNumber(field: 'width' | 'depth' | 'steps', event: Event): void {
  const stair = selectedStair.value;
  if (!stair) return;
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(value)) return;
  const patch =
    field === 'steps'
      ? { steps: Math.max(5, Math.min(28, Math.round(value))) }
      : { [field]: Math.max(0.5, Math.min(12, value)) };
  updateStair(stair.id, patch, `stair-${field}-${stair.id}`);
}

function changeOpeningWidth(event: Event): void {
  const opening = selectedOpening.value;
  if (!opening) return;
  updateOpening(opening.id, { width: Number((event.target as HTMLInputElement).value) }, `opening-width-${opening.id}`);
}

function changeOpeningOffset(event: Event): void {
  const opening = selectedOpening.value;
  if (!opening) return;
  updateOpening(opening.id, { offset: Number((event.target as HTMLInputElement).value) / 100 }, `opening-offset-${opening.id}`);
}

function changeItemName(itemId: string, event: Event): void {
  const furniture = selectedFurniture.value;
  if (!furniture) return;
  updateItem(furniture.id, itemId, { name: (event.target as HTMLInputElement).value }, `item-name-${itemId}`);
}

function changeItemNote(itemId: string, event: Event): void {
  const furniture = selectedFurniture.value;
  if (!furniture) return;
  updateItem(furniture.id, itemId, { note: (event.target as HTMLInputElement).value }, `item-note-${itemId}`);
}

function changeQuantity(itemId: string, quantity: number): void {
  const furniture = selectedFurniture.value;
  if (!furniture) return;
  updateItem(furniture.id, itemId, { quantity: Math.max(1, quantity) });
}

function submitItem(): void {
  const furniture = selectedFurniture.value;
  if (!furniture) return;
  if (!newItemName.value.trim()) {
    pushToast('先写下物品名称', 'warn');
    return;
  }
  addItem(furniture.id, newItemName.value, newItemQty.value);
  newItemName.value = '';
  newItemQty.value = 1;
}

function setColor(color: string): void {
  const furniture = selectedFurniture.value;
  if (furniture) updateFurniture(furniture.id, { color });
}

function locate(furnitureId: string, view: '2d' | '3d'): void {
  setView(view);
  focusFurniture(furnitureId);
}

function locateItem(furnitureId: string, itemId: string, itemName: string): void {
  highlightStoredItem(furnitureId, itemId, itemName);
}

function selectFromOverview(id: string, event: MouseEvent): void {
  if ((event.target as HTMLElement).closest('.mini-locate')) {
    setView('2d');
    focusFurniture(id);
    return;
  }
  selectFurniture(id);
}
</script>

<template>
  <aside class="inspector">
    <header class="inspector-head">
      <div>
        <span class="eyebrow">Inspector</span>
        <h2>{{ selectedFurniture ? '物件详情' : selectedWall ? '墙体' : selectedOpening ? '门窗' : selectedStair ? '楼梯' : '空间索引' }}</h2>
      </div>
      <button
        v-if="state.selection"
        class="icon-btn"
        title="取消选中"
        @click="selectFurniture(null)"
      >
        <AppIcon name="close" :size="16" />
      </button>
      <span v-else class="head-mark"><AppIcon name="spark" :size="16" /></span>
    </header>

    <div class="inspector-body">
      <template v-if="selectedFurniture">
        <section class="object-hero">
          <div class="object-icon">
            <AppIcon :name="selectedFurniture.kind" :size="25" />
          </div>
          <div class="object-title">
            <input
              class="object-name"
              :value="selectedFurniture.name"
              maxlength="80"
              aria-label="家具名称"
              @change="changeName"
            />
            <div class="object-sub">
              <span class="chip">{{ furnitureKindLabel(selectedFurniture.kind) }}</span>
              <span class="dot-sep">·</span>
              <span>{{ selectedFurniture.items.length }} 类物品</span>
            </div>
          </div>
          <button class="icon-btn danger-btn" title="删除家具" @click="deleteFurniture(selectedFurniture.id)">
            <AppIcon name="trash" :size="15" />
          </button>
        </section>

        <div class="quick-locate">
          <button @click="locate(selectedFurniture.id, '2d')">
            <AppIcon name="2d" :size="15" />
            平面定位
          </button>
          <button @click="locate(selectedFurniture.id, '3d')">
            <AppIcon name="3d" :size="15" />
            立体定位
          </button>
        </div>

        <section class="panel-section">
          <div class="section-title">
            <h3>位置与尺寸</h3>
            <button class="micro-action" title="顺时针旋转 15°" @click="rotateSelected(Math.PI / 12)">
              <AppIcon name="rotate" :size="13" />
              旋转
            </button>
          </div>
          <div class="field-grid">
            <label class="mini-field">
              <span>X</span>
              <input
                :value="selectedFurniture.x.toFixed(2)"
                type="number"
                step="0.05"
                @change="changeNumber('x', $event)"
              />
              <em>m</em>
            </label>
            <label class="mini-field">
              <span>Y</span>
              <input
                :value="selectedFurniture.y.toFixed(2)"
                type="number"
                step="0.05"
                @change="changeNumber('y', $event)"
              />
              <em>m</em>
            </label>
            <label class="mini-field">
              <span>宽</span>
              <input
                :value="selectedFurniture.width.toFixed(2)"
                type="number"
                min="0.2"
                step="0.05"
                @change="changeNumber('width', $event, 0.2, 20)"
              />
              <em>m</em>
            </label>
            <label class="mini-field">
              <span>深</span>
              <input
                :value="selectedFurniture.depth.toFixed(2)"
                type="number"
                min="0.2"
                step="0.05"
                @change="changeNumber('depth', $event, 0.2, 20)"
              />
              <em>m</em>
            </label>
          </div>

          <label class="slider-field">
            <span class="slider-head">
              <span>朝向</span>
              <b>{{ openingDegrees }}°</b>
            </span>
            <input v-model.number="openingDegrees" type="range" min="0" max="359" step="1" />
          </label>

          <div class="color-row">
            <span class="color-label">材质色</span>
            <div class="swatches">
              <button
                v-for="color in FURNITURE_COLORS"
                :key="color"
                class="swatch"
                :class="{ active: selectedFurniture.color === color }"
                :style="{ background: color }"
                :title="color"
                @click="setColor(color)"
              />
            </div>
          </div>
        </section>

        <section class="panel-section items-section">
          <div class="section-title">
            <h3>内部物品 <span class="count-badge">{{ selectedFurniture.items.length }}</span></h3>
            <span class="hint-text">点名称可编辑</span>
          </div>

          <div v-if="selectedFurniture.items.length === 0" class="items-empty">
            <AppIcon name="box" :size="22" />
            <p>这里还空着。记录第一件收进来的东西。</p>
          </div>

          <div v-else class="item-list">
            <div v-for="(item, index) in selectedFurniture.items" :key="item.id" class="item-row">
              <span class="item-index">{{ String(index + 1).padStart(2, '0') }}</span>
              <div class="item-main">
                <div class="item-top">
                  <input
                    class="item-name"
                    :value="item.name"
                    maxlength="120"
                    aria-label="物品名称"
                    @change="changeItemName(item.id, $event)"
                  />
                  <div class="qty-stepper">
                    <button :disabled="item.quantity <= 1" @click="changeQuantity(item.id, item.quantity - 1)">−</button>
                    <span>{{ item.quantity }}</span>
                    <button @click="changeQuantity(item.id, item.quantity + 1)">+</button>
                  </div>
                </div>
                <input
                  class="item-note"
                  :value="item.note"
                  placeholder="补充位置或备注…"
                  maxlength="500"
                  aria-label="物品备注"
                  @change="changeItemNote(item.id, $event)"
                />
              </div>
              <div class="item-actions">
                <button
                  class="row-action"
                  title="在空间中高亮"
                  @click="locateItem(selectedFurniture.id, item.id, item.name)"
                >
                  <AppIcon name="locate" :size="13" />
                </button>
                <button
                  class="row-action danger"
                  title="移出物品"
                  @click="deleteItem(selectedFurniture.id, item.id)"
                >
                  <AppIcon name="close" :size="12" />
                </button>
              </div>
            </div>
          </div>

          <form class="add-item" @submit.prevent="submitItem">
            <div class="add-main">
              <AppIcon name="plus" :size="14" />
              <input
                v-model="newItemName"
                placeholder="添加物品，例如「备用钥匙」"
                maxlength="120"
                aria-label="新增物品名称"
              />
              <label class="qty-input">
                <span>×</span>
                <input v-model.number="newItemQty" type="number" min="1" max="999" />
              </label>
            </div>
            <button class="add-submit" type="submit">放入</button>
          </form>
        </section>

        <button class="delete-object" @click="deleteFurniture(selectedFurniture.id)">
          <AppIcon name="trash" :size="14" />
          删除这件家具
        </button>
      </template>

      <template v-else-if="selectedWall">
        <section class="object-hero">
          <div class="object-icon wall">
            <AppIcon name="wall" :size="24" />
          </div>
          <div class="object-title">
            <h3 class="static-name">墙体</h3>
            <div class="object-sub">
              <span class="chip">{{ wallLength(selectedWall).toFixed(2) }} m</span>
              <span class="dot-sep">·</span>
              <span>{{ wallOpenings.length }} 个门窗</span>
            </div>
          </div>
          <button class="icon-btn danger-btn" title="删除墙体" @click="deleteWall(selectedWall.id)">
            <AppIcon name="trash" :size="15" />
          </button>
        </section>

        <section class="panel-section">
          <div class="section-title"><h3>墙体参数</h3></div>
          <label class="slider-field">
            <span class="slider-head">
              <span>厚度</span>
              <b>{{ (selectedWall.thickness * 100).toFixed(0) }} cm</b>
            </span>
            <input
              :value="selectedWall.thickness"
              type="range"
              min="0.06"
              max="0.5"
              step="0.01"
              @input="changeWallThickness"
            />
          </label>
          <div class="wall-specs">
            <div><span>起点</span><b>{{ selectedWall.a.x.toFixed(2) }}, {{ selectedWall.a.y.toFixed(2) }}</b></div>
            <div><span>终点</span><b>{{ selectedWall.b.x.toFixed(2) }}, {{ selectedWall.b.y.toFixed(2) }}</b></div>
          </div>
        </section>

        <section class="panel-section">
          <div class="section-title"><h3>墙上开洞</h3><span class="hint-text">{{ wallOpenings.length }}</span></div>
          <div v-if="wallOpenings.length === 0" class="items-empty small">
            <p>还没有门窗。切换到门或窗工具，点击这面墙即可放置。</p>
          </div>
          <button
            v-for="opening in wallOpenings"
            :key="opening.id"
            class="opening-row"
            @click="selectOpening(opening.id)"
          >
            <AppIcon :name="opening.kind" :size="16" />
            <span>{{ opening.kind === 'door' ? '门' : '窗' }}</span>
            <em>{{ (opening.width * 100).toFixed(0) }} cm</em>
            <AppIcon name="arrow-right" :size="13" />
          </button>
        </section>

        <button class="delete-object" @click="deleteWall(selectedWall.id)">
          <AppIcon name="trash" :size="14" />
          删除墙体与门窗
        </button>
      </template>

      <template v-else-if="selectedOpening">
        <section class="object-hero">
          <div class="object-icon" :class="selectedOpening.kind">
            <AppIcon :name="selectedOpening.kind" :size="25" />
          </div>
          <div class="object-title">
            <h3 class="static-name">{{ selectedOpening.kind === 'door' ? '门' : '窗' }}</h3>
            <div class="object-sub">
              <span class="chip">{{ (selectedOpening.width * 100).toFixed(0) }} cm</span>
              <span class="dot-sep">·</span>
              <span>嵌入墙体</span>
            </div>
          </div>
          <button class="icon-btn danger-btn" title="删除门窗" @click="deleteOpening(selectedOpening.id)">
            <AppIcon name="trash" :size="15" />
          </button>
        </section>

        <section class="panel-section">
          <div class="section-title"><h3>门窗参数</h3></div>
          <label class="slider-field">
            <span class="slider-head"><span>宽度</span><b>{{ (selectedOpening.width * 100).toFixed(0) }} cm</b></span>
            <input
              :value="selectedOpening.width"
              type="range"
              min="0.4"
              max="3.2"
              step="0.05"
              @input="changeOpeningWidth"
            />
          </label>
          <label class="slider-field">
            <span class="slider-head"><span>沿墙位置</span><b>{{ Math.round(selectedOpening.offset * 100) }}%</b></span>
            <input
              :value="selectedOpening.offset * 100"
              type="range"
              min="0"
              max="100"
              step="1"
              @input="changeOpeningOffset"
            />
          </label>
          <div class="wall-specs">
            <div><span>所在墙体</span><b>{{ selectedOpeningHost ? `${wallLength(selectedOpeningHost).toFixed(2)} m` : '—' }}</b></div>
            <div><span>样式</span><b>{{ selectedOpening.kind === 'door' ? '粗实线 + 开启弧' : '青色虚线' }}</b></div>
          </div>
        </section>

        <button class="delete-object" @click="deleteOpening(selectedOpening.id)">
          <AppIcon name="trash" :size="14" />
          删除这个{{ selectedOpening.kind === 'door' ? '门' : '窗' }}
        </button>
      </template>

      <template v-else-if="selectedStair">
        <section class="object-hero">
          <div class="object-icon stair">
            <AppIcon name="stairs" :size="25" />
          </div>
          <div class="object-title">
            <h3 class="static-name">楼梯</h3>
            <div class="object-sub">
              <span class="chip">{{ activeFloor.name }}</span>
              <span class="dot-sep">·</span>
              <span>通向上一层</span>
            </div>
          </div>
          <button class="icon-btn danger-btn" title="删除楼梯" @click="deleteStair(selectedStair.id)">
            <AppIcon name="trash" :size="15" />
          </button>
        </section>

        <section class="panel-section">
          <div class="section-title"><h3>楼梯参数</h3></div>
          <div class="field-grid">
            <label class="mini-field">
              <span>宽</span>
              <input
                :value="selectedStair.width.toFixed(2)"
                type="number"
                min="0.5"
                step="0.05"
                @change="changeStairNumber('width', $event)"
              />
              <em>m</em>
            </label>
            <label class="mini-field">
              <span>深</span>
              <input
                :value="selectedStair.depth.toFixed(2)"
                type="number"
                min="1"
                step="0.1"
                @change="changeStairNumber('depth', $event)"
              />
              <em>m</em>
            </label>
            <label class="mini-field">
              <span>踏步</span>
              <input
                :value="selectedStair.steps"
                type="number"
                min="5"
                max="28"
                step="1"
                @change="changeStairNumber('steps', $event)"
              />
              <em>级</em>
            </label>
            <label class="mini-field">
              <span>朝向</span>
              <input
                :value="stairDegrees"
                type="number"
                min="0"
                max="359"
                step="5"
                @change="stairDegrees = Number(($event.target as HTMLInputElement).value)"
              />
              <em>°</em>
            </label>
          </div>
          <label class="slider-field">
            <span class="slider-head"><span>旋转</span><b>{{ stairDegrees }}°</b></span>
            <input v-model.number="stairDegrees" type="range" min="0" max="359" step="1" />
          </label>
          <div class="wall-specs">
            <div><span>位置</span><b>{{ selectedStair.x.toFixed(2) }}, {{ selectedStair.y.toFixed(2) }} m</b></div>
            <div><span>连接</span><b>{{ activeFloor.level + 1 }}F · 层高 2.85 m</b></div>
            <div><span>平面图例</span><b>踏步线 + UP 箭头</b></div>
          </div>
        </section>

        <button class="delete-object" @click="deleteStair(selectedStair.id)">
          <AppIcon name="trash" :size="14" />
          删除这个楼梯
        </button>
      </template>

      <template v-else>
        <section class="overview-hero">
          <span class="eyebrow">Your home, remembered</span>
          <h2 class="overview-title">{{ activeHouse.name }}</h2>
          <p>{{ activeFloor.name }} · 每件家具都是一只收纳盒。点开它，写下里面放了什么，之后就能在全局搜索里找回。</p>
          <div class="overview-actions">
            <button class="primary-btn accent" @click="openSearch">
              <AppIcon name="search" :size="15" />
              查找物品
            </button>
            <button class="ghost-btn" @click="setTool('cabinet')">
              <AppIcon name="plus" :size="14" />
              放置收纳
            </button>
          </div>
        </section>

        <section class="stat-grid">
          <div class="stat-card featured">
            <span>本层面积</span>
            <b>{{ formatArea(area) }}</b>
            <em>由平面图形自动计算</em>
          </div>
          <div class="stat-card">
            <span>家具</span>
            <b>{{ activeFloor.furniture.length }}</b>
            <em>件</em>
          </div>
          <div class="stat-card">
            <span>物品</span>
            <b>{{ itemKinds }}</b>
            <em>{{ itemUnits }} 件总量</em>
          </div>
          <div class="stat-card">
            <span>墙体</span>
            <b>{{ activeFloor.walls.length }}</b>
            <em>{{ activeFloor.openings.length }} 个门窗</em>
          </div>
          <div class="stat-card">
            <span>楼梯</span>
            <b>{{ activeFloor.stairs.length }}</b>
            <em>{{ activeFloor.level + 1 }}F / {{ activeHouse.floors.length }} 层</em>
          </div>
        </section>

        <section class="panel-section overview-list">
          <div class="section-title">
            <h3>家具与收纳</h3>
            <button class="micro-action" @click="openSearch">
              全局搜索
              <AppIcon name="arrow-right" :size="12" />
            </button>
          </div>
          <button
            v-for="furniture in activeFloor.furniture"
            :key="furniture.id"
            class="furniture-row"
            @click="selectFromOverview(furniture.id, $event)"
          >
            <span class="furniture-row-icon" :style="{ background: `${furniture.color}22`, color: furniture.color }">
              <AppIcon :name="furniture.kind" :size="17" />
            </span>
            <span class="furniture-row-main">
              <b>{{ furniture.name }}</b>
              <em>{{ (FURNITURE_CATALOG[furniture.kind as FurnitureKind]).label }} · {{ furniture.items.length }} 类</em>
            </span>
            <span class="furniture-count">{{ furniture.items.reduce((sum, item) => sum + item.quantity, 0) }}</span>
            <span class="mini-locate" title="在平面中定位">
              <AppIcon name="locate" :size="13" />
            </span>
          </button>
          <div v-if="activeFloor.furniture.length === 0" class="items-empty">
            <AppIcon name="sofa" :size="22" />
            <p>还没有家具。从左侧选择沙发、床或柜子放到平面图上。</p>
          </div>
        </section>

        <section class="tip-card">
          <AppIcon name="spark" :size="16" />
          <p>完成平面图后切换到「立体」，墙体、门窗和家具会自动生成。门窗会在墙上留下真实洞口。</p>
        </section>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.inspector {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 358px;
  background: var(--surface);
  border-left: 1px solid var(--line);
  z-index: 3;
}

.inspector-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 19px 20px 14px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}

.inspector-head h2 {
  margin-top: 3px;
  font-family: var(--font-serif);
  font-size: 21px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.head-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent-deep);
}

.inspector-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px 30px;
  scroll-behavior: smooth;
}

.object-hero {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 13px;
}

.object-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 14px;
  background: var(--accent-soft);
  color: var(--accent-deep);
}

.object-icon.wall {
  background: #e4e6df;
  color: var(--sage-deep);
}

.object-icon.door {
  background: #f2ded1;
  color: var(--accent-deep);
}

.object-icon.window {
  background: #dfeaeb;
  color: #4e828c;
}

.object-icon.stair {
  background: #ece4d7;
  color: #8a6b4b;
}

.object-title {
  min-width: 0;
  flex: 1;
}

.object-name {
  width: 100%;
  padding: 2px 0;
  font-family: var(--font-serif);
  font-size: 19px;
  font-weight: 600;
  border-bottom: 1px solid transparent;
  transition: border-color 150ms ease;
}

.object-name:hover {
  border-bottom-color: var(--line);
}

.object-name:focus {
  border-bottom-color: var(--accent);
}

.static-name {
  font-family: var(--font-serif);
  font-size: 19px;
  font-weight: 600;
}

.object-sub {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 5px;
  font-size: 10px;
  color: var(--muted);
}

.dot-sep {
  opacity: 0.5;
}

.quick-locate {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 20px;
}

.quick-locate button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 33px;
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  color: var(--ink-soft);
  transition: all 150ms ease;
}

.quick-locate button:hover {
  background: var(--paper);
  border-color: var(--line-strong);
  color: var(--ink);
}

.panel-section {
  padding: 16px 0;
  border-top: 1px solid var(--line);
}

.panel-section:first-of-type {
  border-top: 0;
  padding-top: 0;
}

.micro-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  font-weight: 600;
  color: var(--muted);
  transition: color 150ms ease;
}

.micro-action:hover {
  color: var(--accent-deep);
}

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.mini-field {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 33px;
  padding: 0 9px;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: rgba(255, 253, 248, 0.55);
  font-size: 10px;
  transition: border-color 150ms ease;
}

.mini-field:focus-within {
  border-color: rgba(196, 112, 73, 0.55);
}

.mini-field > span {
  color: var(--muted);
  font-weight: 600;
}

.mini-field input {
  width: 100%;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.mini-field input::-webkit-outer-spin-button,
.mini-field input::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}

.mini-field em {
  font-style: normal;
  font-size: 9px;
  color: var(--muted);
}

.slider-field {
  display: block;
  margin-top: 14px;
}

.slider-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 7px;
  font-size: 10px;
  color: var(--muted);
}

.slider-head b {
  color: var(--ink-soft);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

input[type='range'] {
  width: 100%;
  height: 3px;
  appearance: none;
  background: linear-gradient(90deg, var(--accent), #e2d3bd);
  border-radius: 2px;
  outline: none;
}

input[type='range']::-webkit-slider-thumb {
  appearance: none;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--accent);
  box-shadow: 0 1px 4px rgba(40, 50, 45, 0.2);
  cursor: pointer;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}

.color-label {
  font-size: 10px;
  color: var(--muted);
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.swatch {
  width: 19px;
  height: 19px;
  border-radius: 50%;
  border: 2px solid transparent;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
  transition: transform 140ms ease, border-color 140ms ease;
}

.swatch:hover {
  transform: scale(1.12);
}

.swatch.active {
  border-color: var(--surface);
  box-shadow: 0 0 0 1.5px var(--ink), inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 17px;
  height: 17px;
  margin-left: 4px;
  padding: 0 4px;
  border-radius: 5px;
  background: var(--accent-soft);
  color: var(--accent-deep);
  font-size: 9px;
  letter-spacing: 0;
}

.hint-text {
  font-size: 9px;
  color: var(--muted);
}

.items-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 14px;
  border-radius: 10px;
  border: 1px dashed var(--line-strong);
  color: var(--muted);
  text-align: center;
}

.items-empty p {
  max-width: 210px;
  font-size: 10px;
  line-height: 1.65;
}

.items-empty.small {
  padding: 14px;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.item-row {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 9px 8px;
  border-radius: 9px;
  border: 1px solid var(--line);
  background: rgba(255, 253, 248, 0.58);
  transition: border-color 150ms ease, background 150ms ease;
}

.item-row:hover {
  border-color: var(--line-strong);
  background: var(--surface-raised);
}

.item-index {
  padding-top: 2px;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #b3b8b1;
  font-variant-numeric: tabular-nums;
}

.item-main {
  flex: 1;
  min-width: 0;
}

.item-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.item-name {
  flex: 1;
  min-width: 0;
  font-size: 11.5px;
  font-weight: 600;
  padding: 1px 0;
  border-bottom: 1px solid transparent;
}

.item-name:focus {
  border-bottom-color: var(--accent);
}

.item-note {
  width: 100%;
  margin-top: 4px;
  font-size: 9.5px;
  color: var(--muted);
  padding: 1px 0;
  border-bottom: 1px solid transparent;
}

.item-note:focus {
  border-bottom-color: var(--line-strong);
}

.item-note::placeholder {
  color: #bcc0ba;
}

.qty-stepper {
  display: flex;
  align-items: center;
  gap: 1px;
  height: 21px;
  border-radius: 5px;
  background: rgba(40, 50, 45, 0.055);
  flex-shrink: 0;
}

.qty-stepper button {
  width: 18px;
  height: 21px;
  font-size: 12px;
  line-height: 1;
  color: var(--ink-soft);
  border-radius: 4px;
}

.qty-stepper button:hover:not(:disabled) {
  background: rgba(40, 50, 45, 0.1);
}

.qty-stepper span {
  min-width: 15px;
  text-align: center;
  font-size: 9px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.item-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 5px;
  color: var(--muted);
}

.row-action:hover {
  background: rgba(40, 50, 45, 0.08);
  color: var(--ink);
}

.row-action.danger:hover {
  background: rgba(181, 87, 73, 0.1);
  color: var(--danger);
}

.add-item {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 9px;
  padding: 4px;
  border-radius: 9px;
  border: 1px solid var(--line);
  background: var(--surface-raised);
}

.add-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 5px;
  min-width: 0;
  color: var(--muted);
}

.add-main input {
  flex: 1;
  min-width: 0;
  font-size: 10.5px;
}

.qty-input {
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 0 4px;
  border-left: 1px solid var(--line);
  color: var(--muted);
  font-size: 9px;
}

.qty-input input {
  width: 25px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.add-submit {
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  background: var(--ink);
  color: var(--surface);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.03em;
  transition: background 150ms ease;
}

.add-submit:hover {
  background: #3a4740;
}

.delete-object {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  height: 36px;
  margin-top: 18px;
  border-radius: 8px;
  border: 1px solid rgba(181, 87, 73, 0.18);
  color: var(--danger);
  font-size: 10px;
  font-weight: 600;
  transition: background 150ms ease;
}

.delete-object:hover {
  background: rgba(181, 87, 73, 0.06);
}

.wall-specs {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 16px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(40, 50, 45, 0.035);
}

.wall-specs div {
  display: flex;
  justify-content: space-between;
  font-size: 9.5px;
  color: var(--muted);
}

.wall-specs b {
  color: var(--ink-soft);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.opening-row {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  height: 38px;
  margin-bottom: 4px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  color: var(--ink-soft);
  font-size: 10px;
  transition: all 150ms ease;
}

.opening-row:hover {
  background: var(--paper);
  border-color: var(--line-strong);
}

.opening-row span {
  flex: 1;
  text-align: left;
  font-weight: 600;
}

.opening-row em {
  font-style: normal;
  font-size: 9px;
  color: var(--muted);
}

.overview-hero {
  padding: 3px 0 20px;
}

.overview-title {
  margin: 7px 0 8px;
  font-family: var(--font-serif);
  font-size: 25px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.overview-hero p {
  font-size: 11px;
  line-height: 1.8;
  color: var(--ink-soft);
  max-width: 290px;
}

.overview-actions {
  display: flex;
  gap: 7px;
  margin-top: 15px;
}

.overview-actions .primary-btn {
  height: 35px;
  padding: 0 13px;
  font-size: 11px;
}

.overview-actions .ghost-btn {
  height: 35px;
  font-size: 10px;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 11px 12px;
  border-radius: 10px;
  background: rgba(40, 50, 45, 0.04);
  border: 1px solid transparent;
}

.stat-card.featured {
  grid-column: span 2;
  background: var(--surface-raised);
  border-color: var(--line);
}

.stat-card > span {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.stat-card b {
  font-family: var(--font-serif);
  font-size: 23px;
  font-weight: 600;
  line-height: 1.15;
}

.stat-card em {
  font-style: normal;
  font-size: 9px;
  color: var(--muted);
}

.featured b {
  font-size: 27px;
}

.overview-list {
  padding-top: 4px;
}

.furniture-row {
  display: flex;
  align-items: center;
  gap: 9px;
  width: calc(100% + 8px);
  margin: 0 -4px 3px;
  padding: 7px 8px;
  border-radius: 8px;
  text-align: left;
  transition: background 150ms ease;
}

.furniture-row:hover {
  background: rgba(40, 50, 45, 0.05);
}

.furniture-row-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 33px;
  height: 33px;
  border-radius: 9px;
  flex-shrink: 0;
}

.furniture-row-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.furniture-row-main b {
  font-size: 10.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.furniture-row-main em {
  font-style: normal;
  font-size: 8.5px;
  color: var(--muted);
}

.furniture-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 19px;
  padding: 0 5px;
  border-radius: 5px;
  background: rgba(40, 50, 45, 0.06);
  color: var(--ink-soft);
  font-size: 8.5px;
  font-weight: 700;
}

.mini-locate {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 5px;
  color: #a6aca5;
  opacity: 0;
  transition: opacity 150ms ease, color 150ms ease;
}

.furniture-row:hover .mini-locate {
  opacity: 1;
}

.mini-locate:hover {
  color: var(--accent);
}

.tip-card {
  display: flex;
  gap: 9px;
  margin-top: 15px;
  padding: 12px;
  border-radius: 9px;
  background: #eef1e9;
  color: var(--sage-deep);
}

.tip-card p {
  font-size: 9.5px;
  line-height: 1.7;
  color: #6b7a6c;
}

.tip-card svg {
  flex-shrink: 0;
  margin-top: 1px;
}
</style>
