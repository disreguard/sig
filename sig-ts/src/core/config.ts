import { join } from 'node:path';
import { NodeFS } from './fs.js';
import type { SigConfig, SigFS, TemplateEngine } from '../types.js';

const SIG_DIR = '.sig';
const CONFIG_FILE = 'config.json';

export const DEFAULT_CONFIG: SigConfig = {
  version: 1,
};

export interface ConfigIOOptions {
  fs?: SigFS;
}

export function sigDir(projectRoot: string): string {
  return join(projectRoot, SIG_DIR);
}

export function configPath(projectRoot: string): string {
  return join(projectRoot, SIG_DIR, CONFIG_FILE);
}

export async function loadConfig(projectRoot: string, options?: ConfigIOOptions): Promise<SigConfig> {
  const fs = options?.fs ?? new NodeFS();
  try {
    const raw = await fs.readFile(configPath(projectRoot), 'utf8');
    return JSON.parse(raw) as SigConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(
  projectRoot: string,
  config: SigConfig,
  options?: ConfigIOOptions
): Promise<void> {
  const fs = options?.fs ?? new NodeFS();
  const dir = sigDir(projectRoot);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(configPath(projectRoot), JSON.stringify(config, null, 2) + '\n', 'utf8');
}

export async function initProject(
  projectRoot: string,
  options?: { engine?: TemplateEngine | TemplateEngine[]; identity?: string; fs?: SigFS }
): Promise<SigConfig> {
  const fs = options?.fs ?? new NodeFS();
  const dir = sigDir(projectRoot);
  await fs.mkdir(join(dir, 'sigs'), { recursive: true });

  const config: SigConfig = {
    version: 1,
  };

  if (options?.engine) {
    config.templates = { engine: options.engine };
  }

  if (options?.identity) {
    config.sign = { identity: options.identity };
  }

  await saveConfig(projectRoot, config, { fs });
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
