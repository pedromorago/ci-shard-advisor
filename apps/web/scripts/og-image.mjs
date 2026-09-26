#!/usr/bin/env node
/**
 * Regenerates public/og.png, the 1200x630 image link previews show (LinkedIn,
 * Slack, WhatsApp…), from the app's own header, the way pedromorago.com builds
 * its share cards: the image can never drift from the page. Share-only styles
 * hide everything but the title and tagline.
 *
 * Run `pnpm og` after changing the header and commit the PNG. It builds and
 * serves the app itself; CHROMIUM_PATH points it at a local Chromium if the
 * Playwright one is not installed.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og.png');
const URL = process.argv[2] ?? 'http://localhost:4173/';
const SIZE = { width: 1200, height: 630 };

const SHARE = `
  .report-input, .card, .app__meta, .app__error { display: none !important; }
  body { min-height: 630px; }
  .app { max-width: none; height: 630px; padding: 0 108px !important;
    display: flex; flex-direction: column; justify-content: center; }
  .app__header h1 { font-size: 6.4rem; }
  .app__tagline { font-size: 2.1rem; line-height: 1.3; max-width: 32ch; margin-top: 22px; }
  .app__header::after {
    content: "pedromorago.com"; display: block; margin-top: 44px;
    font-size: 1.5rem; font-weight: 600; color: var(--accent);
  }
`;

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
try {
  const page = await browser.newPage({ viewport: SIZE, colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto(URL);
  await page.addStyleTag({ content: SHARE });
  await page.screenshot({ path: OUT, clip: { x: 0, y: 0, ...SIZE } });
  console.log(`✓ ${path.relative(process.cwd(), OUT)}`);
} finally {
  await browser.close();
}
