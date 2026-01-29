import { describe, it, expect, beforeEach } from 'vitest';
import {
  signContent,
  verifyContent,
  ContentStore,
  createContentStore,
} from '../../src/core/content.js';
import type { ContentSignature } from '../../src/types.js';

describe('signContent', () => {
  it('creates signature for content', () => {
    const sig = signContent('Hello world', {
      id: 'msg_1',
      identity: 'alice',
    });

    expect(sig.id).toBe('msg_1');
    expect(sig.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(sig.algorithm).toBe('sha256');
    expect(sig.signedBy).toBe('alice');
    expect(sig.signedAt).toBeTruthy();
    expect(sig.contentLength).toBe(Buffer.byteLength('Hello world', 'utf8'));
  });

  it('includes metadata in signature', () => {
    const sig = signContent('Test message', {
      id: 'msg_2',
      identity: 'owner:+1234567890:whatsapp',
      metadata: { channel: 'whatsapp', timestamp: '2025-01-29T12:00:00Z' },
    });

    expect(sig.metadata).toEqual({
      channel: 'whatsapp',
      timestamp: '2025-01-29T12:00:00Z',
    });
  });

  it('produces deterministic hash for same content', () => {
    const sig1 = signContent('Same content', { id: 'a', identity: 'alice' });
    const sig2 = signContent('Same content', { id: 'b', identity: 'bob' });

    expect(sig1.hash).toBe(sig2.hash);
  });

  it('produces different hash for different content', () => {
    const sig1 = signContent('Content A', { id: 'a', identity: 'alice' });
    const sig2 = signContent('Content B', { id: 'b', identity: 'alice' });

    expect(sig1.hash).not.toBe(sig2.hash);
  });

  it('uses byte length for non-ASCII content', () => {
    const content = 'Hello 🌍';
    const sig = signContent(content, { id: 'emoji', identity: 'alice' });

    // '🌍' is 4 bytes in UTF-8
    expect(sig.contentLength).toBe(Buffer.byteLength(content, 'utf8'));
    expect(sig.contentLength).toBeGreaterThan(content.length);
  });
});

describe('verifyContent', () => {
  let signature: ContentSignature;
  const content = 'Original message';

  beforeEach(() => {
    signature = signContent(content, { id: 'msg', identity: 'alice' });
  });

  it('verifies unmodified content', () => {
    const result = verifyContent(content, signature);
    expect(result.verified).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('fails verification for modified content', () => {
    const result = verifyContent('Modified message', signature);
    expect(result.verified).toBe(false);
    expect(result.error).toBe('Content hash mismatch');
  });

  it('fails verification for empty content when original was not empty', () => {
    const result = verifyContent('', signature);
    expect(result.verified).toBe(false);
  });
});

describe('ContentStore', () => {
  let store: ContentStore;

  beforeEach(() => {
    store = new ContentStore();
  });

  describe('sign', () => {
    it('signs and stores content', () => {
      const sig = store.sign('Test message', {
        id: 'msg_1',
        identity: 'alice',
      });

      expect(sig.id).toBe('msg_1');
      expect(store.has('msg_1')).toBe(true);
    });

    it('overwrites existing signature with same id', () => {
      store.sign('First message', { id: 'msg', identity: 'alice' });
      const sig2 = store.sign('Second message', { id: 'msg', identity: 'bob' });

      expect(store.size).toBe(1);
      expect(store.get('msg')?.signedBy).toBe('bob');
      expect(store.get('msg')?.hash).toBe(sig2.hash);
    });
  });

  describe('verify', () => {
    it('verifies stored content by id', () => {
      store.sign('Hello world', {
        id: 'msg_1',
        identity: 'owner:+1234:whatsapp',
        metadata: { channel: 'whatsapp' },
      });

      const result = store.verify('msg_1');

      expect(result.verified).toBe(true);
      expect(result.id).toBe('msg_1');
      expect(result.content).toBe('Hello world');
      expect(result.signature?.signedBy).toBe('owner:+1234:whatsapp');
      expect(result.signature?.metadata?.channel).toBe('whatsapp');
    });

    it('fails for unknown id', () => {
      const result = store.verify('unknown');

      expect(result.verified).toBe(false);
      expect(result.error).toBe('No signature found for id');
    });

    it('returns full provenance info', () => {
      store.sign('Delete all files', {
        id: 'cmd_1',
        identity: 'owner:+1234567890:whatsapp',
        metadata: {
          channel: 'whatsapp',
          from: '+1234567890',
          timestamp: '2025-01-29T12:00:00Z',
        },
      });

      const result = store.verify('cmd_1');

      expect(result.verified).toBe(true);
      expect(result.signature?.metadata).toEqual({
        channel: 'whatsapp',
        from: '+1234567890',
        timestamp: '2025-01-29T12:00:00Z',
      });
    });
  });

  describe('list', () => {
    it('returns empty array for empty store', () => {
      expect(store.list()).toEqual([]);
    });

    it('returns all signatures', () => {
      store.sign('Message 1', { id: 'a', identity: 'alice' });
      store.sign('Message 2', { id: 'b', identity: 'bob' });

      const list = store.list();
      expect(list).toHaveLength(2);
      expect(list.map((s) => s.id).sort()).toEqual(['a', 'b']);
    });
  });

  describe('get', () => {
    it('returns signature by id', () => {
      store.sign('Test', { id: 'msg', identity: 'alice' });
      const sig = store.get('msg');

      expect(sig?.id).toBe('msg');
      expect(sig?.signedBy).toBe('alice');
    });

    it('returns undefined for unknown id', () => {
      expect(store.get('unknown')).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('removes signature and returns true', () => {
      store.sign('Test', { id: 'msg', identity: 'alice' });

      const deleted = store.delete('msg');

      expect(deleted).toBe(true);
      expect(store.has('msg')).toBe(false);
      expect(store.verify('msg').verified).toBe(false);
    });

    it('returns false for unknown id', () => {
      expect(store.delete('unknown')).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all signatures', () => {
      store.sign('A', { id: 'a', identity: 'alice' });
      store.sign('B', { id: 'b', identity: 'bob' });

      store.clear();

      expect(store.size).toBe(0);
      expect(store.list()).toEqual([]);
    });
  });

  describe('has', () => {
    it('returns true for existing id', () => {
      store.sign('Test', { id: 'msg', identity: 'alice' });
      expect(store.has('msg')).toBe(true);
    });

    it('returns false for unknown id', () => {
      expect(store.has('unknown')).toBe(false);
    });
  });

  describe('size', () => {
    it('returns number of signatures', () => {
      expect(store.size).toBe(0);

      store.sign('A', { id: 'a', identity: 'alice' });
      expect(store.size).toBe(1);

      store.sign('B', { id: 'b', identity: 'bob' });
      expect(store.size).toBe(2);

      store.delete('a');
      expect(store.size).toBe(1);
    });
  });
});

describe('createContentStore', () => {
  it('creates new ContentStore instance', () => {
    const store = createContentStore();
    expect(store).toBeInstanceOf(ContentStore);
    expect(store.size).toBe(0);
  });

  it('creates independent stores', () => {
    const store1 = createContentStore();
    const store2 = createContentStore();

    store1.sign('Test', { id: 'msg', identity: 'alice' });

    expect(store1.has('msg')).toBe(true);
    expect(store2.has('msg')).toBe(false);
  });
});

describe('integration: sign and verify round-trip', () => {
  it('complete workflow for message verification', () => {
    // Simulate orchestrator receiving authenticated message
    const store = createContentStore();

    // 1. Owner sends message via WhatsApp (authenticated)
    const messageContent = 'delete all my files';
    const messageId = 'msg_12345';

    // 2. Orchestrator signs the message with provenance
    const sig = store.sign(messageContent, {
      id: messageId,
      identity: 'owner:+1234567890:whatsapp',
      metadata: {
        channel: 'whatsapp',
        from: '+1234567890',
        timestamp: new Date().toISOString(),
      },
    });

    expect(sig.id).toBe(messageId);

    // 3. LLM calls verify to check message provenance
    const result = store.verify(messageId);

    expect(result.verified).toBe(true);
    expect(result.content).toBe(messageContent);
    expect(result.signature?.signedBy).toBe('owner:+1234567890:whatsapp');
    expect(result.signature?.metadata?.channel).toBe('whatsapp');

    // 4. Attacker cannot spoof - unknown messages fail verification
    const attackResult = store.verify('fake_msg_id');
    expect(attackResult.verified).toBe(false);
  });
});
