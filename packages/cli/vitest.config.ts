import { defineConfig } from 'vitest/config';

const BROWSER_TEST_TIMEOUT_MILLISECONDS = 30000;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: BROWSER_TEST_TIMEOUT_MILLISECONDS,
    hookTimeout: BROWSER_TEST_TIMEOUT_MILLISECONDS,
    fileParallelism: false,
  },
});
