/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The deploy workflow sets PAGES_BASE to where GitHub Pages serves the site:
// "/" on shard.pedromorago.com, "/ci-shard-advisor/" on github.io without a
// custom domain. Everywhere else — dev, tests and the E2E
// `vite preview` build — the app stays at the root.
export default defineConfig({
  base: process.env.PAGES_BASE ?? '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
