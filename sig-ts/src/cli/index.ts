import { Command } from 'commander';
import { initCommand } from './init.js';
import { signCommand } from './sign.js';
import { verifyCommand } from './verify.js';
import { checkCommand } from './check.js';
import { listCommand } from './list.js';
import { statusCommand } from './status.js';
import { auditCommand } from './audit.js';

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

program.parse();
