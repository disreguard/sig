import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    entry: ['src/cli/index.ts'],
    format: ['esm'],
    outDir: 'dist/cli',
    sourcemap: true,
  },
  {
    entry: ['src/mcp/server.ts'],
    format: ['esm'],
    outDir: 'dist/mcp',
    sourcemap: true,
  },
]);
