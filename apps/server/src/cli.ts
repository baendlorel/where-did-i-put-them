#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { startServer } from './start.js';

interface PackageJson {
  version?: string;
}

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as PackageJson;

const HELP = `wdipt ${packageJson.version ?? ''}
拾间 — 居家平面建模与物品记忆工作台

Usage:
  wdipt [options]

Options:
  -p, --port <port>       HTTP 端口（默认 8787）
      --host <host>       监听地址（默认 0.0.0.0）
      --data-dir <dir>    项目数据目录（默认当前仓库 data 或 ~/.wdipt）
      --web-dist <dir>    自定义前端构建目录
  -v, --version           显示版本
  -h, --help              显示帮助

Environment:
  PORT, HOST, DATA_DIR, WEB_DIST

Examples:
  wdipt
  wdipt --port 9000
  wdipt --data-dir ./my-home-data
  npx wdipt --port 3000`;

let values: {
  port?: string;
  host?: string;
  'data-dir'?: string;
  'web-dist'?: string;
  help?: boolean;
  version?: boolean;
};

try {
  ({ values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      port: { type: 'string', short: 'p' },
      host: { type: 'string' },
      'data-dir': { type: 'string' },
      'web-dist': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
    strict: true,
    allowPositionals: false,
  }));
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
  console.error(HELP);
  process.exit(1);
}

if (values.help) {
  console.log(HELP);
  process.exit(0);
}

if (values.version) {
  console.log(packageJson.version ?? '0.0.0');
  process.exit(0);
}

const port = values.port === undefined ? undefined : Number(values.port);
if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535)) {
  console.error(`Invalid port: ${values.port}`);
  process.exit(1);
}

if (values.host) process.env.HOST = values.host;
if (values['data-dir']) process.env.DATA_DIR = values['data-dir'];
if (values['web-dist']) process.env.WEB_DIST = values['web-dist'];

try {
  await startServer({ port, host: values.host });
} catch (error) {
  console.error(`wdipt failed to start: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
