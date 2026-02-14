import {
  access as fsAccess,
  appendFile as fsAppendFile,
  mkdir as fsMkdir,
  readdir as fsReaddir,
  readFile as fsReadFile,
  unlink as fsUnlink,
  writeFile as fsWriteFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import type { Dirent, SigContext, SigFS } from '../types.js';

const SIG_DIR = '.sig';

export class NodeFS implements SigFS {
  async readFile(path: string, encoding: 'utf8'): Promise<string> {
    return fsReadFile(path, encoding);
  }

  async writeFile(path: string, content: string, encoding: 'utf8'): Promise<void> {
    await fsWriteFile(path, content, encoding);
  }

  async appendFile(path: string, content: string, encoding: 'utf8'): Promise<void> {
    await fsAppendFile(path, content, encoding);
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await fsMkdir(path, options);
  }

  async readdir(path: string, options: { withFileTypes: true }): Promise<Dirent[]> {
    return fsReaddir(path, options);
  }

  async unlink(path: string): Promise<void> {
    await fsUnlink(path);
  }

  async access(path: string): Promise<void> {
    await fsAccess(path);
  }
}

export function createSigContext(
  projectRoot: string,
  options?: { fs?: SigFS; sigDir?: string }
): SigContext {
  return {
    sigDir: options?.sigDir ?? join(projectRoot, SIG_DIR),
    fs: options?.fs ?? new NodeFS(),
  };
}

export function toSigContext(ctxOrSigDir: SigContext | string): SigContext {
  if (typeof ctxOrSigDir === 'string') {
    return {
      sigDir: ctxOrSigDir,
      fs: new NodeFS(),
    };
  }
  return ctxOrSigDir;
}
