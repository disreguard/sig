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
