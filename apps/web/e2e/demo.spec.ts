import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('demo analysis', () => {
  test('loads a preloaded recommendation without any input', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: /CI Shard Advisor/i })).toBeVisible();
    await expect(page.getByText(/demo report/i)).toBeVisible();

    const recommendation = page.getByRole('region', { name: /recommendation/i });
    await expect(recommendation.getByText(/^\d+ shards$/)).toBeVisible();

    // The frontier chart lives in a collapsible section; expand it.
    await page.getByText(/show the full cost \/ time frontier/i).click();
    await expect(page.getByRole('img', { name: /feedback time versus billed cost/i })).toBeVisible();
  });

  test('has no serious or critical accessibility violations', async ({ page }) => {
    await page.goto('/');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
