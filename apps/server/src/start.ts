import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';

export interface StartServerOptions {
  port?: number;
  host?: string;
}

export async function startServer(options: StartServerOptions = {}): Promise<FastifyInstance> {
  const port = options.port ?? Number(process.env.PORT ?? 8787);
  const host = options.host ?? process.env.HOST ?? '0.0.0.0';

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port: ${port}`);
  }

  const { app, dataDir, webRoot } = await buildApp();

  try {
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error);
    await app.close();
    throw error;
  }

  const address = app.server.address();
  const actualPort = address && typeof address === 'object' ? address.port : port;
  const displayHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;

  app.log.info({ dataDir, webRoot }, 'wdipt storage');
  app.log.info(`wdipt ready at http://${displayHost}:${actualPort}`);

  let closing = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, 'shutting down');
    void app.close().then(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return app;
}
