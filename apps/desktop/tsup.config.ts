import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    main: 'src/main.ts',
    preload: 'src/preload.ts',
  },
  format: ['cjs'],
  platform: 'node',
  target: 'node22',
  outExtension: () => ({ js: '.cjs' }),
  splitting: false,
  clean: true,
  publicDir: 'assets',
  sourcemap: true,
  external: ['electron'],
  noExternal: ['@notadown/shared', 'chokidar', 'readdirp'],
})
