import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { buildAll } from './lib/build';
import { releaseDir, rootDir, run, serverDir } from './lib/process';

interface PackFile {
  path: string;
  size: number;
}

interface PackResult {
  filename: string;
  name: string;
  version: string;
  size: number;
  unpackedSize: number;
  files: PackFile[];
}

const shouldPublish = process.argv.includes('--publish');

function parsePackOutput(stdout: string): PackResult {
  const start = stdout.indexOf('[');
  const end = stdout.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error(`Could not parse npm pack output:\n${stdout}`);
  const results = JSON.parse(stdout.slice(start, end + 1)) as PackResult[];
  const result = results[0];
  if (!result) throw new Error('npm pack did not return a package');
  return result;
}

function verifyTarballContents(result: PackResult): void {
  const files = new Set(result.files.map((file) => file.path.replace(/^\.\//, '')));
  const required = ['package.json', 'README.md', 'dist/cli.js', 'dist/web/index.html'];
  for (const file of required) {
    if (!files.has(file)) throw new Error(`Published tarball is missing ${file}`);
  }
  if (![...files].some((file) => file.startsWith('dist/web/assets/'))) {
    throw new Error('Published tarball is missing frontend assets');
  }
  console.log(`[package] tarball contains ${files.size} files (${(result.unpackedSize / 1024 / 1024).toFixed(2)} MB unpacked)`);
}

try {
  const packageJson = await buildAll();

  rmSync(releaseDir, { recursive: true, force: true });
  mkdirSync(releaseDir, { recursive: true });

  const output = run(
    'npm',
    ['pack', '--pack-destination', releaseDir, '--json'],
    { cwd: serverDir, capture: true },
  );
  const result = parsePackOutput(output);
  verifyTarballContents(result);

  const tarball = path.join(releaseDir, result.filename);
  console.log(`\n[package] created ${path.relative(rootDir, tarball)} (${(result.size / 1024).toFixed(1)} KB)`);
  console.log(`[package] install locally with: npm install -g "${tarball}"`);

  if (shouldPublish) {
    console.log(`\n[package] publishing ${packageJson.name}@${packageJson.version} to npm...`);
    run('npm', ['publish', tarball, '--access', 'public'], { cwd: releaseDir });
    console.log(`[package] published ${packageJson.name}@${packageJson.version}`);
  } else {
    console.log('[package] pack complete; rerun with `pnpm publish:npm` to publish.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
