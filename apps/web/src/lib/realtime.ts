import { createId } from '@shijian/shared';
import {
  bindSyncRequester,
  pushToast,
  replaceProject,
  setClients,
  setSync,
  state,
  markSaved,
} from '../stores/workspace';

const clientId = createId('client');
let socket: WebSocket | null = null;
let reconnectDelay = 800;
let reconnectTimer = 0;
let flushTimer = 0;
let heartbeatTimer = 0;
let requestSeq = 0;
let pendingRequestId = '';
let ackTimer = 0;
let dirty = false;
let starting = false;

function scheduleFlush(delay = 450): void {
  dirty = true;
  window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => void flush(), delay);
}

async function flush(): Promise<void> {
  if (!dirty) return;
  dirty = false;
  const payload = JSON.stringify(state.project);
  if (socket?.readyState === WebSocket.OPEN) {
    const requestId = `save_${++requestSeq}`;
    pendingRequestId = requestId;
    setSync('saving');
    socket.send(
      JSON.stringify({
        type: 'project:update',
        clientId,
        requestId,
        project: JSON.parse(payload) as unknown,
      }),
    );
    window.clearTimeout(ackTimer);
    ackTimer = window.setTimeout(() => {
      if (pendingRequestId !== requestId) return;
      pendingRequestId = '';
      dirty = true;
      setSync('offline');
      scheduleFlush(900);
    }, 4000);
    return;
  }

  try {
    setSync('saving');
    const response = await fetch('/api/project', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const project = (await response.json()) as typeof state.project;
    markSaved(project.revision, project.updatedAt);
    if (dirty) scheduleFlush(80);
  } catch {
    dirty = true;
    setSync('offline');
  }
}

function connect(): void {
  if (!starting) return;
  setSync(navigator.onLine ? 'connecting' : 'offline');
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}/ws`);
  socket = ws;

  ws.addEventListener('open', () => {
    reconnectDelay = 800;
    setSync('saved');
    ws.send(JSON.stringify({ type: 'hello', clientId }));
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, 25000);
  });

  ws.addEventListener('message', (event) => {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(String(event.data)) as Record<string, unknown>;
    } catch {
      return;
    }

    if (message.type === 'welcome') {
      setClients(Number(message.clients ?? 1));
      const remote = message.project as typeof state.project;
      if (remote && remote.revision > state.project.revision && !dirty) {
        replaceProject(remote, { remote: true });
        pushToast('已载入服务器上的最新版本', 'info');
      }
      setSync('saved');
      if (dirty) scheduleFlush(100);
      return;
    }

    if (message.type === 'presence') {
      setClients(Number(message.clients ?? 1));
      return;
    }

    if (message.type === 'project:ack') {
      if (message.requestId !== pendingRequestId) return;
      pendingRequestId = '';
      window.clearTimeout(ackTimer);
      markSaved(Number(message.revision ?? state.project.revision), String(message.updatedAt ?? new Date().toISOString()));
      if (dirty) scheduleFlush(80);
      return;
    }

    if (message.type === 'project:updated') {
      const remote = message.project as typeof state.project;
      if (!remote) return;
      if (dirty) {
        pushToast('另一处正在编辑，本机修改将在稍后保存', 'warn');
        return;
      }
      replaceProject(remote, { remote: true });
      markSaved(remote.revision, remote.updatedAt);
      pushToast('已同步另一处修改', 'info');
      return;
    }

    if (message.type === 'error') {
      setSync('error');
      dirty = true;
      pendingRequestId = '';
      window.clearTimeout(ackTimer);
      pushToast(String(message.message ?? '同步出错'), 'warn');
      scheduleFlush(1500);
    }
  });

  ws.addEventListener('close', () => {
    if (socket !== ws) return;
    socket = null;
    window.clearInterval(heartbeatTimer);
    window.clearTimeout(ackTimer);
    if (pendingRequestId) {
      pendingRequestId = '';
      dirty = true;
    }
    setSync('offline');
    window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(12000, Math.round(reconnectDelay * 1.7));
  });

  ws.addEventListener('error', () => {
    ws.close();
  });
}

function handleBeforeUnload(): void {
  if (!dirty) return;
  try {
    void fetch('/api/project', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(state.project),
      keepalive: true,
    });
  } catch {
    // Best-effort flush only.
  }
}

export function startRealtime(): void {
  if (starting) return;
  starting = true;
  bindSyncRequester(() => scheduleFlush());
  connect();
  window.addEventListener('online', () => {
    if (!socket) connect();
  });
  window.addEventListener('offline', () => setSync('offline'));
  window.addEventListener('beforeunload', handleBeforeUnload);
}

export function flushPending(): void {
  if (dirty) void flush();
}
