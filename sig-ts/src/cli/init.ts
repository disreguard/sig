import { initProject } from '../core/config.js';
import { getEngineNames } from '../templates/engines.js';
import type { TemplateEngine } from '../types.js';

export async function initCommand(options: {
  engine?: string;
  identity?: string;
}): Promise<void> {
  const cwd = process.cwd();

  const engine = options.engine
    ? parseEngines(options.engine)
    : undefined;

  const config = await initProject(cwd, { engine, identity: options.identity });

  console.log('Initialized .sig/ directory');
  if (config.templates?.engine) {
    const engines = Array.isArray(config.templates.engine)
      ? config.templates.engine
      : [config.templates.engine];
    console.log(`Template engine(s): ${engines.join(', ')}`);
  }
  if (config.sign?.identity) {
    console.log(`Default identity: ${config.sign.identity}`);
  }
}

function parseEngines(input: string): TemplateEngine | TemplateEngine[] {
  const valid = new Set(getEngineNames());
  const engines = input.split(',').map((s) => s.trim()) as TemplateEngine[];

  for (const e of engines) {
    if (!valid.has(e)) {
      console.error(`Unknown template engine: ${e}`);
      console.error(`Available: ${[...valid].join(', ')}`);
      process.exit(1);
    }
  }

  return engines.length === 1 ? engines[0] : engines;
}
