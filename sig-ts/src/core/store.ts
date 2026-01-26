import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { existsSync } from 'node:fs';
import type { Signature } from '../types.js';

const SIGS_DIR = 'sigs';
const SIG_EXT = '.sig.json';

function sigPath(sigDir: string, filePath: string): string {
  return join(sigDir, SIGS_DIR, filePath + SIG_EXT);
}

export async function storeSig(sigDir: string, sig: Signature): Promise<void> {
  const path = sigPath(sigDir, sig.file);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(sig, null, 2) + '\n', 'utf8');
}

export async function loadSig(sigDir: string, filePath: string): Promise<Signature | null> {
  const path = sigPath(sigDir, filePath);
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as Signature;
  } catch {
    return null;
  }
}

export async function deleteSig(sigDir: string, filePath: string): Promise<void> {
  const path = sigPath(sigDir, filePath);
  try {
    await unlink(path);
  } catch {
    // ignore if not found
  }
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
