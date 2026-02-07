import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod/v3';
import { verifyFile, checkFile, checkAllSigned } from '../core/verify.js';
import { findProjectRoot, loadConfig } from '../core/config.js';
import { updateAndSign } from '../core/update.js';
import { resolveFilePolicy } from '../core/policy.js';
import { readChain, validateChain } from '../core/chain.js';
import { resolveContainedPath } from '../core/paths.js';
import { sigDir } from '../core/config.js';
import type { VerifyResult, CheckResult, UpdateProvenance } from '../types.js';

const server = new McpServer({
  name: 'sig',
  version: '0.1.0',
});

server.registerTool('verify', {
  title: 'Verify',
  description:
    'Verify the signature of a signed template file. ' +
    'Returns the authenticated template content if valid. ' +
    'If SIG_VERIFY env var is set, verifies those files and ignores the file parameter. ' +
    'Otherwise falls back to the file parameter.',
  inputSchema: {
    file: z.string().optional().describe(
      'File path to verify (relative to project root). ' +
      'Ignored when SIG_VERIFY env var is set.'
    ),
  },
}, async (args): Promise<{ content: { type: 'text'; text: string }[] }> => {
  const projectRoot = await findProjectRoot();

  // SIG_VERIFY takes precedence — orchestrator controls what gets verified
  const envFiles = process.env.SIG_VERIFY;
  const files = envFiles
    ? envFiles.split(',').map((f) => f.trim()).filter(Boolean)
    : args.file
      ? [args.file]
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

server.registerTool('update_and_sign', {
  title: 'Update and Sign',
  description:
    'Request an authorized update to a protected mutable file. ' +
    'Requires provenance: proof that the update was authorized by a signed source. ' +
    'The update is only applied if all policy checks pass. ' +
    'Note: When used via MCP, ContentStore validation is limited to checking that sourceId is provided. ' +
    'Full ContentStore validation requires calling updateAndSign programmatically.',
  inputSchema: {
    file: z.string().describe('File path to update (relative to project root)'),
    content: z.string().describe('New file content'),
    reason: z.string().describe('Why this update is being made'),
    sourceType: z.enum(['signed_message', 'signed_template'])
      .describe('What type of source authorized this update'),
    sourceId: z.string().optional()
      .describe('ID of the signed source (ContentStore sig ID or template path)'),
    sourceIdentity: z.string().optional()
      .describe('Identity of the source (e.g., owner:+1234567890:whatsapp)'),
  },
}, async (args): Promise<{ content: { type: 'text'; text: string }[] }> => {
  const projectRoot = await findProjectRoot();

  const identity = process.env.SIG_IDENTITY || args.sourceIdentity || 'unknown';

  const provenance: UpdateProvenance = {
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    sourceIdentity: args.sourceIdentity,
    reason: args.reason,
  };

  const result = await updateAndSign(projectRoot, args.file, args.content, {
    identity,
    provenance,
    // No contentStore available via MCP — Option C from spec
  });

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});

server.registerTool('check_policy', {
  title: 'Check Policy',
  description: 'Check the file policy for a given path. Returns whether the file is mutable and what authorization is required.',
  inputSchema: {
    file: z.string().describe('File path to check policy for'),
  },
}, async (args): Promise<{ content: { type: 'text'; text: string }[] }> => {
  const projectRoot = await findProjectRoot();
  const config = await loadConfig(projectRoot);
  const relPath = resolveContainedPath(projectRoot, args.file);
  const policy = resolveFilePolicy(config, relPath);

  return {
    content: [{ type: 'text', text: JSON.stringify({ file: relPath, policy }, null, 2) }],
  };
});

server.registerTool('view_chain', {
  title: 'View Chain',
  description: 'View the update chain for a mutable file. Shows the history of authorized updates with provenance.',
  inputSchema: {
    file: z.string().describe('File path to view chain for'),
  },
}, async (args): Promise<{ content: { type: 'text'; text: string }[] }> => {
  const projectRoot = await findProjectRoot();
  const relPath = resolveContainedPath(projectRoot, args.file);
  const dir = sigDir(projectRoot);

  const entries = await readChain(dir, relPath);
  const validation = await validateChain(dir, relPath);

  return {
    content: [{ type: 'text', text: JSON.stringify({ file: relPath, chain: entries, validation }, null, 2) }],
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
