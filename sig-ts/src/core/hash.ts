import { createHash } from 'node:crypto';

export function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function formatHash(hex: string): string {
  return `sha256:${hex}`;
}

export function parseHash(hash: string): { algorithm: string; hex: string } {
  const idx = hash.indexOf(':');
  if (idx === -1) {
    return { algorithm: 'sha256', hex: hash };
  }
  return { algorithm: hash.slice(0, idx), hex: hash.slice(idx + 1) };
}
