import { describe, it, expect } from 'vitest';
import { resolveFilePolicy, matchesFilePattern, matchesIdentityPattern } from '../../src/core/policy.js';
import type { SigConfig } from '../../src/types.js';

describe('matchesFilePattern', () => {
  it('matches exact paths', () => {
    expect(matchesFilePattern('soul.md', 'soul.md')).toBe(true);
    expect(matchesFilePattern('soul.md', 'other.md')).toBe(false);
  });

  it('matches glob patterns in filename position', () => {
    expect(matchesFilePattern('llm/prompts/*.txt', 'llm/prompts/review.txt')).toBe(true);
    expect(matchesFilePattern('llm/prompts/*.txt', 'llm/prompts/analyze.txt')).toBe(true);
    expect(matchesFilePattern('llm/prompts/*.txt', 'llm/prompts/review.md')).toBe(false);
  });

  it('does not match files in different directories', () => {
    expect(matchesFilePattern('llm/prompts/*.txt', 'other/review.txt')).toBe(false);
    expect(matchesFilePattern('llm/prompts/*.txt', 'llm/other/review.txt')).toBe(false);
  });

  it('matches root-level globs', () => {
    expect(matchesFilePattern('*.md', 'soul.md')).toBe(true);
    expect(matchesFilePattern('*.md', 'agents.md')).toBe(true);
    expect(matchesFilePattern('*.md', 'config.json')).toBe(false);
  });
});

describe('resolveFilePolicy', () => {
  const config: SigConfig = {
    version: 1,
    files: {
      'soul.md': {
        mutable: true,
        authorizedIdentities: ['owner:*'],
        requireSignedSource: true,
      },
      'agents.md': {
        mutable: true,
        authorizedIdentities: ['owner:*'],
        requireSignedSource: true,
        requireApproval: true,
      },
      'llm/prompts/*.txt': {
        mutable: false,
      },
    },
  };

  it('returns exact match policy', () => {
    const policy = resolveFilePolicy(config, 'soul.md');
    expect(policy.mutable).toBe(true);
    expect(policy.authorizedIdentities).toEqual(['owner:*']);
    expect(policy.requireSignedSource).toBe(true);
  });

  it('returns glob match policy', () => {
    const policy = resolveFilePolicy(config, 'llm/prompts/review.txt');
    expect(policy.mutable).toBe(false);
  });

  it('returns default immutable policy when no match', () => {
    const policy = resolveFilePolicy(config, 'unknown/file.txt');
    expect(policy.mutable).toBe(false);
  });

  it('exact match wins over glob', () => {
    const cfg: SigConfig = {
      version: 1,
      files: {
        '*.md': { mutable: false },
        'soul.md': { mutable: true, authorizedIdentities: ['admin'] },
      },
    };
    const policy = resolveFilePolicy(cfg, 'soul.md');
    expect(policy.mutable).toBe(true);
    expect(policy.authorizedIdentities).toEqual(['admin']);
  });

  it('returns default when config has no files', () => {
    const cfg: SigConfig = { version: 1 };
    const policy = resolveFilePolicy(cfg, 'anything.txt');
    expect(policy.mutable).toBe(false);
  });

  it('most-specific glob wins', () => {
    const cfg: SigConfig = {
      version: 1,
      files: {
        '*.txt': { mutable: false },
        'prompts/*.txt': { mutable: true },
      },
    };
    const policy = resolveFilePolicy(cfg, 'prompts/review.txt');
    expect(policy.mutable).toBe(true);
  });
});

describe('matchesIdentityPattern', () => {
  it('matches exact identity', () => {
    expect(matchesIdentityPattern('admin', 'admin')).toBe(true);
    expect(matchesIdentityPattern('admin', 'user')).toBe(false);
  });

  it('matches prefix wildcard', () => {
    expect(matchesIdentityPattern('owner:*', 'owner:adam')).toBe(true);
    expect(matchesIdentityPattern('owner:*', 'owner:+1234567890:whatsapp')).toBe(true);
    expect(matchesIdentityPattern('owner:*', 'admin:adam')).toBe(false);
  });
});
