import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { storeSig, loadSig, deleteSig, listSigs } from '../../src/core/store.js';
import type { Signature } from '../../src/types.js';

describe('store', () => {
  let sigDir: string;

  const makeSig = (file: string): Signature => ({
    file,
    hash: 'sha256:abc123',
    algorithm: 'sha256',
    signedBy: 'tester',
    signedAt: '2026-01-26T00:00:00Z',
    contentLength: 100,
  });

  beforeEach(async () => {
    sigDir = await mkdtemp(join(tmpdir(), 'sig-store-'));
    await mkdir(join(sigDir, 'sigs'), { recursive: true });
  });

  afterEach(async () => {
    await rm(sigDir, { recursive: true, force: true });
  });

  it('stores and loads a signature', async () => {
    const sig = makeSig('prompts/test.txt');
    await storeSig(sigDir, sig);

    const loaded = await loadSig(sigDir, 'prompts/test.txt');
    expect(loaded).toEqual(sig);
  });

  it('returns null for missing signature', async () => {
    const loaded = await loadSig(sigDir, 'nonexistent.txt');
    expect(loaded).toBeNull();
  });

  it('deletes a signature', async () => {
    const sig = makeSig('prompts/test.txt');
    await storeSig(sigDir, sig);
    await deleteSig(sigDir, 'prompts/test.txt');

    const loaded = await loadSig(sigDir, 'prompts/test.txt');
    expect(loaded).toBeNull();
  });

  it('lists all signatures', async () => {
    await storeSig(sigDir, makeSig('a.txt'));
    await storeSig(sigDir, makeSig('dir/b.txt'));

    const sigs = await listSigs(sigDir);
    expect(sigs).toHaveLength(2);

    const files = sigs.map((s) => s.file).sort();
    expect(files).toEqual(['a.txt', 'dir/b.txt']);
  });

  it('returns empty list when no sigs dir', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'sig-empty-'));
    const sigs = await listSigs(emptyDir);
    expect(sigs).toHaveLength(0);
    await rm(emptyDir, { recursive: true, force: true });
  });
});
