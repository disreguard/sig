import { dirname, join } from 'node:path';
import { formatHash, sha256 } from './hash.js';
import { logEvent } from './audit.js';
import { signContent, verifyContent } from './content.js';
import type {
  ContentSignature,
  ContentVerifyResult,
  PersistentSignOptions,
  SigConfig,
  SigContext,
} from '../types.js';

const CONTENT_DIR = 'content';
const META_EXT = '.sig.json';
const CONTENT_EXT = '.sig.content';
const CONFIG_FILE = 'config.json';

export interface PersistentVerifyOptions {
  content?: string;
  detail?: string;
}

function ensureValidId(id: string): void {
  if (!id) {
    throw new Error('Content ID cannot be empty');
  }
  if (id.includes('/') || id.includes('\\') || id.includes('..') || id.includes('\0')) {
    throw new Error(`Invalid content ID: ${id}`);
  }
}

function defaultIdentity(): string {
  return process.env.USER || process.env.USERNAME || 'unknown';
}

export class PersistentContentStore {
  constructor(private readonly ctx: SigContext) {}

  async sign(content: string, options: PersistentSignOptions): Promise<ContentSignature> {
    ensureValidId(options.id);
    const identity = await this.resolveIdentity(options);
    const signature = signContent(content, {
      id: options.id,
      identity,
      metadata: options.metadata,
    });

    await this.ctx.fs.mkdir(dirname(this.metaPath(options.id)), { recursive: true });
    await this.ctx.fs.writeFile(
      this.metaPath(options.id),
      JSON.stringify(signature, null, 2) + '\n',
      'utf8'
    );
    await this.ctx.fs.writeFile(this.contentPath(options.id), content, 'utf8');

    await logEvent(this.ctx, {
      event: 'sign',
      file: this.auditFile(options.id),
      hash: signature.hash,
      identity: signature.signedBy,
    });

    return signature;
  }

  async verify(id: string, options?: PersistentVerifyOptions): Promise<ContentVerifyResult> {
    ensureValidId(id);
    const detail = options?.detail;
    const signature = await this.load(id);
    if (!signature) {
      await this.logVerifyFailure(id, 'No signature found for id', detail);
      return { verified: false, id, error: 'No signature found for id' };
    }

    const storedContent = await this.loadContent(id);
    if (storedContent === null) {
      await this.logVerifyFailure(id, 'No content found for id', detail);
      return { verified: false, id, error: 'No content found for id' };
    }

    const storedCheck = verifyContent(storedContent, signature);
    if (!storedCheck.verified) {
      const message = storedCheck.error || 'Stored content verification failed';
      await this.logVerifyFailure(id, message, detail);
      return { verified: false, id, error: message };
    }

    if (options?.content !== undefined) {
      const inputCheck = verifyContent(options.content, signature);
      if (!inputCheck.verified) {
        const message = inputCheck.error || 'Content hash mismatch';
        await this.logVerifyFailure(id, message, detail);
        return { verified: false, id, error: message };
      }
    }

    await logEvent(this.ctx, {
      event: 'verify',
      file: this.auditFile(id),
      hash: signature.hash,
      ...(detail ? { detail } : {}),
    });

    return {
      verified: true,
      id,
      content: storedContent,
      signature,
    };
  }

  async signIfChanged(content: string, options: PersistentSignOptions): Promise<ContentSignature> {
    ensureValidId(options.id);
    const existing = await this.load(options.id);
    const nextHash = formatHash(sha256(content));
    if (existing && existing.hash === nextHash) {
      const existingContent = await this.loadContent(options.id);
      if (existingContent === null) {
        await this.ctx.fs.mkdir(dirname(this.contentPath(options.id)), { recursive: true });
        await this.ctx.fs.writeFile(this.contentPath(options.id), content, 'utf8');
      }
      return existing;
    }
    return this.sign(content, options);
  }

  async load(id: string): Promise<ContentSignature | null> {
    ensureValidId(id);
    try {
      const raw = await this.ctx.fs.readFile(this.metaPath(id), 'utf8');
      const parsed = JSON.parse(raw) as Partial<ContentSignature>;
      if (
        typeof parsed.id !== 'string'
        || typeof parsed.hash !== 'string'
        || parsed.algorithm !== 'sha256'
        || typeof parsed.signedBy !== 'string'
        || typeof parsed.signedAt !== 'string'
        || typeof parsed.contentLength !== 'number'
      ) {
        return null;
      }
      return parsed as ContentSignature;
    } catch {
      return null;
    }
  }

  async loadContent(id: string): Promise<string | null> {
    ensureValidId(id);
    try {
      return await this.ctx.fs.readFile(this.contentPath(id), 'utf8');
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    ensureValidId(id);
    const hadSig = await this.has(id);
    try {
      await this.ctx.fs.unlink(this.metaPath(id));
    } catch {
      // ignore delete errors
    }
    try {
      await this.ctx.fs.unlink(this.contentPath(id));
    } catch {
      // ignore delete errors
    }
    return hadSig;
  }

  async list(): Promise<ContentSignature[]> {
    const dir = join(this.ctx.sigDir, CONTENT_DIR);
    try {
      await this.ctx.fs.access(dir);
    } catch {
      return [];
    }

    const entries = await this.ctx.fs.readdir(dir, { withFileTypes: true });
    const signatures: ContentSignature[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() || !entry.name.endsWith(META_EXT)) {
        continue;
      }
      const id = entry.name.slice(0, -META_EXT.length);
      const signature = await this.load(id);
      if (signature) {
        signatures.push(signature);
      }
    }

    return signatures;
  }

  async has(id: string): Promise<boolean> {
    ensureValidId(id);
    try {
      await this.ctx.fs.access(this.metaPath(id));
      return true;
    } catch {
      return false;
    }
  }

  private async resolveIdentity(options: PersistentSignOptions): Promise<string> {
    if (options.identity) {
      return options.identity;
    }
    const configIdentity = await this.loadConfigIdentity();
    return configIdentity || defaultIdentity();
  }

  private async loadConfigIdentity(): Promise<string | undefined> {
    try {
      const raw = await this.ctx.fs.readFile(join(this.ctx.sigDir, CONFIG_FILE), 'utf8');
      const config = JSON.parse(raw) as SigConfig;
      return typeof config.sign?.identity === 'string' ? config.sign.identity : undefined;
    } catch {
      return undefined;
    }
  }

  private metaPath(id: string): string {
    return join(this.ctx.sigDir, CONTENT_DIR, id + META_EXT);
  }

  private contentPath(id: string): string {
    return join(this.ctx.sigDir, CONTENT_DIR, id + CONTENT_EXT);
  }

  private auditFile(id: string): string {
    return `content:${id}`;
  }

  private async logVerifyFailure(id: string, reason: string, detail?: string): Promise<void> {
    await logEvent(this.ctx, {
      event: 'verify-fail',
      file: this.auditFile(id),
      detail: detail ? `${detail}: ${reason}` : reason,
    });
  }
}
