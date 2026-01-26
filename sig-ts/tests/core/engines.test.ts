import { describe, it, expect } from 'vitest';
import { extractPlaceholders, ENGINES, getEngineNames } from '../../src/templates/engines.js';

describe('extractPlaceholders', () => {
  it('extracts jinja placeholders', () => {
    const content = 'Hello {{ name }}, {% if admin %}welcome{% endif %} {# comment #}';
    const found = extractPlaceholders(content, 'jinja');
    expect(found).toContain('{{ name }}');
    expect(found).toContain('{% if admin %}');
    expect(found).toContain('{# comment #}');
  });

  it('extracts mustache placeholders', () => {
    const content = 'Hello {{name}}, {{{raw}}}, {{#section}}content{{/section}}';
    const found = extractPlaceholders(content, 'mustache');
    expect(found).toContain('{{name}}');
    expect(found).toContain('{{{raw}}}');
  });

  it('extracts js-template placeholders', () => {
    const content = 'Hello ${name}, value is ${obj.prop}';
    const found = extractPlaceholders(content, 'js-template');
    expect(found).toContain('${name}');
    expect(found).toContain('${obj.prop}');
  });

  it('extracts bash placeholders', () => {
    const content = 'Deploy $VERSION to ${ENVIRONMENT}';
    const found = extractPlaceholders(content, 'bash');
    expect(found).toContain('$VERSION');
    expect(found).toContain('${ENVIRONMENT}');
  });

  it('extracts mlld placeholders', () => {
    const content = 'Analyze @input and check <config.json>';
    const found = extractPlaceholders(content, 'mlld');
    expect(found).toContain('@input');
    expect(found).toContain('<config.json>');
  });

  it('extracts erb placeholders', () => {
    const content = 'Hello <%= name %>, <% if admin %>';
    const found = extractPlaceholders(content, 'erb');
    expect(found).toContain('<%= name %>');
    expect(found).toContain('<% if admin %>');
  });

  it('handles multiple engines', () => {
    const content = 'Hello {{ name }} and ${value}';
    const found = extractPlaceholders(content, ['jinja', 'js-template']);
    expect(found).toContain('{{ name }}');
    expect(found).toContain('${value}');
  });

  it('handles custom patterns', () => {
    const content = 'Hello %%name%% and %%other%%';
    const found = extractPlaceholders(content, undefined, [
      { name: 'custom', patterns: ['%%\\w+%%'] },
    ]);
    expect(found).toContain('%%name%%');
    expect(found).toContain('%%other%%');
  });

  it('returns empty for no engine', () => {
    const found = extractPlaceholders('hello world');
    expect(found).toHaveLength(0);
  });
});

describe('getEngineNames', () => {
  it('returns all engine names', () => {
    const names = getEngineNames();
    expect(names).toContain('jinja');
    expect(names).toContain('mustache');
    expect(names).toContain('mlld');
    expect(names).toContain('bash');
    expect(names.length).toBeGreaterThan(8);
  });
});
