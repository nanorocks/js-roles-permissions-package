import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'adapters/drizzle': 'src/adapters/drizzle.ts',
    'nextjs/index': 'src/nextjs/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['drizzle-orm', 'next', 'react'],
  cjsInterop: true,
  shims: true,
});
