import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const serverDir = path.join(rootDir, 'apps/server');
export const webDistDir = path.join(rootDir, 'apps/web/dist');
export const serverDistDir = path.join(serverDir, 'dist');
export const packagedWebDir = path.join(serverDistDir, 'web');
export const releaseDir = path.join(rootDir, 'release');

export interface RunOptions {
  cwd?: string;
  capture?: boolean;
}

function quoteWindowsArgument(value: string): string {
  if (!/[\s"&|<>^]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function run(command: string, args: string[], options: RunOptions = {}): string {
  if (!options.capture) {
    console.log(`\n$ ${[command, ...args].join(' ')}`);
  }
  const common = {
    cwd: options.cwd ?? rootDir,
    env: process.env,
    stdio: options.capture ? ('pipe' as const) : ('inherit' as const),
    encoding: 'utf8' as const,
  };
  const result =
    process.platform === 'win32'
      ? spawnSync([command, ...args].map(quoteWindowsArgument).join(' '), {
          ...common,
          shell: true,
        })
      : spawnSync(command, args, common);

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.status}${details ? `\n${details}` : ''}`);
  }
  return result.stdout ?? '';
}

export function pnpm(args: string[], options: RunOptions = {}): string {
  return run('pnpm', args, options);
}
