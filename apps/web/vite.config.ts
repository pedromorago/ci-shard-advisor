/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// On GitHub Pages the app is served from /ci-shard-advisor/; dev and tests
// stay at the root. `base` only affects the production build.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/ci-shard-advisor/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
}));
