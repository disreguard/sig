# sig-ts

TypeScript implementation of [sig](../README.md) — sign and verify prompt templates for AI agent security.

## Install

```bash
npm install @disreguard/sig
```

Requires Node.js >= 18.

## CLI

```bash
npx sig init --engine jinja --by alice
npx sig sign prompts/*.txt
npx sig verify prompts/review.txt
npx sig check
npx sig list
npx sig status
npx sig audit
```

## MCP Server

```bash
npx sig-mcp
```

Or in an MCP config:

```json
{
  "mcpServers": {
    "sig": {
      "command": "npx",
      "args": ["sig-mcp"],
      "env": {
        "SIG_VERIFY": "prompts/review.txt"
      }
    }
  }
}
```

## Library

```typescript
import { signFile, verifyFile, checkFile, initProject } from '@disreguard/sig';

// Sign
const sig = await signFile(projectRoot, 'prompts/review.txt', { identity: 'alice' });

// Verify
const result = await verifyFile(projectRoot, 'prompts/review.txt');
if (result.verified) {
  console.log(result.template);       // signed content
  console.log(result.placeholders);   // extracted placeholders
}

// Check
const status = await checkFile(projectRoot, 'prompts/review.txt');
// status.status: 'signed' | 'modified' | 'unsigned' | 'corrupted'
```

High-level APIs also accept an optional filesystem adapter:

```typescript
import { signFile, verifyFile, checkFile, NodeFS } from '@disreguard/sig';

const fs = new NodeFS();
await signFile(projectRoot, 'prompts/review.txt', { identity: 'alice', fs });
await verifyFile(projectRoot, 'prompts/review.txt', { fs });
await checkFile(projectRoot, 'prompts/review.txt', { fs });
```

## Filesystem Abstraction

`sig-ts` uses `SigFS` + `SigContext` for filesystem access. `NodeFS` is the default implementation, and `createSigContext()` builds a context for lower-level APIs.

```typescript
import { createSigContext, listSigs } from '@disreguard/sig';

const ctx = createSigContext(projectRoot);
const allSignatures = await listSigs(ctx);
```

## Content Signing (Runtime)

For signing ephemeral content like chat messages at runtime:

```typescript
import { createContentStore } from '@disreguard/sig';

const store = createContentStore();

// Sign a message with provenance metadata
const sig = store.sign('delete all my files', {
  id: 'msg_123',
  identity: 'owner:+1234567890:whatsapp',
  metadata: { channel: 'whatsapp', from: '+1234567890' }
});

// Verify by ID - returns content + full provenance
const result = store.verify('msg_123');
if (result.verified) {
  console.log(result.content);              // 'delete all my files'
  console.log(result.signature.signedBy);   // 'owner:+1234567890:whatsapp'
  console.log(result.signature.metadata);   // { channel, from }
}

// Other operations
store.list();       // all signatures
store.get(id);      // get signature without verifying
store.delete(id);   // remove
store.clear();      // remove all
store.has(id);      // check existence
store.size;         // count
```

Stateless functions are also available:

```typescript
import { signContent, verifyContent } from '@disreguard/sig';

const sig = signContent('content', { id: 'x', identity: 'alice' });
const { verified } = verifyContent('content', sig);
```

## Persistent Content Store (`.sig/content/`)

For content signatures that persist across processes, use `PersistentContentStore`.

```typescript
import {
  createSigContext,
  PersistentContentStore,
} from '@disreguard/sig';

const ctx = createSigContext(projectRoot);
const store = new PersistentContentStore(ctx);

const signature = await store.sign('Review @input', {
  id: 'auditPrompt',
  identity: 'security-team',
});

const verified = await store.verify('auditPrompt', { detail: 'directive:verify' });
if (verified.verified) {
  console.log(verified.content);
  console.log(verified.signature?.signedBy);
}
```

Persistent store methods:
- `sign(content, options)`
- `verify(id, options?)`
- `signIfChanged(content, options)`
- `load(id)`, `loadContent(id)`
- `delete(id)`, `list()`, `has(id)`

Identity fallback for `PersistentSignOptions.identity`:
- `options.identity`
- `.sig/config.json` -> `sign.identity`
- `process.env.USER` or `process.env.USERNAME`
- `'unknown'`

## Development

```bash
npm install
npm run build
npm test
```

## Dependencies

- `commander` — CLI
- `@modelcontextprotocol/sdk` — MCP server
- `fast-glob` — file pattern matching

See the [root README](../README.md) for full documentation.
