import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { storeSig, loadSig, loadSignedContent, deleteSig, listSigs } from '../../src/core/store.js';
import { createSigContext } from '../../src/core/fs.js';
import type { SigContext, Signature } from '../../src/types.js';

describe('store', () => {
  let sigDir: string;
  let ctx: SigContext;

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
    ctx = createSigContext('.', { sigDir });
  });

  afterEach(async () => {
    await rm(sigDir, { recursive: true, force: true });
  });

  it('stores and loads a signature', async () => {
    const sig = makeSig('prompts/test.txt');
    await storeSig(ctx, sig, 'test content');

    const { signature: loaded } = await loadSig(ctx, 'prompts/test.txt');
    expect(loaded).toEqual(sig);
  });

  it('stores and loads signed content', async () => {
    const sig = makeSig('prompts/test.txt');
    await storeSig(ctx, sig, 'the signed content');

    const content = await loadSignedContent(ctx, 'prompts/test.txt');
    expect(content).toBe('the signed content');
  });

  it('returns not-found for missing signature', async () => {
    const { signature, error } = await loadSig(ctx, 'nonexistent.txt');
    expect(signature).toBeNull();
    expect(error).toBe('not-found');
  });

  it('returns corrupted for invalid JSON signature', async () => {
    const sigPath = join(sigDir, 'sigs', 'bad.txt.sig.json');
    await mkdir(join(sigDir, 'sigs'), { recursive: true });
    await writeFile(sigPath, 'NOT VALID JSON{{{', 'utf8');

    const { signature, error } = await loadSig(ctx, 'bad.txt');
    expect(signature).toBeNull();
    expect(error).toBe('corrupted');
  });

  it('deletes signature and content', async () => {
    const sig = makeSig('prompts/test.txt');
    await storeSig(ctx, sig, 'content');
    await deleteSig(ctx, 'prompts/test.txt');

    const { signature } = await loadSig(ctx, 'prompts/test.txt');
    expect(signature).toBeNull();

    const content = await loadSignedContent(ctx, 'prompts/test.txt');
    expect(content).toBeNull();
  });

  it('lists all signatures', async () => {
    await storeSig(ctx, makeSig('a.txt'), 'a');
    await storeSig(ctx, makeSig('dir/b.txt'), 'b');

    const sigs = await listSigs(ctx);
    expect(sigs).toHaveLength(2);

    const files = sigs.map((s) => s.file).sort();
    expect(files).toEqual(['a.txt', 'dir/b.txt']);
  });

  it('returns empty list when no sigs dir', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'sig-empty-'));
    const emptyCtx = createSigContext('.', { sigDir: emptyDir });
    const sigs = await listSigs(emptyCtx);
    expect(sigs).toHaveLength(0);
    await rm(emptyDir, { recursive: true, force: true });
  });

  it('accepts legacy string sigDir arguments', async () => {
    const sig = makeSig('legacy.txt');
    await storeSig(sigDir, sig, 'legacy content');

    const loaded = await loadSig(sigDir, 'legacy.txt');
    expect(loaded.signature?.file).toBe('legacy.txt');

    const content = await loadSignedContent(sigDir, 'legacy.txt');
    expect(content).toBe('legacy content');

    const all = await listSigs(sigDir);
    expect(all.some((item) => item.file === 'legacy.txt')).toBe(true);
  });
});
