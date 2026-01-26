import type { EngineDefinition, TemplateEngine, CustomPattern } from '../types.js';

export const ENGINES: Record<TemplateEngine, EngineDefinition> = {
  jinja: {
    name: 'jinja',
    description: 'Jinja2 / Nunjucks',
    placeholders: [
      /\{\{.*?\}\}/g,
      /\{%.*?%\}/g,
      /\{#.*?#\}/g,
    ],
  },
  mustache: {
    name: 'mustache',
    description: 'Mustache',
    placeholders: [
      /\{\{\{.*?\}\}\}/g,
      /\{\{[#/^>]?.*?\}\}/g,
    ],
  },
  handlebars: {
    name: 'handlebars',
    description: 'Handlebars',
    placeholders: [
      /\{\{\{.*?\}\}\}/g,
      /\{\{[#/^>~]?.*?\}\}/g,
    ],
  },
  jsx: {
    name: 'jsx',
    description: 'JSX / React expressions',
    placeholders: [
      /\{[^}]+\}/g,
    ],
  },
  'js-template': {
    name: 'js-template',
    description: 'JavaScript template literals',
    placeholders: [
      /\$\{[^}]+\}/g,
    ],
  },
  bash: {
    name: 'bash',
    description: 'Bash / Shell variables',
    placeholders: [
      /\$\{[^}]+\}/g,
      /\$[A-Z_][A-Z0-9_]*/g,
    ],
  },
  mlld: {
    name: 'mlld',
    description: 'mlld style (@var, <file>)',
    placeholders: [
      /@[a-zA-Z]\w*(?:\.[a-zA-Z]\w*)*/g,
      /<[a-zA-Z][\w./-]*>/g,
    ],
  },
  claude: {
    name: 'claude',
    description: 'Claude artifacts ({{var}}, @file)',
    placeholders: [
      /\{\{[a-zA-Z_]\w*\}\}/g,
      /@[a-zA-Z][\w/-]*/g,
    ],
  },
  erb: {
    name: 'erb',
    description: 'Ruby ERB',
    placeholders: [
      /<%=?-?\s.*?-?%>/g,
    ],
  },
  'go-template': {
    name: 'go-template',
    description: 'Go text/template',
    placeholders: [
      /\{\{.*?\}\}/g,
    ],
  },
  'python-fstring': {
    name: 'python-fstring',
    description: 'Python f-strings',
    placeholders: [
      /\{[^}]+\}/g,
    ],
  },
};

export function extractPlaceholders(
  content: string,
  engine?: TemplateEngine | TemplateEngine[],
  custom?: CustomPattern[]
): string[] {
  const found = new Set<string>();

  const engines = engine
    ? (Array.isArray(engine) ? engine : [engine])
    : [];

  for (const eng of engines) {
    const def = ENGINES[eng];
    if (!def) continue;
    for (const re of def.placeholders) {
      const pattern = new RegExp(re.source, re.flags);
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        found.add(match[0]);
      }
    }
  }

  if (custom) {
    for (const cp of custom) {
      for (const patStr of cp.patterns) {
        const re = new RegExp(patStr, 'g');
        let match: RegExpExecArray | null;
        while ((match = re.exec(content)) !== null) {
          found.add(match[0]);
        }
      }
    }
  }

  return [...found];
}

export function getEngineNames(): TemplateEngine[] {
  return Object.keys(ENGINES) as TemplateEngine[];
}
