import { join, dirname } from 'node:path';
import type { SigContext, Signature } from '../types.js';
import { toSigContext } from './fs.js';

const SIGS_DIR = 'sigs';
const SIG_EXT = '.sig.json';
const CONTENT_EXT = '.sig.content';

function sigPath(ctx: SigContext, filePath: string): string {
  return join(ctx.sigDir, SIGS_DIR, filePath + SIG_EXT);
}

function contentPath(ctx: SigContext, filePath: string): string {
  return join(ctx.sigDir, SIGS_DIR, filePath + CONTENT_EXT);
}

export async function storeSig(
  ctxOrSigDir: SigContext | string,
  sig: Signature,
  content: string
): Promise<void> {
  const ctx = toSigContext(ctxOrSigDir);
  const metaPath = sigPath(ctx, sig.file);
  await ctx.fs.mkdir(dirname(metaPath), { recursive: true });
  await ctx.fs.writeFile(metaPath, JSON.stringify(sig, null, 2) + '\n', 'utf8');
  await ctx.fs.writeFile(contentPath(ctx, sig.file), content, 'utf8');
}

export interface LoadSigResult {
  signature: Signature | null;
  error?: 'not-found' | 'corrupted';
}

export async function loadSig(
  ctxOrSigDir: SigContext | string,
  filePath: string
): Promise<LoadSigResult> {
  const ctx = toSigContext(ctxOrSigDir);
  const path = sigPath(ctx, filePath);
  let raw: string;
  try {
    raw = await ctx.fs.readFile(path, 'utf8');
  } catch {
    return { signature: null, error: 'not-found' };
  }
  try {
    return { signature: JSON.parse(raw) as Signature };
  } catch {
    return { signature: null, error: 'corrupted' };
  }
}

export async function loadSignedContent(
  ctxOrSigDir: SigContext | string,
  filePath: string
): Promise<string | null> {
  const ctx = toSigContext(ctxOrSigDir);
  try {
    return await ctx.fs.readFile(contentPath(ctx, filePath), 'utf8');
  } catch {
    return null;
  }
}

export async function deleteSig(
  ctxOrSigDir: SigContext | string,
  filePath: string
): Promise<void> {
  const ctx = toSigContext(ctxOrSigDir);
  try { await ctx.fs.unlink(sigPath(ctx, filePath)); } catch { /* ignore */ }
  try { await ctx.fs.unlink(contentPath(ctx, filePath)); } catch { /* ignore */ }
}

export async function listSigs(ctxOrSigDir: SigContext | string): Promise<Signature[]> {
  const ctx = toSigContext(ctxOrSigDir);
  const sigsRoot = join(ctx.sigDir, SIGS_DIR);
  try {
    await ctx.fs.access(sigsRoot);
  } catch {
    return [];
  }

  const sigs: Signature[] = [];
  await walkDir(ctx, sigsRoot, async (filePath) => {
    if (!filePath.endsWith(SIG_EXT)) return;
    try {
      const raw = await ctx.fs.readFile(filePath, 'utf8');
      sigs.push(JSON.parse(raw) as Signature);
    } catch {
      // skip invalid sig files
    }
  });

  return sigs;
}

async function walkDir(
  ctx: SigContext,
  dir: string,
  callback: (path: string) => Promise<void>
): Promise<void> {
  const entries = await ctx.fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(ctx, fullPath, callback);
    } else {
      await callback(fullPath);
    }
  }
}
