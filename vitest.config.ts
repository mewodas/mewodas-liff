import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    exclude: ['node_modules/**', '.next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/**/*.test.ts',
        // 副作用が大きく単体テスト対象外（ネットワーク/外部API）
        'lib/notion.ts',
        'lib/lineBot.ts',
        'lib/lineRichMenu.ts',
        'lib/drive.ts',
        'lib/gemini.ts',
        'lib/sentry.ts',
        'lib/sentryServer.ts',
      ],
    },
  },
});
