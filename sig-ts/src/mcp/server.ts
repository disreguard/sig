import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod/v3';
import { verifyFile, checkFile, checkAllSigned } from '../core/verify.js';
import { findProjectRoot } from '../core/config.js';
import type { VerifyResult, CheckResult } from '../types.js';

const server = new McpServer({
  name: 'sig',
  version: '0.1.0',
});

server.registerTool('verify', {
  title: 'Verify',
  description:
    'Verify the signature of a signed template file. ' +
    'Returns the authenticated template content if valid. ' +
    'If SIG_VERIFY env var is set, verifies those files (comma-separated). ' +
    'Otherwise uses the file parameter.',
  inputSchema: {
    file: z.string().optional().describe(
      'File path to verify (relative to project root). ' +
      'If omitted, reads from SIG_VERIFY env var.'
    ),
  },
}, async (args): Promise<{ content: { type: 'text'; text: string }[] }> => {
  const projectRoot = await findProjectRoot();

  const envFiles = process.env.SIG_VERIFY;
  const files = args.file
    ? [args.file]
    : envFiles
      ? envFiles.split(',').map((f) => f.trim()).filter(Boolean)
      : [];

  if (files.length === 0) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: 'No file specified. Provide a file parameter or set SIG_VERIFY env var.' }),
      }],
    };
  }

  const results: VerifyResult[] = [];
  for (const file of files) {
    results.push(await verifyFile(projectRoot, file));
  }

  const result = results.length === 1 ? results[0] : results;
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});

server.registerTool('list_signed', {
  title: 'List Signed',
  description: 'List all signed files and their current status (signed, modified, or unsigned).',
}, async (): Promise<{ content: { type: 'text'; text: string }[] }> => {
  const projectRoot = await findProjectRoot();
  const results = await checkAllSigned(projectRoot);

  return {
    content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
  };
});

server.registerTool('check', {
  title: 'Check',
  description: 'Check if a specific file is signed and whether it has been modified since signing.',
  inputSchema: {
    file: z.string().describe('File path to check (relative to project root)'),
  },
}, async (args): Promise<{ content: { type: 'text'; text: string }[] }> => {
  const projectRoot = await findProjectRoot();
  const result = await checkFile(projectRoot, args.file);

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('sig-mcp server error:', err);
  process.exit(1);
});
