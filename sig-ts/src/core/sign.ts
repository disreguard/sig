import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sha256, formatHash } from './hash.js';
import { storeSig } from './store.js';
import { logEvent } from './audit.js';
import { loadConfig, sigDir } from './config.js';
import { resolveContainedPath } from './paths.js';
import type { Signature } from '../types.js';

export interface SignOptions {
  identity?: string;
  engine?: string;
}

export async function signFile(
  projectRoot: string,
  filePath: string,
  options?: SignOptions
): Promise<Signature> {
  const config = await loadConfig(projectRoot);
  const relPath = resolveContainedPath(projectRoot, filePath);
  const absPath = resolve(projectRoot, relPath);
  const content = await readFile(absPath, 'utf8');
  const hex = sha256(content);

  const identity = options?.identity || config.sign?.identity || defaultIdentity();

  const sig: Signature = {
    file: relPath,
    hash: formatHash(hex),
    algorithm: 'sha256',
    signedBy: identity,
    signedAt: new Date().toISOString(),
    contentLength: Buffer.byteLength(content, 'utf8'),
  };

  const engineName = options?.engine
    || (config.templates?.engine
      ? (Array.isArray(config.templates.engine) ? config.templates.engine[0] : config.templates.engine)
      : undefined);
  if (engineName) {
    sig.templateEngine = engineName;
  }

  const dir = sigDir(projectRoot);
  await storeSig(dir, sig, content);
  await logEvent(dir, {
    event: 'sign',
    file: relPath,
    hash: sig.hash,
    identity: sig.signedBy,
  });

  return sig;
}

function defaultIdentity(): string {
  return process.env.USER || process.env.USERNAME || 'unknown';
}
