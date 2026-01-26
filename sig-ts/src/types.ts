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
}

export interface AuditEntry {
  ts: string;
  event: 'sign' | 'verify' | 'verify-fail' | 'modify' | 'delete';
  file: string;
  hash?: string;
  identity?: string;
  detail?: string;
}

export interface CheckResult {
  file: string;
  status: 'signed' | 'modified' | 'unsigned';
  signature?: Signature;
}
