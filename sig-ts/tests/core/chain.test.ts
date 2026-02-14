import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appendChainEntry, readChain, getChainHead, validateChain } from '../../src/core/chain.js';
import { createSigContext } from '../../src/core/fs.js';
import type { ChainEntry, SigContext } from '../../src/types.js';

function makeEntry(overrides: Partial<ChainEntry> = {}): ChainEntry {
  return {
    hash: 'sha256:abc123',
    previousHash: 'sha256:000000',
    signedBy: 'owner:adam',
    signedAt: new Date().toISOString(),
    contentLength: 100,
    provenance: {
      sourceType: 'signed_message',
      reason: 'test update',
    },
    ...overrides,
  };
}

describe('chain', () => {
  let sigDir: string;
  let ctx: SigContext;

  beforeEach(async () => {
    sigDir = await mkdtemp(join(tmpdir(), 'sig-chain-test-'));
    ctx = createSigContext('.', { sigDir });
  });

  afterEach(async () => {
    await rm(sigDir, { recursive: true, force: true });
  });

  it('appends and reads chain entries', async () => {
    const entry1 = makeEntry({ hash: 'sha256:aaa', previousHash: 'sha256:000' });
    const entry2 = makeEntry({ hash: 'sha256:bbb', previousHash: 'sha256:aaa' });

    await appendChainEntry(ctx, 'soul.md', entry1);
    await appendChainEntry(ctx, 'soul.md', entry2);

    const entries = await readChain(ctx, 'soul.md');
    expect(entries).toHaveLength(2);
    expect(entries[0].hash).toBe('sha256:aaa');
    expect(entries[1].hash).toBe('sha256:bbb');
  });

  it('returns empty array for nonexistent chain', async () => {
    const entries = await readChain(ctx, 'nonexistent.md');
    expect(entries).toEqual([]);
  });

  it('gets chain head', async () => {
    const entry1 = makeEntry({ hash: 'sha256:aaa', previousHash: 'sha256:000' });
    const entry2 = makeEntry({ hash: 'sha256:bbb', previousHash: 'sha256:aaa', signedBy: 'owner:bob' });

    await appendChainEntry(ctx, 'soul.md', entry1);
    await appendChainEntry(ctx, 'soul.md', entry2);

    const head = await getChainHead(ctx, 'soul.md');
    expect(head).not.toBeNull();
    expect(head!.hash).toBe('sha256:bbb');
    expect(head!.signedBy).toBe('owner:bob');
  });

  it('returns null head for empty chain', async () => {
    const head = await getChainHead(ctx, 'nonexistent.md');
    expect(head).toBeNull();
  });

  it('validates intact chain', async () => {
    const entry1 = makeEntry({ hash: 'sha256:aaa', previousHash: 'sha256:000' });
    const entry2 = makeEntry({ hash: 'sha256:bbb', previousHash: 'sha256:aaa' });
    const entry3 = makeEntry({ hash: 'sha256:ccc', previousHash: 'sha256:bbb' });

    await appendChainEntry(ctx, 'soul.md', entry1);
    await appendChainEntry(ctx, 'soul.md', entry2);
    await appendChainEntry(ctx, 'soul.md', entry3);

    const result = await validateChain(ctx, 'soul.md');
    expect(result.valid).toBe(true);
    expect(result.length).toBe(3);
  });

  it('detects broken chain', async () => {
    const entry1 = makeEntry({ hash: 'sha256:aaa', previousHash: 'sha256:000' });
    const entry2 = makeEntry({ hash: 'sha256:bbb', previousHash: 'sha256:WRONG' });

    await appendChainEntry(ctx, 'soul.md', entry1);
    await appendChainEntry(ctx, 'soul.md', entry2);

    const result = await validateChain(ctx, 'soul.md');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/broken/i);
  });

  it('validates empty chain as valid', async () => {
    const result = await validateChain(ctx, 'nonexistent.md');
    expect(result.valid).toBe(true);
    expect(result.length).toBe(0);
  });

  it('handles nested file paths', async () => {
    const entry = makeEntry();
    await appendChainEntry(ctx, 'llm/prompts/review.txt', entry);

    const entries = await readChain(ctx, 'llm/prompts/review.txt');
    expect(entries).toHaveLength(1);
  });

  it('accepts legacy string sigDir arguments', async () => {
    const entry = makeEntry({ hash: 'sha256:legacy', previousHash: 'sha256:base' });
    await appendChainEntry(sigDir, 'legacy.md', entry);

    const entries = await readChain(sigDir, 'legacy.md');
    expect(entries).toHaveLength(1);

    const head = await getChainHead(sigDir, 'legacy.md');
    expect(head?.hash).toBe('sha256:legacy');

    const validation = await validateChain(sigDir, 'legacy.md');
    expect(validation.valid).toBe(true);
  });
});
