import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('demo analysis', () => {
  test('loads a preloaded current situation and moves without any input', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: /CI Shard Advisor/i })).toBeVisible();
    await expect(page.getByText(/demo.*3 containers/i)).toBeVisible();

    const current = page.getByRole('region', { name: /your setup today/i });
    await expect(current.getByText(/measured/i)).toBeVisible();

    const moves = page.getByRole('region', { name: /your moves/i });
    // "Rebalance" appears in the move title and in the "same as" notes of any
    // coinciding move; the first is the rebalance move itself.
    await expect(moves.getByText(/rebalance/i).first()).toBeVisible();

    // The frontier chart lives in a collapsible section; expand it.
    await page.getByText(/show the full cost \/ time frontier/i).click();
    await expect(page.getByRole('img', { name: /feedback time versus billed cost/i })).toBeVisible();
  });

  test('fits a phone screen: no sideways scroll and a legible chart', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await page.getByText(/show the full cost \/ time frontier/i).click();
    const chart = page.getByRole('img', { name: /feedback time versus billed cost/i });
    await expect(chart).toBeVisible();

    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth).toBeLessThanOrEqual(390);

    // Axis labels are 13px. Drawn at the real width they stay that size; a
    // scaled-down desktop drawing would shrink them to about 6px.
    const axisLabel = await chart.getByText('Cost per run').boundingBox();
    expect(axisLabel?.height).toBeGreaterThanOrEqual(12);

    // The split disclosures are tap targets: at least 44px tall, the iOS minimum.
    const applySplit = await page.getByText(/apply this split/i).first().boundingBox();
    expect(applySplit?.height).toBeGreaterThanOrEqual(44);
  });

  test('copies a container command to the clipboard exactly as shown', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');

    await page.getByText(/apply this split/i).first().click();
    const copy = page.getByRole('button', { name: 'Copy the command for container 1' }).first();
    await copy.click();

    await expect(copy).toHaveText('Copied');
    // The command shown in the button's own row.
    const command = await copy.locator('..').getByText(/^npx cypress run --spec /).textContent();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(command);
  });

  test('shares with a link preview: description, large card and a served image', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /cypress/i);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\.png$/);

    // The image the tags point at ships with the site, at the size they declare.
    const image = await page.request.get('og.png');
    expect(image.headers()['content-type']).toBe('image/png');
    const png = await image.body();
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  test('has no accessibility violations, disclosures open', async ({ page }) => {
    await page.goto('/');
    // Scan what the collapsible sections hide too (help, chart and split lists).
    for (const disclosure of await page.locator('details').all()) {
      await disclosure.evaluate((el) => el.setAttribute('open', ''));
    }

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
      .analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
