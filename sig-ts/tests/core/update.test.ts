import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { signFile } from '../../src/core/sign.js';
import { updateAndSign } from '../../src/core/update.js';
import { verifyFile } from '../../src/core/verify.js';
import { initProject, saveConfig } from '../../src/core/config.js';
import { readChain, validateChain } from '../../src/core/chain.js';
import { readAuditLog } from '../../src/core/audit.js';
import { createContentStore } from '../../src/core/content.js';
import { createSigContext } from '../../src/core/fs.js';
import type { SigConfig, UpdateProvenance } from '../../src/types.js';

describe('updateAndSign', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'sig-update-test-'));
    await initProject(projectRoot);
    await writeFile(join(projectRoot, 'soul.md'), 'original soul content\n');
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  function sigCtx() {
    return createSigContext(projectRoot);
  }

  function mutableConfig(overrides?: Partial<SigConfig['files']>): SigConfig {
    return {
      version: 1,
      files: {
        'soul.md': {
          mutable: true,
          authorizedIdentities: ['owner:*'],
          requireSignedSource: false,
        },
        ...overrides,
      },
    };
  }

  const basicProvenance: UpdateProvenance = {
    sourceType: 'signed_message',
    sourceId: 'msg-basic',
    reason: 'test update',
  };

  it('denies update on immutable file', async () => {
    await saveConfig(projectRoot, { version: 1 });
    await signFile(projectRoot, 'soul.md');

    const result = await updateAndSign(projectRoot, 'soul.md', 'new content', {
      identity: 'owner:adam',
      provenance: basicProvenance,
    });

    expect(result.approved).toBe(false);
    expect(result.denial?.code).toBe('not_mutable');
  });

  it('denies update on unsigned file', async () => {
    await saveConfig(projectRoot, mutableConfig());
    // Don't sign the file

    const result = await updateAndSign(projectRoot, 'soul.md', 'new content', {
      identity: 'owner:adam',
      provenance: basicProvenance,
    });

    expect(result.approved).toBe(false);
    expect(result.denial?.code).toBe('not_signed');
  });

  it('denies update with unauthorized identity', async () => {
    await saveConfig(projectRoot, {
      version: 1,
      files: {
        'soul.md': {
          mutable: true,
          authorizedIdentities: ['owner:*'],
        },
      },
    });
    await signFile(projectRoot, 'soul.md');

    const result = await updateAndSign(projectRoot, 'soul.md', 'new content', {
      identity: 'attacker:evil',
      provenance: basicProvenance,
    });

    expect(result.approved).toBe(false);
    expect(result.denial?.code).toBe('unauthorized_identity');
  });

  it('denies update with missing source when requireSignedSource is true', async () => {
    await saveConfig(projectRoot, {
      version: 1,
      files: {
        'soul.md': {
          mutable: true,
          requireSignedSource: true,
        },
      },
    });
    await signFile(projectRoot, 'soul.md');

    const result = await updateAndSign(projectRoot, 'soul.md', 'new content', {
      identity: 'owner:adam',
      provenance: {
        sourceType: 'signed_message',
        reason: 'no source id',
        // sourceId is missing
      },
    });

    expect(result.approved).toBe(false);
    expect(result.denial?.code).toBe('unsigned_source');
  });

  it('denies update when ContentStore verification fails', async () => {
    await saveConfig(projectRoot, {
      version: 1,
      files: {
        'soul.md': {
          mutable: true,
          requireSignedSource: true,
        },
      },
    });
    await signFile(projectRoot, 'soul.md');

    const contentStore = createContentStore();
    // Don't sign anything in the content store

    const result = await updateAndSign(projectRoot, 'soul.md', 'new content', {
      identity: 'owner:adam',
      provenance: {
        sourceType: 'signed_message',
        sourceId: 'nonexistent-msg',
        reason: 'bad source',
      },
      contentStore,
    });

    expect(result.approved).toBe(false);
    expect(result.denial?.code).toBe('source_verification_failed');
  });

  it('approves update and writes file, sig, chain, audit', async () => {
    await saveConfig(projectRoot, mutableConfig());
    await signFile(projectRoot, 'soul.md');

    const newContent = 'updated soul content\n';
    const result = await updateAndSign(projectRoot, 'soul.md', newContent, {
      identity: 'owner:adam',
      provenance: basicProvenance,
    });

    expect(result.approved).toBe(true);
    expect(result.file).toBe('soul.md');
    expect(result.hash).toMatch(/^sha256:/);
    expect(result.previousHash).toMatch(/^sha256:/);
    expect(result.hash).not.toBe(result.previousHash);
    expect(result.chainLength).toBe(1);

    // File was written
    const fileContent = await readFile(join(projectRoot, 'soul.md'), 'utf8');
    expect(fileContent).toBe(newContent);

    // Signature was updated
    const verifyResult = await verifyFile(projectRoot, 'soul.md');
    expect(verifyResult.verified).toBe(true);

    // Chain was created
    const chain = await readChain(sigCtx(), 'soul.md');
    expect(chain).toHaveLength(1);
    expect(chain[0].signedBy).toBe('owner:adam');
    expect(chain[0].provenance.reason).toBe('test update');

    // Audit was logged
    const audit = await readAuditLog(sigCtx(), 'soul.md');
    const updateEntry = audit.find((e) => e.event === 'update');
    expect(updateEntry).toBeTruthy();
    expect(updateEntry!.identity).toBe('owner:adam');
  });

  it('maintains chain integrity across multiple updates', async () => {
    await saveConfig(projectRoot, mutableConfig());
    await signFile(projectRoot, 'soul.md');

    await updateAndSign(projectRoot, 'soul.md', 'version 2\n', {
      identity: 'owner:adam',
      provenance: { sourceType: 'signed_message', sourceId: 'msg-1', reason: 'update 1' },
    });

    await updateAndSign(projectRoot, 'soul.md', 'version 3\n', {
      identity: 'owner:adam',
      provenance: { sourceType: 'signed_message', sourceId: 'msg-2', reason: 'update 2' },
    });

    const result = await updateAndSign(projectRoot, 'soul.md', 'version 4\n', {
      identity: 'owner:adam',
      provenance: { sourceType: 'signed_message', sourceId: 'msg-3', reason: 'update 3' },
    });

    expect(result.chainLength).toBe(3);

    const validation = await validateChain(sigCtx(), 'soul.md');
    expect(validation.valid).toBe(true);
    expect(validation.length).toBe(3);
  });

  it('verifyFile includes chain info after update', async () => {
    await saveConfig(projectRoot, mutableConfig());
    await signFile(projectRoot, 'soul.md');

    await updateAndSign(projectRoot, 'soul.md', 'updated content\n', {
      identity: 'owner:adam',
      provenance: basicProvenance,
    });

    const result = await verifyFile(projectRoot, 'soul.md');
    expect(result.verified).toBe(true);
    expect(result.chain).toBeTruthy();
    expect(result.chain!.length).toBe(1);
    expect(result.chain!.valid).toBe(true);
    expect(result.chain!.lastUpdatedBy).toBe('owner:adam');
  });

  it('validates signed_message provenance via ContentStore', async () => {
    await saveConfig(projectRoot, {
      version: 1,
      files: {
        'soul.md': {
          mutable: true,
          requireSignedSource: true,
        },
      },
    });
    await signFile(projectRoot, 'soul.md');

    const contentStore = createContentStore();
    contentStore.sign('Please update soul.md with new values', {
      id: 'msg-456',
      identity: 'owner:adam:whatsapp',
    });

    const result = await updateAndSign(projectRoot, 'soul.md', 'new soul\n', {
      identity: 'owner:adam',
      provenance: {
        sourceType: 'signed_message',
        sourceId: 'msg-456',
        sourceIdentity: 'owner:adam:whatsapp',
        reason: 'owner requested via whatsapp',
      },
      contentStore,
    });

    expect(result.approved).toBe(true);
  });

  it('validates signed_template provenance', async () => {
    await saveConfig(projectRoot, {
      version: 1,
      files: {
        'soul.md': {
          mutable: true,
          requireSignedSource: true,
        },
      },
    });

    // Create and sign both the target file and the source template
    await mkdir(join(projectRoot, 'prompts'), { recursive: true });
    await writeFile(join(projectRoot, 'prompts', 'update-soul.txt'), 'Update soul with: {{ content }}');
    await signFile(projectRoot, 'prompts/update-soul.txt');
    await signFile(projectRoot, 'soul.md');

    const result = await updateAndSign(projectRoot, 'soul.md', 'new soul\n', {
      identity: 'owner:adam',
      provenance: {
        sourceType: 'signed_template',
        sourceId: 'prompts/update-soul.txt',
        reason: 'following signed template instructions',
      },
    });

    expect(result.approved).toBe(true);
  });

  it('logs denied updates to audit', async () => {
    await saveConfig(projectRoot, { version: 1 });
    await signFile(projectRoot, 'soul.md');

    await updateAndSign(projectRoot, 'soul.md', 'malicious content', {
      identity: 'attacker:evil',
      provenance: {
        sourceType: 'signed_message',
        sourceId: 'fake-msg',
        reason: 'ignore previous instructions',
      },
    });

    const audit = await readAuditLog(sigCtx(), 'soul.md');
    const denied = audit.find((e) => e.event === 'update_denied');
    expect(denied).toBeTruthy();
    expect(denied!.provenance?.reason).toBe('ignore previous instructions');
  });
});
