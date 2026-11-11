import {
  FURNITURE_CATALOG,
  STAIR_DEFAULTS,
  createDemoWorkspace,
  createFloorPlan,
  createId,
  createStarterHouse,
  distance,
  floorName,
  searchWorkspace,
} from '@shijian/shared';
import type {
  BooleanMode,
  DeleteChallenge,
  FloorPlan,
  Furniture,
  FurnitureKind,
  House,
  Opening,
  SearchHit,
  ShapeKind,
  Stair,
  StoredItem,
  Tool,
  TrashEntry,
  ViewMode,
  Wall,
  Workspace,
} from '@shijian/shared';
import { computed, reactive } from 'vue';

export type SyncStatus = 'connecting' | 'saved' | 'saving' | 'offline' | 'error';

export interface Selection {
  kind: 'furniture' | 'wall' | 'opening' | 'stair';
  id: string;
}

export interface FocusRequest {
  x: number;
  y: number;
  level: number;
  zoom?: number;
  token: number;
  furnitureId?: string;
}

export interface Highlight {
  houseId: string;
  floorId: string;
  floorLevel: number;
  furnitureId: string;
  itemId: string | null;
  itemName: string;
  token: number;
}

export interface Toast {
  id: string;
  text: string;
  tone: 'info' | 'success' | 'warn';
}

interface WorkspaceState {
  workspace: Workspace;
  ready: boolean;
  view: ViewMode;
  tool: Tool;
  shapeKind: ShapeKind;
  booleanMode: BooleanMode;
  activeHouseId: string;
  activeFloorId: string;
  selection: Selection | null;
  highlight: Highlight | null;
  focusRequest: FocusRequest | null;
  searchOpen: boolean;
  searchQuery: string;
  helpOpen: boolean;
  trashOpen: boolean;
  trash: TrashEntry[];
  sync: SyncStatus;
  clients: number;
  lastSavedAt: string | null;
  toasts: Toast[];
  zoom: number;
  undoDepth: number;
  redoDepth: number;
}

const demo = createDemoWorkspace();
export const state = reactive<WorkspaceState>({
  workspace: demo,
  ready: false,
  view: '2d',
  tool: 'select',
  shapeKind: 'rect',
  booleanMode: 'union',
  activeHouseId: demo.houses[0].id,
  activeFloorId: demo.houses[0].floors[0].id,
  selection: null,
  highlight: null,
  focusRequest: null,
  searchOpen: false,
  searchQuery: '',
  helpOpen: false,
  trashOpen: false,
  trash: [],
  sync: 'connecting',
  clients: 1,
  lastSavedAt: null,
  toasts: [],
  zoom: 80,
  undoDepth: 0,
  redoDepth: 0,
});

const history: Workspace[] = [];
const future: Workspace[] = [];
let syncRequester: (() => void) | null = null;
let lastCommitKey = '';
let lastCommitAt = 0;
let focusSeq = 0;
let highlightSeq = 0;
let toastSeq = 0;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const now = () => new Date().toISOString();
const LOCAL_KEY = 'shijian:workspace:v1';
const ACTIVE_KEY = 'shijian:active:v1';

function persistLocal(): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state.workspace));
  } catch {
    // Storage can be full or unavailable; remote sync remains the source of truth.
  }
}

function persistActive(): void {
  try {
    localStorage.setItem(
      ACTIVE_KEY,
      JSON.stringify({ houseId: state.activeHouseId, floorId: state.activeFloorId }),
    );
  } catch {
    // Ignore storage failures.
  }
}

function readLocal(): Workspace | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Workspace;
  } catch {
    return null;
  }
}

function readActive(): { houseId?: string; floorId?: string } | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as { houseId?: string; floorId?: string }) : null;
  } catch {
    return null;
  }
}

function houseById(workspace: Workspace, id: string): House | undefined {
  return workspace.houses.find((house) => house.id === id);
}

function floorById(house: House, id: string): FloorPlan | undefined {
  return house.floors.find((floor) => floor.id === id);
}

function applyActiveIds(workspace: Workspace, stored?: { houseId?: string; floorId?: string } | null): void {
  const house =
    (stored?.houseId ? houseById(workspace, stored.houseId) : undefined) ??
    houseById(workspace, state.activeHouseId) ??
    workspace.houses[0];
  if (!house) return;
  const floor =
    (stored?.floorId ? floorById(house, stored.floorId) : undefined) ??
    floorById(house, state.activeFloorId) ??
    house.floors[0];
  if (!floor) return;
  state.activeHouseId = house.id;
  state.activeFloorId = floor.id;
}

function pushHistory(): void {
  history.push(clone(state.workspace));
  if (history.length > 80) history.shift();
  future.length = 0;
  state.undoDepth = history.length;
  state.redoDepth = 0;
}

export function bindSyncRequester(requester: (() => void) | null): void {
  syncRequester = requester;
}

export function requestSyncNow(): void {
  syncRequester?.();
}

export interface CommitOptions {
  history?: boolean;
  key?: string;
  silent?: boolean;
}

/** Apply a local edit, group rapid keystrokes into one undo step, and sync. */
export function commit(recipe: (workspace: Workspace) => void, options: CommitOptions = {}): void {
  const shouldRecord = options.history !== false;
  if (shouldRecord) {
    const nowMs = Date.now();
    const grouped = Boolean(options.key) && options.key === lastCommitKey && nowMs - lastCommitAt < 800;
    if (!grouped) pushHistory();
    lastCommitKey = options.key ?? '';
    lastCommitAt = nowMs;
  }
  recipe(state.workspace);
  state.workspace.updatedAt = now();
  state.undoDepth = history.length;
  state.redoDepth = future.length;
  persistLocal();
  persistActive();
  if (!options.silent) {
    state.sync = 'saving';
    syncRequester?.();
  }
}

export function replaceWorkspace(
  workspace: Workspace,
  options: { remote?: boolean; pushUndo?: boolean; storedActive?: { houseId?: string; floorId?: string } | null } = {},
): void {
  if (options.pushUndo) pushHistory();
  state.workspace = workspace;
  applyActiveIds(workspace, options.storedActive);
  if (state.selection) {
    const floor = activeFloor.value;
    const exists =
      (state.selection.kind === 'furniture' && floor?.furniture.some((f) => f.id === state.selection?.id)) ||
      (state.selection.kind === 'wall' && floor?.walls.some((w) => w.id === state.selection?.id)) ||
      (state.selection.kind === 'opening' && floor?.openings.some((o) => o.id === state.selection?.id)) ||
      (state.selection.kind === 'stair' && floor?.stairs.some((s) => s.id === state.selection?.id));
    if (!exists) state.selection = null;
  }
  if (state.highlight) {
    const hHouse = houseById(workspace, state.highlight.houseId);
    const hFloor = hHouse ? floorById(hHouse, state.highlight.floorId) : undefined;
    if (!hFloor?.furniture.some((furniture) => furniture.id === state.highlight?.furnitureId)) {
      state.highlight = null;
    }
  }
  persistLocal();
  persistActive();
  if (options.remote) {
    state.undoDepth = history.length;
    state.redoDepth = future.length;
  }
}

export const activeHouse = computed<House>(() => {
  return houseById(state.workspace, state.activeHouseId) ?? state.workspace.houses[0];
});

export const activeFloor = computed<FloorPlan>(() => {
  const house = activeHouse.value;
  return floorById(house, state.activeFloorId) ?? house.floors[0];
});

export const activeFloorIndex = computed(() =>
  Math.max(0, activeHouse.value.floors.findIndex((floor) => floor.id === activeFloor.value.id)),
);

function mutateFloor(recipe: (floor: FloorPlan, house: House) => void, options: CommitOptions = {}): void {
  commit((workspace) => {
    const house = houseById(workspace, state.activeHouseId) ?? workspace.houses[0];
    const floor = floorById(house, state.activeFloorId) ?? house.floors[0];
    if (floor) recipe(floor, house);
  }, options);
}

export function undo(): void {
  const previous = history.pop();
  if (!previous) {
    pushToast('没有可以撤销的操作', 'info');
    return;
  }
  future.push(clone(state.workspace));
  replaceWorkspace(previous);
  state.undoDepth = history.length;
  state.redoDepth = future.length;
  state.sync = 'saving';
  syncRequester?.();
  pushToast('已撤销上一步', 'info');
}

export function redo(): void {
  const next = future.pop();
  if (!next) {
    pushToast('没有可以重做的操作', 'info');
    return;
  }
  history.push(clone(state.workspace));
  replaceWorkspace(next);
  state.undoDepth = history.length;
  state.redoDepth = future.length;
  state.sync = 'saving';
  syncRequester?.();
  pushToast('已重做', 'info');
}

export function setView(view: ViewMode): void {
  state.view = view;
}

export function setTool(tool: Tool): void {
  state.tool = tool;
  if (tool !== 'select') state.selection = null;
}

export function setShapeKind(kind: ShapeKind): void {
  state.shapeKind = kind;
  state.tool = kind;
  state.selection = null;
}

export function setBooleanMode(mode: BooleanMode): void {
  state.booleanMode = mode;
}

export function select(selection: Selection | null): void {
  state.selection = selection;
}

export function selectFurniture(id: string | null): void {
  state.selection = id ? { kind: 'furniture', id } : null;
}

export function selectWall(id: string | null): void {
  state.selection = id ? { kind: 'wall', id } : null;
}

export function selectOpening(id: string | null): void {
  state.selection = id ? { kind: 'opening', id } : null;
}

export function selectStair(id: string | null): void {
  state.selection = id ? { kind: 'stair', id } : null;
}

export const selectedFurniture = computed<Furniture | null>(() => {
  if (state.selection?.kind !== 'furniture') return null;
  return activeFloor.value.furniture.find((furniture) => furniture.id === state.selection?.id) ?? null;
});

export const selectedWall = computed<Wall | null>(() => {
  if (state.selection?.kind !== 'wall') return null;
  return activeFloor.value.walls.find((wall) => wall.id === state.selection?.id) ?? null;
});

export const selectedOpening = computed<Opening | null>(() => {
  if (state.selection?.kind !== 'opening') return null;
  return activeFloor.value.openings.find((opening) => opening.id === state.selection?.id) ?? null;
});

export const selectedStair = computed<Stair | null>(() => {
  if (state.selection?.kind !== 'stair') return null;
  return activeFloor.value.stairs.find((stair) => stair.id === state.selection?.id) ?? null;
});

export const highlightedFurniture = computed<Furniture | null>(() => {
  if (!state.highlight) return null;
  const house = houseById(state.workspace, state.highlight.houseId);
  const floor = house ? floorById(house, state.highlight.floorId) : undefined;
  return floor?.furniture.find((furniture) => furniture.id === state.highlight?.furnitureId) ?? null;
});

export function selectHouse(id: string): void {
  const house = houseById(state.workspace, id);
  if (!house) return;
  state.activeHouseId = house.id;
  state.activeFloorId = house.floors[0]?.id ?? '';
  state.selection = null;
  state.highlight = null;
  state.focusRequest = null;
  persistActive();
}

export function selectFloor(id: string): void {
  const floor = floorById(activeHouse.value, id);
  if (!floor) return;
  state.activeFloorId = floor.id;
  state.selection = null;
  state.highlight = null;
  state.focusRequest = null;
  persistActive();
}

export function createHouse(name = '新的家'): House {
  const house = createStarterHouse(name);
  commit((workspace) => {
    workspace.houses.push(house);
  });
  state.activeHouseId = house.id;
  state.activeFloorId = house.floors[0].id;
  state.selection = null;
  state.highlight = null;
  state.focusRequest = null;
  persistActive();
  pushToast(`已创建「${house.name}」`, 'success');
  return house;
}

export function renameHouse(name: string): void {
  const trimmed = name.trim().slice(0, 120);
  if (!trimmed) return;
  const houseId = state.activeHouseId;
  commit((workspace) => {
    const house = houseById(workspace, houseId);
    if (house) house.name = trimmed;
  }, { key: `house-name-${houseId}` });
}

export interface TrashSnapshot {
  workspace: Workspace;
  trash: TrashEntry[];
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(path, { ...init, headers });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body as T;
}

export function setTrash(entries: TrashEntry[]): void {
  state.trash = entries;
}

export async function refreshTrash(): Promise<void> {
  try {
    state.trash = await apiRequest<TrashEntry[]>('/api/trash');
  } catch {
    // Keep the current snapshot if the trash endpoint is temporarily unavailable.
  }
}

export function openTrash(): void {
  state.trashOpen = true;
}

export function closeTrash(): void {
  state.trashOpen = false;
}

export async function trashHouse(id: string): Promise<boolean> {
  try {
    const snapshot = await apiRequest<TrashSnapshot>(`/api/houses/${encodeURIComponent(id)}/trash`, {
      method: 'POST',
    });
    replaceWorkspace(snapshot.workspace, { remote: true });
    state.trash = snapshot.trash;
    state.selection = null;
    state.highlight = null;
    state.focusRequest = null;
    markSaved(snapshot.workspace.revision, snapshot.workspace.updatedAt);
    pushToast('已移入回收站，可在「我的房子 → 回收站」恢复', 'info');
    return true;
  } catch (error) {
    pushToast(error instanceof Error ? error.message : '移入回收站失败', 'warn');
    return false;
  }
}

export async function restoreHouse(id: string): Promise<boolean> {
  try {
    const snapshot = await apiRequest<TrashSnapshot>(`/api/trash/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
    });
    replaceWorkspace(snapshot.workspace, { remote: true });
    state.trash = snapshot.trash;
    markSaved(snapshot.workspace.revision, snapshot.workspace.updatedAt);
    pushToast('住宅已从回收站恢复', 'success');
    return true;
  } catch (error) {
    pushToast(error instanceof Error ? error.message : '恢复住宅失败', 'warn');
    return false;
  }
}

export async function requestDeleteChallenge(id: string): Promise<DeleteChallenge> {
  return apiRequest<DeleteChallenge>(`/api/trash/${encodeURIComponent(id)}/challenge`, {
    method: 'POST',
  });
}

export async function permanentlyDeleteHouse(
  id: string,
  challengeId: string,
  code: string,
): Promise<boolean> {
  const result = await apiRequest<{ trash: TrashEntry[] }>(`/api/trash/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ challengeId, code }),
  });
  state.trash = result.trash;
  pushToast('住宅已永久删除', 'info');
  return true;
}

export function addFloor(mode: 'blank' | 'copy' = 'copy'): FloorPlan {
  const houseId = state.activeHouseId;
  const level = Math.max(...activeHouse.value.floors.map((floor) => floor.level), -1) + 1;
  if (level >= 16) {
    pushToast('一栋房子最多 16 层', 'warn');
    return activeFloor.value;
  }
  const base = activeFloor.value;
  const newFloor = createFloorPlan(level);
  if (mode === 'copy') {
    const wallIds = new Map<string, string>();
    newFloor.shapes = base.shapes.map((shape) => ({ ...shape, id: createId('shape') }));
    newFloor.walls = base.walls.map((wall) => {
      const id = createId('wall');
      wallIds.set(wall.id, id);
      return { ...wall, id, a: { ...wall.a }, b: { ...wall.b } };
    });
    newFloor.openings = base.openings
      .map((opening) => {
        const wallId = wallIds.get(opening.wallId);
        return wallId ? { ...opening, id: createId('opening'), wallId } : null;
      })
      .filter((opening): opening is Opening => Boolean(opening));
  }
  commit((workspace) => {
    const house = houseById(workspace, houseId);
    if (house) house.floors.push(newFloor);
  });
  state.activeFloorId = newFloor.id;
  state.selection = null;
  state.highlight = null;
  state.focusRequest = null;
  persistActive();
  pushToast(
    mode === 'copy'
      ? `已添加 ${newFloor.name}，复制了地面与墙体`
      : `已添加空白楼层 ${newFloor.name}`,
    'success',
  );
  return newFloor;
}

export function deleteFloor(id: string): void {
  const house = activeHouse.value;
  if (house.floors.length <= 1) {
    pushToast('每栋房子至少需要保留一层', 'warn');
    return;
  }
  const target = house.floors.find((floor) => floor.id === id);
  if (!target) return;
  const remaining = house.floors.filter((floor) => floor.id !== id);
  const next = remaining[Math.max(0, Math.min(remaining.length - 1, target.level - 1))] ?? remaining[0];
  commit((workspace) => {
    const current = houseById(workspace, house.id);
    if (!current) return;
    const removedLevel = target.level;
    const lower = current.floors.find((floor) => floor.level === removedLevel - 1);
    if (lower) lower.stairs = [];
    current.floors = current.floors
      .filter((floor) => floor.id !== id)
      .sort((a, b) => a.level - b.level)
      .map((floor, index) => ({ ...floor, level: index, name: floorName(index) }));
  });
  state.activeFloorId = next.id;
  state.selection = null;
  state.highlight = null;
  state.focusRequest = null;
  persistActive();
  pushToast(`已删除 ${target.name}`, 'info');
}

export function addShape(shape: {
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}): void {
  const mode = state.booleanMode;
  mutateFloor(
    (floor) => {
      floor.shapes.push({
        id: createId('shape'),
        kind: shape.kind,
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
        rotation: shape.rotation ?? 0,
        mode,
      });
    },
    { key: 'shape' },
  );
  pushToast(mode === 'union' ? '已融合进地面' : '已从地面挖除', 'success');
}

export function addWall(a: { x: number; y: number }, b: { x: number; y: number }, thickness = 0.18): void {
  const wall: Wall = { id: createId('wall'), a: { ...a }, b: { ...b }, thickness };
  mutateFloor((floor) => floor.walls.push(wall), { key: 'wall' });
}

export function addOpening(wallId: string, kind: Opening['kind'], offset: number): void {
  const wall = activeFloor.value.walls.find((item) => item.id === wallId);
  if (!wall) return;
  const width = kind === 'door' ? 0.9 : 1.4;
  const wallLen = distance(wall.a, wall.b);
  mutateFloor(
    (floor) => {
      floor.openings.push({
        id: createId(kind),
        wallId,
        kind,
        offset: Math.max(0.02, Math.min(0.98, offset)),
        width: Math.min(width, wallLen * 0.9),
      });
    },
    { key: 'opening' },
  );
  pushToast(kind === 'door' ? '已放置门扇' : '已放置窗户', 'success');
}

export function findWallAt(point: { x: number; y: number }, maxDistance = 0.75): { wall: Wall; offset: number } | null {
  let best: { wall: Wall; offset: number; score: number } | null = null;
  for (const wall of activeFloor.value.walls) {
    const dx = wall.b.x - wall.a.x;
    const dy = wall.b.y - wall.a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    const t = Math.max(0, Math.min(1, ((point.x - wall.a.x) * dx + (point.y - wall.a.y) * dy) / lenSq));
    const px = wall.a.x + dx * t;
    const py = wall.a.y + dy * t;
    const dist = Math.hypot(point.x - px, point.y - py);
    if (dist <= maxDistance + wall.thickness / 2 && (!best || dist < best.score)) {
      best = { wall, offset: t, score: dist };
    }
  }
  return best ? { wall: best.wall, offset: best.offset } : null;
}

export function addFurniture(kind: FurnitureKind, x: number, y: number): Furniture {
  const spec = FURNITURE_CATALOG[kind];
  const furniture: Furniture = {
    id: createId('furniture'),
    kind,
    name: spec.label,
    x,
    y,
    rotation: 0,
    width: spec.width,
    depth: spec.depth,
    color: spec.color,
    items: [],
  };
  mutateFloor((floor) => floor.furniture.push(furniture), { key: 'furniture' });
  state.selection = { kind: 'furniture', id: furniture.id };
  state.tool = 'select';
  pushToast(`已放置${spec.label}，可在右侧添加物品`, 'success');
  return furniture;
}

export function updateFurniture(id: string, patch: Partial<Furniture>, key?: string): void {
  mutateFloor(
    (floor) => {
      const furniture = floor.furniture.find((item) => item.id === id);
      if (furniture) Object.assign(furniture, patch);
    },
    { key },
  );
}

export function moveFurniture(id: string, x: number, y: number): void {
  mutateFloor(
    (floor) => {
      const furniture = floor.furniture.find((item) => item.id === id);
      if (furniture) {
        furniture.x = x;
        furniture.y = y;
      }
    },
    { key: `move-${id}` },
  );
}

export function rotateFurniture(id: string, rotation: number, key?: string): void {
  updateFurniture(id, { rotation }, key ?? `rotate-${id}`);
}

export function deleteFurniture(id: string): void {
  mutateFloor((floor) => {
    floor.furniture = floor.furniture.filter((item) => item.id !== id);
  });
  if (state.selection?.id === id) state.selection = null;
  if (state.highlight?.furnitureId === id) state.highlight = null;
  pushToast('家具已删除', 'info');
}

export function updateWall(id: string, patch: Partial<Wall>, key?: string): void {
  mutateFloor(
    (floor) => {
      const wall = floor.walls.find((item) => item.id === id);
      if (wall) Object.assign(wall, patch);
    },
    { key },
  );
}

export function deleteWall(id: string): void {
  mutateFloor((floor) => {
    floor.walls = floor.walls.filter((wall) => wall.id !== id);
    floor.openings = floor.openings.filter((opening) => opening.wallId !== id);
  });
  if (state.selection?.kind === 'wall' && state.selection.id === id) state.selection = null;
  pushToast('墙体及其门窗已删除', 'info');
}

export function updateOpening(id: string, patch: Partial<Opening>, key?: string): void {
  mutateFloor(
    (floor) => {
      const opening = floor.openings.find((item) => item.id === id);
      if (opening) Object.assign(opening, patch);
    },
    { key },
  );
}

export function deleteOpening(id: string): void {
  mutateFloor((floor) => {
    floor.openings = floor.openings.filter((opening) => opening.id !== id);
  });
  if (state.selection?.kind === 'opening' && state.selection.id === id) state.selection = null;
  pushToast('门窗已删除', 'info');
}

export function addStair(x: number, y: number): Stair {
  const stair: Stair = {
    id: createId('stair'),
    x,
    y,
    width: STAIR_DEFAULTS.width,
    depth: STAIR_DEFAULTS.depth,
    rotation: 0,
    steps: STAIR_DEFAULTS.steps,
  };
  mutateFloor((floor) => floor.stairs.push(stair), { key: 'stair' });
  state.selection = { kind: 'stair', id: stair.id };
  state.tool = 'select';
  const hasUpper = activeHouse.value.floors.some((floor) => floor.level === activeFloor.value.level + 1);
  pushToast(
    hasUpper
      ? '已放置楼梯，通向上一层'
      : '已放置楼梯；当前是顶层，可先添加楼层',
    hasUpper ? 'success' : 'warn',
  );
  return stair;
}

export function updateStair(id: string, patch: Partial<Stair>, key?: string): void {
  mutateFloor(
    (floor) => {
      const stair = floor.stairs.find((item) => item.id === id);
      if (stair) Object.assign(stair, patch);
    },
    { key },
  );
}

export function deleteStair(id: string): void {
  mutateFloor((floor) => {
    floor.stairs = floor.stairs.filter((stair) => stair.id !== id);
  });
  if (state.selection?.kind === 'stair' && state.selection.id === id) state.selection = null;
  pushToast('楼梯已删除', 'info');
}

export function deleteSelection(): void {
  if (!state.selection) return;
  if (state.selection.kind === 'furniture') deleteFurniture(state.selection.id);
  else if (state.selection.kind === 'wall') deleteWall(state.selection.id);
  else if (state.selection.kind === 'opening') deleteOpening(state.selection.id);
  else deleteStair(state.selection.id);
}

export function addItem(furnitureId: string, name: string, quantity = 1, note = ''): StoredItem | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const item: StoredItem = {
    id: createId('item'),
    name: trimmed.slice(0, 120),
    quantity: Math.max(1, Math.round(quantity)),
    note: note.slice(0, 500),
  };
  mutateFloor((floor) => {
    const furniture = floor.furniture.find((entry) => entry.id === furnitureId);
    if (furniture) furniture.items.push(item);
  });
  pushToast(`已放入「${item.name}」`, 'success');
  return item;
}

export function updateItem(
  furnitureId: string,
  itemId: string,
  patch: Partial<StoredItem>,
  key?: string,
): void {
  mutateFloor(
    (floor) => {
      const furniture = floor.furniture.find((entry) => entry.id === furnitureId);
      const item = furniture?.items.find((entry) => entry.id === itemId);
      if (item) {
        Object.assign(item, patch);
        if (typeof item.quantity === 'number') item.quantity = Math.max(1, Math.round(item.quantity));
      }
    },
    { key },
  );
}

export function deleteItem(furnitureId: string, itemId: string): void {
  mutateFloor((floor) => {
    const furniture = floor.furniture.find((entry) => entry.id === furnitureId);
    if (furniture) furniture.items = furniture.items.filter((item) => item.id !== itemId);
  });
  pushToast('物品已移出', 'info');
}

export function rotateSelected(delta: number): void {
  if (state.selection?.kind === 'furniture') {
    const furniture = selectedFurniture.value;
    if (furniture) rotateFurniture(furniture.id, furniture.rotation + delta, `rotate-key-${furniture.id}`);
    return;
  }
  if (state.selection?.kind === 'stair') {
    const stair = selectedStair.value;
    if (stair) updateStair(stair.id, { rotation: stair.rotation + delta }, `rotate-stair-${stair.id}`);
  }
}

export function focusFurniture(id: string, zoom = 110): void {
  const furniture = activeFloor.value.furniture.find((item) => item.id === id);
  if (!furniture) return;
  state.selection = { kind: 'furniture', id };
  state.focusRequest = {
    x: furniture.x,
    y: furniture.y,
    level: activeFloor.value.level,
    zoom,
    token: ++focusSeq,
    furnitureId: id,
  };
}

export function requestFit(): void {
  state.focusRequest = {
    x: 4,
    y: 3,
    level: activeFloor.value.level,
    token: ++focusSeq,
    zoom: undefined,
  };
}

export function revealSearchHit(hit: SearchHit): void {
  state.searchOpen = false;
  state.activeHouseId = hit.houseId;
  state.activeFloorId = hit.floorId;
  state.selection = { kind: 'furniture', id: hit.furnitureId };
  state.highlight = {
    houseId: hit.houseId,
    floorId: hit.floorId,
    floorLevel: hit.floorLevel,
    furnitureId: hit.furnitureId,
    itemId: hit.itemId,
    itemName: hit.itemId ? hit.itemName : hit.furnitureName,
    token: ++highlightSeq,
  };
  const house = houseById(state.workspace, hit.houseId);
  const floor = house ? floorById(house, hit.floorId) : undefined;
  const furniture = floor?.furniture.find((item) => item.id === hit.furnitureId);
  if (furniture) {
    state.focusRequest = {
      x: furniture.x,
      y: furniture.y,
      level: hit.floorLevel,
      zoom: 120,
      token: ++focusSeq,
      furnitureId: furniture.id,
    };
  }
  persistActive();
  pushToast(
    hit.itemId
      ? `「${hit.itemName}」在 ${hit.houseName} · ${hit.floorName} · ${hit.furnitureName}`
      : `已定位 ${hit.houseName} · ${hit.floorName} · ${hit.furnitureName}`,
    'success',
  );
}

export function highlightStoredItem(furnitureId: string, itemId: string, itemName: string): void {
  const floor = activeFloor.value;
  state.selection = { kind: 'furniture', id: furnitureId };
  state.highlight = {
    houseId: activeHouse.value.id,
    floorId: floor.id,
    floorLevel: floor.level,
    furnitureId,
    itemId,
    itemName,
    token: ++highlightSeq,
  };
  const furniture = floor.furniture.find((item) => item.id === furnitureId);
  if (furniture) {
    state.focusRequest = {
      x: furniture.x,
      y: furniture.y,
      level: floor.level,
      zoom: 120,
      token: ++focusSeq,
      furnitureId,
    };
  }
}

export function clearHighlight(): void {
  state.highlight = null;
}

export function openSearch(): void {
  state.searchOpen = true;
}

export function closeSearch(): void {
  state.searchOpen = false;
}

export function toggleHelp(open = !state.helpOpen): void {
  state.helpOpen = open;
}

export const searchHits = computed<SearchHit[]>(() => {
  if (!state.searchQuery.trim()) return [];
  return searchWorkspace(state.workspace, state.searchQuery);
});

export function setSearchQuery(query: string): void {
  state.searchQuery = query;
}

export function pushToast(text: string, tone: Toast['tone'] = 'info'): void {
  const id = `toast_${++toastSeq}`;
  state.toasts.push({ id, text, tone });
  if (state.toasts.length > 4) state.toasts.shift();
  window.setTimeout(() => {
    const index = state.toasts.findIndex((toast) => toast.id === id);
    if (index >= 0) state.toasts.splice(index, 1);
  }, 3600);
}

export function dismissToast(id: string): void {
  const index = state.toasts.findIndex((toast) => toast.id === id);
  if (index >= 0) state.toasts.splice(index, 1);
}

export function markSaved(revision: number, updatedAt: string): void {
  state.workspace.revision = revision;
  state.workspace.updatedAt = updatedAt;
  state.sync = 'saved';
  state.lastSavedAt = updatedAt;
}

export function setSync(status: SyncStatus): void {
  state.sync = status;
}

export function setClients(count: number): void {
  state.clients = Math.max(1, count);
}

export async function loadWorkspace(): Promise<void> {
  try {
    const [response, trashResponse] = await Promise.all([
      fetch('/api/workspace', { headers: { accept: 'application/json' } }),
      fetch('/api/trash', { headers: { accept: 'application/json' } }),
    ]);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const workspace = (await response.json()) as Workspace;
    replaceWorkspace(workspace, { storedActive: readActive() });
    state.trash = trashResponse.ok ? ((await trashResponse.json()) as TrashEntry[]) : [];
    state.sync = 'saved';
  } catch {
    const local = readLocal();
    replaceWorkspace(local ?? createDemoWorkspace(), { storedActive: readActive() });
    state.trash = [];
    state.sync = 'offline';
    pushToast('未连接到同步服务，当前修改会保存在本机', 'warn');
  } finally {
    state.ready = true;
  }
}

export function startNewHouse(): House {
  return createHouse('新的家');
}

export function setZoom(zoom: number): void {
  state.zoom = zoom;
}

export function useWorkspace() {
  return {
    state,
    activeHouse,
    activeFloor,
    activeFloorIndex,
    selectedFurniture,
    selectedWall,
    selectedOpening,
    selectedStair,
    highlightedFurniture,
    searchHits,
  };
}
