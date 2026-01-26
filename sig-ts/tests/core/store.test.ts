import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { storeSig, loadSig, loadSignedContent, deleteSig, listSigs } from '../../src/core/store.js';
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
    await storeSig(sigDir, sig, 'test content');

    const { signature: loaded } = await loadSig(sigDir, 'prompts/test.txt');
    expect(loaded).toEqual(sig);
  });

  it('stores and loads signed content', async () => {
    const sig = makeSig('prompts/test.txt');
    await storeSig(sigDir, sig, 'the signed content');

    const content = await loadSignedContent(sigDir, 'prompts/test.txt');
    expect(content).toBe('the signed content');
  });

  it('returns not-found for missing signature', async () => {
    const { signature, error } = await loadSig(sigDir, 'nonexistent.txt');
    expect(signature).toBeNull();
    expect(error).toBe('not-found');
  });

  it('returns corrupted for invalid JSON signature', async () => {
    const sigPath = join(sigDir, 'sigs', 'bad.txt.sig.json');
    await mkdir(join(sigDir, 'sigs'), { recursive: true });
    await writeFile(sigPath, 'NOT VALID JSON{{{', 'utf8');

    const { signature, error } = await loadSig(sigDir, 'bad.txt');
    expect(signature).toBeNull();
    expect(error).toBe('corrupted');
  });

  it('deletes signature and content', async () => {
    const sig = makeSig('prompts/test.txt');
    await storeSig(sigDir, sig, 'content');
    await deleteSig(sigDir, 'prompts/test.txt');

    const { signature } = await loadSig(sigDir, 'prompts/test.txt');
    expect(signature).toBeNull();

    const content = await loadSignedContent(sigDir, 'prompts/test.txt');
    expect(content).toBeNull();
  });

  it('lists all signatures', async () => {
    await storeSig(sigDir, makeSig('a.txt'), 'a');
    await storeSig(sigDir, makeSig('dir/b.txt'), 'b');

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
