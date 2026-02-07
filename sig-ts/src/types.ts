export interface SigConfig {
  version: 1;
  templates?: {
    engine?: TemplateEngine | TemplateEngine[];
    custom?: CustomPattern[];
  };
  sign?: {
    algorithm?: 'sha256';
    identity?: string;
    include?: string[];
    exclude?: string[];
  };
  files?: Record<string, FilePolicy>;
}

export interface FilePolicy {
  /** Whether this file can be updated via updateAndSign. Default: false */
  mutable?: boolean;
  /** Glob or identity patterns that are allowed to authorize updates. e.g. ["owner:*"] */
  authorizedIdentities?: string[];
  /** Require that the provenance sourceId resolves to a valid signed message or template. Default: false */
  requireSignedSource?: boolean;
  /** Tells the orchestrator/system prompt that the agent should confirm with the user before updating. sig doesn't enforce this — enforcement comes from requireSignedSource. Default: false */
  requireApproval?: boolean;
}

export type TemplateEngine =
  | 'jinja'
  | 'mustache'
  | 'handlebars'
  | 'jsx'
  | 'js-template'
  | 'bash'
  | 'mlld'
  | 'claude'
  | 'erb'
  | 'go-template'
  | 'python-fstring';

export interface CustomPattern {
  name: string;
  patterns: string[];
}

export interface EngineDefinition {
  name: TemplateEngine;
  description: string;
  placeholders: RegExp[];
}

export interface Signature {
  file: string;
  hash: string;
  algorithm: 'sha256';
  signedBy: string;
  signedAt: string;
  contentLength: number;
  templateEngine?: string;
}

export interface VerifyResult {
  verified: boolean;
  file: string;
  template?: string;
  hash?: string;
  signedBy?: string;
  signedAt?: string;
  error?: string;
  placeholders?: string[];
  /** Present for mutable files with update chains */
  chain?: {
    length: number;
    valid: boolean;
    lastUpdatedBy?: string;
    lastUpdatedAt?: string;
  };
}

export interface AuditEntry {
  ts: string;
  event: 'sign' | 'verify' | 'verify-fail' | 'modify' | 'delete' | 'update' | 'update_denied';
  file: string;
  hash?: string;
  identity?: string;
  detail?: string;
  provenance?: UpdateProvenance;
}

export interface CheckResult {
  file: string;
  status: 'signed' | 'modified' | 'unsigned' | 'corrupted';
  signature?: Signature;
}

// Content signing types (for runtime/in-memory signing)

export interface ContentSignature {
  id: string;
  hash: string;
  algorithm: 'sha256';
  signedBy: string;
  signedAt: string;
  contentLength: number;
  metadata?: Record<string, string>;
}

export interface SignContentOptions {
  id: string;
  identity: string;
  metadata?: Record<string, string>;
}

export interface ContentVerifyResult {
  verified: boolean;
  id: string;
  content?: string;
  signature?: ContentSignature;
  error?: string;
}

// Update chain types

export interface ChainEntry {
  /** Hash of the new content after this update */
  hash: string;
  /** Hash of the content before this update (previous head, or original sign hash for first update) */
  previousHash: string;
  /** Identity that authorized this update */
  signedBy: string;
  /** ISO timestamp */
  signedAt: string;
  /** Content length in bytes */
  contentLength: number;
  /** Provenance: proof of why this update was authorized */
  provenance: UpdateProvenance;
}

export interface UpdateProvenance {
  /** What type of source authorized this update */
  sourceType: 'signed_message' | 'signed_template';
  /** ID of the signed source (ContentStore signature ID, or template file path) */
  sourceId?: string;
  /** Identity string of the source (e.g., "owner:+1234567890:whatsapp") */
  sourceIdentity?: string;
  /** Hash of the source content */
  sourceHash?: string;
  /** Agent's stated reason for the change */
  reason: string;
}

export interface UpdateAndSignOptions {
  /** Identity authorizing this update */
  identity: string;
  /** Provenance: proof the update was authorized */
  provenance: UpdateProvenance;
  /** Optional ContentStore instance for validating signed_message provenance */
  contentStore?: import('./core/content.js').ContentStore;
}

export interface UpdateResult {
  approved: boolean;
  file: string;
  hash?: string;
  previousHash?: string;
  chainLength?: number;
  error?: string;
  /** Present when approved is false */
  denial?: {
    code: 'not_mutable' | 'not_signed' | 'unauthorized_identity' | 'unsigned_source' | 'source_verification_failed';
    reason: string;
  };
}
