import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appendChainEntry, readChain, getChainHead, validateChain } from '../../src/core/chain.js';
import type { ChainEntry } from '../../src/types.js';

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

  beforeEach(async () => {
    sigDir = await mkdtemp(join(tmpdir(), 'sig-chain-test-'));
  });

  afterEach(async () => {
    await rm(sigDir, { recursive: true, force: true });
  });

  it('appends and reads chain entries', async () => {
    const entry1 = makeEntry({ hash: 'sha256:aaa', previousHash: 'sha256:000' });
    const entry2 = makeEntry({ hash: 'sha256:bbb', previousHash: 'sha256:aaa' });

    await appendChainEntry(sigDir, 'soul.md', entry1);
    await appendChainEntry(sigDir, 'soul.md', entry2);

    const entries = await readChain(sigDir, 'soul.md');
    expect(entries).toHaveLength(2);
    expect(entries[0].hash).toBe('sha256:aaa');
    expect(entries[1].hash).toBe('sha256:bbb');
  });

  it('returns empty array for nonexistent chain', async () => {
    const entries = await readChain(sigDir, 'nonexistent.md');
    expect(entries).toEqual([]);
  });

  it('gets chain head', async () => {
    const entry1 = makeEntry({ hash: 'sha256:aaa', previousHash: 'sha256:000' });
    const entry2 = makeEntry({ hash: 'sha256:bbb', previousHash: 'sha256:aaa', signedBy: 'owner:bob' });

    await appendChainEntry(sigDir, 'soul.md', entry1);
    await appendChainEntry(sigDir, 'soul.md', entry2);

    const head = await getChainHead(sigDir, 'soul.md');
    expect(head).not.toBeNull();
    expect(head!.hash).toBe('sha256:bbb');
    expect(head!.signedBy).toBe('owner:bob');
  });

  it('returns null head for empty chain', async () => {
    const head = await getChainHead(sigDir, 'nonexistent.md');
    expect(head).toBeNull();
  });

  it('validates intact chain', async () => {
    const entry1 = makeEntry({ hash: 'sha256:aaa', previousHash: 'sha256:000' });
    const entry2 = makeEntry({ hash: 'sha256:bbb', previousHash: 'sha256:aaa' });
    const entry3 = makeEntry({ hash: 'sha256:ccc', previousHash: 'sha256:bbb' });

    await appendChainEntry(sigDir, 'soul.md', entry1);
    await appendChainEntry(sigDir, 'soul.md', entry2);
    await appendChainEntry(sigDir, 'soul.md', entry3);

    const result = await validateChain(sigDir, 'soul.md');
    expect(result.valid).toBe(true);
    expect(result.length).toBe(3);
  });

  it('detects broken chain', async () => {
    const entry1 = makeEntry({ hash: 'sha256:aaa', previousHash: 'sha256:000' });
    const entry2 = makeEntry({ hash: 'sha256:bbb', previousHash: 'sha256:WRONG' });

    await appendChainEntry(sigDir, 'soul.md', entry1);
    await appendChainEntry(sigDir, 'soul.md', entry2);

    const result = await validateChain(sigDir, 'soul.md');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/broken/i);
  });

  it('validates empty chain as valid', async () => {
    const result = await validateChain(sigDir, 'nonexistent.md');
    expect(result.valid).toBe(true);
    expect(result.length).toBe(0);
  });

  it('handles nested file paths', async () => {
    const entry = makeEntry();
    await appendChainEntry(sigDir, 'llm/prompts/review.txt', entry);

    const entries = await readChain(sigDir, 'llm/prompts/review.txt');
    expect(entries).toHaveLength(1);
  });
});
