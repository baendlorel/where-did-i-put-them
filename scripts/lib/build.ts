import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import {
  packagedWebDir,
  pnpm,
  rootDir,
  serverDir,
  serverDistDir,
  webDistDir,
} from './process';

interface PackageJson {
  name: string;
  version: string;
  private?: boolean;
  bin?: Record<string, string>;
  files?: string[];
}

function fail(message: string): never {
  throw new Error(`[package] ${message}`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function directorySize(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    const target = path.join(dir, entry.name);
    return total + (entry.isDirectory() ? directorySize(target) : statSync(target).size);
  }, 0);
}

/**
 * Verify the artifacts that `tsdown` is expected to produce. This runs both
 * for local builds and immediately before `npm pack`, so a broken publish is
 * caught before a tarball is created.
 */
export function verifyCliPackage(): PackageJson {
  const cliFile = path.join(serverDistDir, 'cli.js');
  const indexFile = path.join(packagedWebDir, 'index.html');
  const assetsDir = path.join(packagedWebDir, 'assets');
  const readmeFile = path.join(serverDir, 'README.md');

  for (const [label, file] of [
    ['server bundle', cliFile],
    ['web index', indexFile],
    ['CLI readme', readmeFile],
  ] as const) {
    if (!existsSync(file)) fail(`missing ${label}: ${path.relative(rootDir, file)}`);
  }
  if (!existsSync(assetsDir) || readdirSync(assetsDir).length === 0) {
    fail('frontend assets were not copied into apps/server/dist/web/assets');
  }

  const cli = readFileSync(cliFile, 'utf8');
  if (!cli.startsWith('#!/usr/bin/env node')) {
    fail('dist/cli.js is missing the Node shebang required by the wdipt binary');
  }
  if (!cli.includes('wdipt')) {
    fail('dist/cli.js does not look like the wdipt entry point');
  }
  for (const workspaceImport of ['@shijian/shared', 'polygon-clipping']) {
    if (cli.includes(workspaceImport)) {
      fail(`${workspaceImport} was left external in dist/cli.js; it must be bundled for npm`);
    }
  }
  chmodSync(cliFile, 0o755);

  const packageSource = readFileSync(path.join(serverDir, 'package.json'), 'utf8');
  if (packageSource.includes('workspace:')) {
    fail('apps/server/package.json still contains a workspace: dependency');
  }
  const packageJson = JSON.parse(packageSource) as PackageJson;

  if (packageJson.name !== 'wdipt') fail('apps/server/package.json name must be "wdipt"');
  if (!packageJson.version) fail('apps/server/package.json is missing a version');
  if (packageJson.private) fail('the wdipt package must not be private when publishing');
  if (packageJson.bin?.wdipt !== './dist/cli.js') {
    fail('apps/server/package.json bin.wdipt must point to ./dist/cli.js');
  }
  if (!packageJson.files?.includes('dist')) {
    fail('apps/server/package.json files must include "dist"');
  }

  console.log(
    `[package] verified wdipt@${packageJson.version}: ` +
      `${formatBytes(statSync(cliFile).size)} server, ` +
      `${formatBytes(directorySize(packagedWebDir))} web`,
  );
  return packageJson;
}

/**
 * Build shared -> web -> CLI. The order matters because:
 * - web consumes the built shared package;
 * - tsdown copies apps/web/dist into the CLI bundle.
 */
export async function buildAll(): Promise<PackageJson> {
  pnpm(['--filter', '@shijian/shared', 'build']);
  pnpm(['--filter', '@shijian/web', 'build']);
  pnpm(['--filter', 'wdipt', 'build']);

  if (!existsSync(path.join(webDistDir, 'index.html'))) {
    fail('apps/web/dist/index.html is missing after the web build');
  }
  rmSync(packagedWebDir, { recursive: true, force: true });
  mkdirSync(packagedWebDir, { recursive: true });
  cpSync(webDistDir, packagedWebDir, { recursive: true });
  console.log('[package] copied apps/web/dist -> apps/server/dist/web');

  return verifyCliPackage();
}
