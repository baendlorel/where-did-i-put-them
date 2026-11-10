import {
  FURNITURE_CATALOG,
  createDemoProject,
  createId,
  createStarterProject,
  distance,
  searchProject,
} from '@shijian/shared';
import type {
  Furniture,
  FurnitureKind,
  Opening,
  Project,
  SearchHit,
  ShapeKind,
  BooleanMode,
  StoredItem,
  Tool,
  ViewMode,
  Wall,
} from '@shijian/shared';
import { computed, reactive } from 'vue';

export type SyncStatus = 'connecting' | 'saved' | 'saving' | 'offline' | 'error';

export interface Selection {
  kind: 'furniture' | 'wall' | 'opening';
  id: string;
}

export interface FocusRequest {
  x: number;
  y: number;
  zoom?: number;
  token: number;
  furnitureId?: string;
}

export interface Highlight {
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
  project: Project;
  ready: boolean;
  view: ViewMode;
  tool: Tool;
  shapeKind: ShapeKind;
  booleanMode: BooleanMode;
  selection: Selection | null;
  highlight: Highlight | null;
  focusRequest: FocusRequest | null;
  searchOpen: boolean;
  searchQuery: string;
  helpOpen: boolean;
  sync: SyncStatus;
  clients: number;
  lastSavedAt: string | null;
  toasts: Toast[];
  zoom: number;
  undoDepth: number;
  redoDepth: number;
}

export const state = reactive<WorkspaceState>({
  project: createDemoProject(),
  ready: false,
  view: '2d',
  tool: 'select',
  shapeKind: 'rect',
  booleanMode: 'union',
  selection: null,
  highlight: null,
  focusRequest: null,
  searchOpen: false,
  searchQuery: '',
  helpOpen: false,
  sync: 'connecting',
  clients: 1,
  lastSavedAt: null,
  toasts: [],
  zoom: 80,
  undoDepth: 0,
  redoDepth: 0,
});

const history: Project[] = [];
const future: Project[] = [];
let syncRequester: (() => void) | null = null;
let lastCommitKey = '';
let lastCommitAt = 0;
let focusSeq = 0;
let highlightSeq = 0;
let toastSeq = 0;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const now = () => new Date().toISOString();
const LOCAL_KEY = 'shijian:workspace:v1';

function persistLocal(): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state.project));
  } catch {
    // Storage can be full or unavailable; remote sync remains the source of truth.
  }
}

function readLocal(): Project | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Project;
  } catch {
    return null;
  }
}

function pushHistory(): void {
  history.push(clone(state.project));
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
export function commit(recipe: (project: Project) => void, options: CommitOptions = {}): void {
  const shouldRecord = options.history !== false;
  if (shouldRecord) {
    const nowMs = Date.now();
    const grouped = Boolean(options.key) && options.key === lastCommitKey && nowMs - lastCommitAt < 800;
    if (!grouped) pushHistory();
    lastCommitKey = options.key ?? '';
    lastCommitAt = nowMs;
  }
  recipe(state.project);
  state.project.updatedAt = now();
  state.undoDepth = history.length;
  state.redoDepth = future.length;
  persistLocal();
  if (!options.silent) {
    state.sync = 'saving';
    syncRequester?.();
  }
}

export function replaceProject(project: Project, options: { remote?: boolean; pushUndo?: boolean } = {}): void {
  if (options.pushUndo) pushHistory();
  state.project = project;
  if (state.selection) {
    const exists =
      (state.selection.kind === 'furniture' && project.furniture.some((f) => f.id === state.selection?.id)) ||
      (state.selection.kind === 'wall' && project.floor.walls.some((w) => w.id === state.selection?.id)) ||
      (state.selection.kind === 'opening' && project.floor.openings.some((o) => o.id === state.selection?.id));
    if (!exists) state.selection = null;
  }
  if (state.highlight && !project.furniture.some((f) => f.id === state.highlight?.furnitureId)) {
    state.highlight = null;
  }
  persistLocal();
  if (options.remote) {
    state.undoDepth = history.length;
    state.redoDepth = future.length;
  }
}

export function undo(): void {
  const previous = history.pop();
  if (!previous) {
    pushToast('没有可以撤销的操作', 'info');
    return;
  }
  future.push(clone(state.project));
  replaceProject(previous);
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
  history.push(clone(state.project));
  replaceProject(next);
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

export const selectedFurniture = computed<Furniture | null>(() => {
  if (state.selection?.kind !== 'furniture') return null;
  return state.project.furniture.find((furniture) => furniture.id === state.selection?.id) ?? null;
});

export const selectedWall = computed<Wall | null>(() => {
  if (state.selection?.kind !== 'wall') return null;
  return state.project.floor.walls.find((wall) => wall.id === state.selection?.id) ?? null;
});

export const selectedOpening = computed<Opening | null>(() => {
  if (state.selection?.kind !== 'opening') return null;
  return state.project.floor.openings.find((opening) => opening.id === state.selection?.id) ?? null;
});

export const highlightedFurniture = computed<Furniture | null>(() => {
  if (!state.highlight) return null;
  return state.project.furniture.find((furniture) => furniture.id === state.highlight?.furnitureId) ?? null;
});

export function addShape(shape: {
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}): void {
  const mode = state.booleanMode;
  commit(
    (project) => {
      project.floor.shapes.push({
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
  commit((project) => project.floor.walls.push(wall), { key: 'wall' });
}

export function addOpening(wallId: string, kind: Opening['kind'], offset: number): void {
  const wall = state.project.floor.walls.find((item) => item.id === wallId);
  if (!wall) return;
  const width = kind === 'door' ? 0.9 : 1.4;
  const wallLen = distance(wall.a, wall.b);
  commit(
    (project) => {
      project.floor.openings.push({
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
  for (const wall of state.project.floor.walls) {
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
  commit((project) => project.furniture.push(furniture), { key: 'furniture' });
  state.selection = { kind: 'furniture', id: furniture.id };
  state.tool = 'select';
  pushToast(`已放置${spec.label}，可在右侧添加物品`, 'success');
  return furniture;
}

export function updateFurniture(id: string, patch: Partial<Furniture>, key?: string): void {
  commit(
    (project) => {
      const furniture = project.furniture.find((item) => item.id === id);
      if (furniture) Object.assign(furniture, patch);
    },
    { key },
  );
}

export function moveFurniture(id: string, x: number, y: number): void {
  commit(
    (project) => {
      const furniture = project.furniture.find((item) => item.id === id);
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
  commit((project) => {
    project.furniture = project.furniture.filter((item) => item.id !== id);
  });
  if (state.selection?.id === id) state.selection = null;
  if (state.highlight?.furnitureId === id) state.highlight = null;
  pushToast('家具已删除', 'info');
}

export function updateWall(id: string, patch: Partial<Wall>, key?: string): void {
  commit(
    (project) => {
      const wall = project.floor.walls.find((item) => item.id === id);
      if (wall) Object.assign(wall, patch);
    },
    { key },
  );
}

export function deleteWall(id: string): void {
  commit((project) => {
    project.floor.walls = project.floor.walls.filter((wall) => wall.id !== id);
    project.floor.openings = project.floor.openings.filter((opening) => opening.wallId !== id);
  });
  if (state.selection?.kind === 'wall' && state.selection.id === id) state.selection = null;
  pushToast('墙体及其门窗已删除', 'info');
}

export function updateOpening(id: string, patch: Partial<Opening>, key?: string): void {
  commit(
    (project) => {
      const opening = project.floor.openings.find((item) => item.id === id);
      if (opening) Object.assign(opening, patch);
    },
    { key },
  );
}

export function deleteOpening(id: string): void {
  commit((project) => {
    project.floor.openings = project.floor.openings.filter((opening) => opening.id !== id);
  });
  if (state.selection?.kind === 'opening' && state.selection.id === id) state.selection = null;
  pushToast('门窗已删除', 'info');
}

export function deleteSelection(): void {
  if (!state.selection) return;
  if (state.selection.kind === 'furniture') deleteFurniture(state.selection.id);
  else if (state.selection.kind === 'wall') deleteWall(state.selection.id);
  else deleteOpening(state.selection.id);
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
  commit((project) => {
    const furniture = project.furniture.find((entry) => entry.id === furnitureId);
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
  commit(
    (project) => {
      const furniture = project.furniture.find((entry) => entry.id === furnitureId);
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
  commit((project) => {
    const furniture = project.furniture.find((entry) => entry.id === furnitureId);
    if (furniture) furniture.items = furniture.items.filter((item) => item.id !== itemId);
  });
  pushToast('物品已移出', 'info');
}

export function rotateSelected(delta: number): void {
  if (state.selection?.kind !== 'furniture') return;
  const furniture = selectedFurniture.value;
  if (!furniture) return;
  rotateFurniture(furniture.id, furniture.rotation + delta, `rotate-key-${furniture.id}`);
}

export function focusFurniture(id: string, zoom = 110): void {
  const furniture = state.project.furniture.find((item) => item.id === id);
  if (!furniture) return;
  state.selection = { kind: 'furniture', id };
  state.focusRequest = {
    x: furniture.x,
    y: furniture.y,
    zoom,
    token: ++focusSeq,
    furnitureId: id,
  };
}

export function requestFit(): void {
  const furniture = state.project.furniture[0];
  state.focusRequest = {
    x: furniture?.x ?? 5,
    y: furniture?.y ?? 3.5,
    token: ++focusSeq,
    zoom: undefined,
  };
}

export function revealSearchHit(hit: SearchHit): void {
  state.searchOpen = false;
  state.selection = { kind: 'furniture', id: hit.furnitureId };
  state.highlight = {
    furnitureId: hit.furnitureId,
    itemId: hit.itemId,
    itemName: hit.itemId ? hit.itemName : hit.furnitureName,
    token: ++highlightSeq,
  };
  const furniture = state.project.furniture.find((item) => item.id === hit.furnitureId);
  if (furniture) {
    state.focusRequest = {
      x: furniture.x,
      y: furniture.y,
      zoom: 120,
      token: ++focusSeq,
      furnitureId: furniture.id,
    };
  }
  pushToast(
    hit.itemId
      ? `「${hit.itemName}」在 ${hit.furnitureName}`
      : `已定位 ${hit.furnitureName}`,
    'success',
  );
}

export function highlightStoredItem(furnitureId: string, itemId: string, itemName: string): void {
  state.selection = { kind: 'furniture', id: furnitureId };
  state.highlight = {
    furnitureId,
    itemId,
    itemName,
    token: ++highlightSeq,
  };
  const furniture = state.project.furniture.find((item) => item.id === furnitureId);
  if (furniture) {
    state.focusRequest = {
      x: furniture.x,
      y: furniture.y,
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
  return searchProject(state.project, state.searchQuery);
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
  }, 3200);
}

export function dismissToast(id: string): void {
  const index = state.toasts.findIndex((toast) => toast.id === id);
  if (index >= 0) state.toasts.splice(index, 1);
}

export function markSaved(revision: number, updatedAt: string): void {
  state.project.revision = revision;
  state.project.updatedAt = updatedAt;
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
    const response = await fetch('/api/project', { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const project = (await response.json()) as Project;
    replaceProject(project);
    state.sync = 'saved';
  } catch {
    const local = readLocal();
    replaceProject(local ?? createDemoProject());
    state.sync = 'offline';
    pushToast('未连接到同步服务，当前修改会保存在本机', 'warn');
  } finally {
    state.ready = true;
  }
}

export function startNewProject(): void {
  replaceProject(createStarterProject('新的家'), { pushUndo: true });
  state.selection = null;
  state.highlight = null;
  setTool('select');
  state.sync = 'saving';
  syncRequester?.();
  pushToast('已创建 8 × 6 m 的新空间，撤销可恢复上一版', 'success');
}

export function setZoom(zoom: number): void {
  state.zoom = zoom;
}

export function useWorkspace() {
  return {
    state,
    selectedFurniture,
    selectedWall,
    selectedOpening,
    highlightedFurniture,
    searchHits,
  };
}
