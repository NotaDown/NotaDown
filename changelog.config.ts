import type { ChangelogConfig } from 'changelogen'

// Group order follows the changelogen default (feat/perf/fix/refactor/docs/build/chore/test/style/ci); only the titles
// are overridden. Set a type to false to hide that group entirely, e.g. chore: false
export default {
  noAuthors: true,
  types: {
    feat: { title: '🚀 Features' },
    fix: { title: '🩹 Bug Fixes' },
    perf: { title: '🔥 Performance' },
    refactor: { title: '♻️ Refactoring' },
    style: { title: '🎨 Styles' },
    docs: { title: '📖 Documentation' },
    test: { title: '✅ Tests' },
    build: { title: '📦 Build' },
    ci: { title: '🤖 CI' },
    chore: { title: '🏡 Chores' },
    // Revert subjects quote the reverted title, which reads as a duplicate of the change itself
    revert: false,
  },
} satisfies Partial<ChangelogConfig>
