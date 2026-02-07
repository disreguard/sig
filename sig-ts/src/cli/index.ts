import { Command } from 'commander';
import { initCommand } from './init.js';
import { signCommand } from './sign.js';
import { verifyCommand } from './verify.js';
import { checkCommand } from './check.js';
import { listCommand } from './list.js';
import { statusCommand } from './status.js';
import { auditCommand } from './audit.js';
import { updateCommand } from './update.js';
import { chainCommand } from './chain.js';
import { policyCommand } from './policy.js';

const program = new Command()
  .name('sig')
  .description('Sign and verify prompt templates for AI agent security')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize .sig/ directory with config')
  .option('--engine <engines>', 'Template engine(s), comma-separated')
  .option('--by <identity>', 'Default signing identity')
  .action(async (opts) => {
    await initCommand({ engine: opts.engine, identity: opts.by });
  });

program
  .command('sign')
  .description('Sign file(s)')
  .argument('<files...>', 'Files or glob patterns to sign')
  .option('--by <identity>', 'Signing identity')
  .option('--engine <engine>', 'Template engine override')
  .action(async (files: string[], opts) => {
    await signCommand(files, { by: opts.by, engine: opts.engine });
  });

program
  .command('verify')
  .description('Verify a signed file and print its content')
  .argument('<file>', 'File to verify')
  .action(async (file: string) => {
    await verifyCommand(file);
  });

program
  .command('check')
  .description('Check signing status of file(s)')
  .argument('[files...]', 'Files or glob patterns (default: all signed)')
  .action(async (files: string[]) => {
    await checkCommand(files.length ? files : undefined);
  });

program
  .command('list')
  .description('List all signed files')
  .action(async () => {
    await listCommand();
  });

program
  .command('status')
  .description('Overview of signed/modified/unsigned files')
  .action(async () => {
    await statusCommand();
  });

program
  .command('audit')
  .description('Show audit log')
  .argument('[file]', 'Filter to specific file')
  .action(async (file?: string) => {
    await auditCommand(file);
  });

program
  .command('update')
  .description('Update a mutable signed file (reads new content from stdin)')
  .argument('<file>', 'File to update')
  .requiredOption('--by <identity>', 'Identity authorizing this update')
  .requiredOption('--reason <reason>', 'Reason for the update')
  .requiredOption('--source-type <type>', 'Source type (signed_message or signed_template)')
  .option('--source-id <id>', 'ID of the signed source')
  .action(async (file: string, opts) => {
    await updateCommand(file, {
      by: opts.by,
      reason: opts.reason,
      sourceType: opts.sourceType,
      sourceId: opts.sourceId,
    });
  });

program
  .command('chain')
  .description('Show the update chain for a mutable file')
  .argument('<file>', 'File to show chain for')
  .option('--verify', 'Validate chain integrity')
  .action(async (file: string, opts) => {
    await chainCommand(file, { verify: opts.verify });
  });

program
  .command('policy')
  .description('Show file policy')
  .argument('[file]', 'File to check policy for (shows all if omitted)')
  .action(async (file?: string) => {
    await policyCommand(file);
  });

program.parse();
