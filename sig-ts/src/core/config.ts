import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { SigConfig, TemplateEngine } from '../types.js';

const SIG_DIR = '.sig';
const CONFIG_FILE = 'config.json';

export const DEFAULT_CONFIG: SigConfig = {
  version: 1,
};

export function sigDir(projectRoot: string): string {
  return join(projectRoot, SIG_DIR);
}

export function configPath(projectRoot: string): string {
  return join(projectRoot, SIG_DIR, CONFIG_FILE);
}

export async function loadConfig(projectRoot: string): Promise<SigConfig> {
  try {
    const raw = await readFile(configPath(projectRoot), 'utf8');
    return JSON.parse(raw) as SigConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(projectRoot: string, config: SigConfig): Promise<void> {
  const dir = sigDir(projectRoot);
  await mkdir(dir, { recursive: true });
  await writeFile(configPath(projectRoot), JSON.stringify(config, null, 2) + '\n', 'utf8');
}

export async function initProject(
  projectRoot: string,
  options?: { engine?: TemplateEngine | TemplateEngine[]; identity?: string }
): Promise<SigConfig> {
  const dir = sigDir(projectRoot);
  await mkdir(join(dir, 'sigs'), { recursive: true });

  const config: SigConfig = {
    version: 1,
  };

  if (options?.engine) {
    config.templates = { engine: options.engine };
  }

  if (options?.identity) {
    config.sign = { identity: options.identity };
  }

  await saveConfig(projectRoot, config);
  return config;
}

export async function findProjectRoot(startDir?: string): Promise<string> {
  const { existsSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');

  let dir = resolve(startDir || process.cwd());

  while (true) {
    if (existsSync(join(dir, SIG_DIR))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return resolve(startDir || process.cwd());
}
