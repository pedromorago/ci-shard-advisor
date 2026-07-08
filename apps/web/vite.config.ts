/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// On GitHub Pages the app is served from a sub-path; the deploy workflow sets
// PAGES_BASE=/ci-shard-advisor/. Everywhere else — dev, tests and the E2E
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
