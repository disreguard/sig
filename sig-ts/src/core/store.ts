import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import type { Signature } from '../types.js';

const SIGS_DIR = 'sigs';
const SIG_EXT = '.sig.json';
const CONTENT_EXT = '.sig.content';

function sigPath(sigDir: string, filePath: string): string {
  return join(sigDir, SIGS_DIR, filePath + SIG_EXT);
}

function contentPath(sigDir: string, filePath: string): string {
  return join(sigDir, SIGS_DIR, filePath + CONTENT_EXT);
}

export async function storeSig(sigDir: string, sig: Signature, content: string): Promise<void> {
  const metaPath = sigPath(sigDir, sig.file);
  await mkdir(dirname(metaPath), { recursive: true });
  await writeFile(metaPath, JSON.stringify(sig, null, 2) + '\n', 'utf8');
  await writeFile(contentPath(sigDir, sig.file), content, 'utf8');
}

export interface LoadSigResult {
  signature: Signature | null;
  error?: 'not-found' | 'corrupted';
}

export async function loadSig(sigDir: string, filePath: string): Promise<LoadSigResult> {
  const path = sigPath(sigDir, filePath);
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return { signature: null, error: 'not-found' };
  }
  try {
    return { signature: JSON.parse(raw) as Signature };
  } catch {
    return { signature: null, error: 'corrupted' };
  }
}

export async function loadSignedContent(sigDir: string, filePath: string): Promise<string | null> {
  try {
    return await readFile(contentPath(sigDir, filePath), 'utf8');
  } catch {
    return null;
  }
}

export async function deleteSig(sigDir: string, filePath: string): Promise<void> {
  try { await unlink(sigPath(sigDir, filePath)); } catch { /* ignore */ }
  try { await unlink(contentPath(sigDir, filePath)); } catch { /* ignore */ }
}

export async function listSigs(sigDir: string): Promise<Signature[]> {
  const sigsRoot = join(sigDir, SIGS_DIR);
  if (!existsSync(sigsRoot)) return [];

  const sigs: Signature[] = [];
  await walkDir(sigsRoot, async (filePath) => {
    if (!filePath.endsWith(SIG_EXT)) return;
    try {
      const raw = await readFile(filePath, 'utf8');
      sigs.push(JSON.parse(raw) as Signature);
    } catch {
      // skip invalid sig files
    }
  });

  return sigs;
}

async function walkDir(dir: string, callback: (path: string) => Promise<void>): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(fullPath, callback);
    } else {
      await callback(fullPath);
    }
  }
}
