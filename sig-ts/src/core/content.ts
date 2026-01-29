import { sha256, formatHash } from './hash.js';
import type { ContentSignature, SignContentOptions, ContentVerifyResult } from '../types.js';

/**
 * Sign arbitrary content and return a signature.
 * This is a stateless function - the caller is responsible for storing the signature.
 */
export function signContent(content: string, options: SignContentOptions): ContentSignature {
  const hex = sha256(content);
  return {
    id: options.id,
    hash: formatHash(hex),
    algorithm: 'sha256',
    signedBy: options.identity,
    signedAt: new Date().toISOString(),
    contentLength: Buffer.byteLength(content, 'utf8'),
    metadata: options.metadata,
  };
}

/**
 * Verify content against a signature.
 * This is a stateless function - compare current content hash against stored signature.
 */
export function verifyContent(
  content: string,
  signature: ContentSignature
): { verified: boolean; error?: string } {
  const currentHash = formatHash(sha256(content));
  if (currentHash !== signature.hash) {
    return { verified: false, error: 'Content hash mismatch' };
  }
  return { verified: true };
}

/**
 * In-memory store for signed content.
 * Used for session-scoped signing of ephemeral content like chat messages.
 */
export class ContentStore {
  private signatures = new Map<string, ContentSignature>();
  private contents = new Map<string, string>();

  /**
   * Sign content and store it in the store.
   * Returns the signature.
   */
  sign(content: string, options: SignContentOptions): ContentSignature {
    const signature = signContent(content, options);
    this.signatures.set(options.id, signature);
    this.contents.set(options.id, content);
    return signature;
  }

  /**
   * Verify content by ID.
   * Returns the stored content and signature if verified.
   */
  verify(id: string): ContentVerifyResult {
    const signature = this.signatures.get(id);
    if (!signature) {
      return { verified: false, id, error: 'No signature found for id' };
    }

    const content = this.contents.get(id);
    if (content === undefined) {
      return { verified: false, id, error: 'No content found for id' };
    }

    const result = verifyContent(content, signature);
    if (!result.verified) {
      return { verified: false, id, error: result.error };
    }

    return {
      verified: true,
      id,
      content,
      signature,
    };
  }

  /**
   * Get a signature by ID without verifying.
   */
  get(id: string): ContentSignature | undefined {
    return this.signatures.get(id);
  }

  /**
   * List all signatures in the store.
   */
  list(): ContentSignature[] {
    return Array.from(this.signatures.values());
  }

  /**
   * Delete a signature by ID.
   * Returns true if the signature existed and was deleted.
   */
  delete(id: string): boolean {
    const hadSig = this.signatures.delete(id);
    this.contents.delete(id);
    return hadSig;
  }

  /**
   * Clear all signatures from the store.
   */
  clear(): void {
    this.signatures.clear();
    this.contents.clear();
  }

  /**
   * Check if a signature exists for the given ID.
   */
  has(id: string): boolean {
    return this.signatures.has(id);
  }

  /**
   * Get the number of signatures in the store.
   */
  get size(): number {
    return this.signatures.size;
  }
}

/**
 * Factory function for creating session-scoped content stores.
 */
export function createContentStore(): ContentStore {
  return new ContentStore();
}
