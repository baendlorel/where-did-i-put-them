import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { searchProject } from '@shijian/shared';
import type { Project } from '@shijian/shared';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { ProjectStore } from './store';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * In the monorepo we keep the seed data next to the server package. When the
 * CLI is installed from npm there is no writable `data` directory inside the
 * package, so fall back to a per-user directory.
 */
const packageDataDir = path.resolve(moduleDir, '../data');
export const DEFAULT_DATA_DIR = existsSync(packageDataDir)
  ? packageDataDir
  : path.join(os.homedir(), '.wdipt');

/** `dist/web` for the published CLI, `apps/web/dist` while developing. */
const webRootCandidates = [
  path.resolve(moduleDir, 'web'),
  path.resolve(moduleDir, '../../web/dist'),
];
export const DEFAULT_WEB_ROOT = webRootCandidates.find((candidate) => existsSync(candidate)) ?? null;

interface HubClient {
  socket: WebSocket;
  alive: boolean;
  clientId: string;
}

type OutboundMessage = Record<string, unknown> & { type: string };

export class RealtimeHub {
  private clients = new Map<WebSocket, HubClient>();

  get size(): number {
    return this.clients.size;
  }

  add(socket: WebSocket): void {
    this.clients.set(socket, { socket, alive: true, clientId: '' });
    this.broadcastPresence();
  }

  remove(socket: WebSocket): void {
    this.clients.delete(socket);
    this.broadcastPresence();
  }

  setClientId(socket: WebSocket, clientId: string): void {
    const client = this.clients.get(socket);
    if (client) client.clientId = clientId;
  }

  markAlive(socket: WebSocket): void {
    const client = this.clients.get(socket);
    if (client) client.alive = true;
  }

  send(socket: WebSocket, message: OutboundMessage): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  everyone(message: OutboundMessage, except?: WebSocket): void {
    const data = JSON.stringify(message);
    for (const client of this.clients.values()) {
      if (client.socket !== except && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(data);
      }
    }
  }

  broadcastPresence(): void {
    this.everyone({ type: 'presence', clients: this.clients.size });
  }

  heartbeat(): void {
    for (const client of this.clients.values()) {
      if (!client.alive) {
        client.socket.terminate();
        this.clients.delete(client.socket);
        continue;
      }
      client.alive = false;
      try {
        client.socket.ping();
      } catch {
        client.socket.terminate();
        this.clients.delete(client.socket);
      }
    }
  }

  closeAll(): void {
    for (const client of this.clients.values()) client.socket.close(1001, 'server closing');
    this.clients.clear();
  }
}

export interface AppOptions {
  dataDir?: string;
  webRoot?: string | null;
  logger?: boolean;
}

export interface AppHandle {
  app: FastifyInstance;
  store: ProjectStore;
  hub: RealtimeHub;
  dataDir: string;
  webRoot: string | null;
}

export async function buildApp(options: AppOptions = {}): Promise<AppHandle> {
  const dataDir = options.dataDir ?? process.env.DATA_DIR ?? DEFAULT_DATA_DIR;
  const webRoot =
    options.webRoot === null
      ? null
      : options.webRoot ?? process.env.WEB_DIST ?? DEFAULT_WEB_ROOT;
  const store = await ProjectStore.open(dataDir);
  const app = Fastify({
    logger: options.logger ?? true,
    bodyLimit: 8 * 1024 * 1024,
  });
  const hub = new RealtimeHub();

  await app.register(cors, { origin: true });
  await app.register(websocket, {
    options: { maxPayload: 4 * 1024 * 1024 },
  });

  app.get('/api/health', async () => ({
    ok: true,
    clients: hub.size,
    projectId: store.get().id,
    revision: store.get().revision,
  }));

  app.get('/api/project', async () => store.get());

  app.put('/api/project', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const project = await store.replace(request.body);
      hub.everyone({ type: 'project:updated', project, origin: 'rest' });
      return project;
    } catch (error) {
      request.log.warn({ err: error }, 'Invalid project update');
      return reply.code(400).send({ error: '项目数据格式不正确' });
    }
  });

  app.get('/api/search', async (request, reply) => {
    const query = (request.query as { q?: string }).q ?? '';
    if (!query.trim()) return reply.code(400).send({ error: '缺少搜索关键词' });
    return { query, hits: searchProject(store.get(), query) };
  });

  app.get(
    '/ws',
    { websocket: true },
    (socket: WebSocket, request) => {
      hub.add(socket);
      hub.setClientId(socket, `ws_${Math.random().toString(36).slice(2, 9)}`);
      socket.on('pong', () => hub.markAlive(socket));
      socket.on('error', (error) => request.log.warn({ err: error }, 'WebSocket error'));
      socket.on('close', () => hub.remove(socket));
      socket.on('message', (raw) => {
        void (async () => {
          let message: Record<string, unknown>;
          try {
            message = JSON.parse(raw.toString()) as Record<string, unknown>;
          } catch {
            hub.send(socket, { type: 'error', message: '无法解析消息' });
            return;
          }

          if (message.type === 'ping') {
            hub.send(socket, { type: 'pong', at: Date.now() });
            return;
          }

          if (message.type === 'hello') {
            hub.setClientId(socket, String(message.clientId ?? ''));
            hub.send(socket, {
              type: 'welcome',
              project: store.get(),
              clients: hub.size,
            });
            return;
          }

          if (message.type === 'project:update') {
            try {
              const next = await store.replace(message.project);
              const requestId = message.requestId;
              hub.send(socket, {
                type: 'project:ack',
                requestId,
                revision: next.revision,
                updatedAt: next.updatedAt,
              });
              hub.everyone(
                {
                  type: 'project:updated',
                  project: next,
                  origin: message.clientId,
                  requestId,
                },
                socket,
              );
            } catch (error) {
              request.log.warn({ err: error }, 'Rejected websocket project update');
              hub.send(socket, { type: 'error', message: '项目同步失败，数据格式不正确' });
            }
          }
        })();
      });
    },
  );

  if (webRoot && existsSync(webRoot)) {
    await app.register(fastifyStatic, {
      root: webRoot,
      prefix: '/',
      wildcard: false,
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api') || request.url.startsWith('/ws')) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  } else {
    app.get('/', async () => ({
      service: 'shijian-server',
      message: '开发模式请访问 Vite 前端 http://localhost:5173',
      projectId: store.get().id,
    }));
  }

  const heartbeat = setInterval(() => hub.heartbeat(), 30000);
  heartbeat.unref();

  app.addHook('onClose', async () => {
    clearInterval(heartbeat);
    hub.closeAll();
  });

  return { app, store, hub, dataDir, webRoot };
}

export type { Project };
