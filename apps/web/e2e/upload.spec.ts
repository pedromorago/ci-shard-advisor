import { test, expect } from '@playwright/test';

/** A minimal valid Cypress report carrying a unique canary string in a test title. */
function reportWithCanary(canary: string): string {
  return JSON.stringify({
    runs: [
      {
        spec: { relative: 'cypress/e2e/canary.cy.ts' },
        tests: [
          { title: ['Canary', canary], state: 'passed', duration: 4200 },
          { title: ['Canary', 'another test'], state: 'passed', duration: 8100 },
        ],
      },
    ],
  });
}

test.describe('uploading a report', () => {
  test('analyzes an uploaded report client-side', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel(/upload your cypress reports/i).setInputFiles({
      name: 'my-suite.json',
      mimeType: 'application/json',
      buffer: Buffer.from(reportWithCanary('renders results fast')),
    });

    await expect(page.getByText(/my-suite\.json/)).toBeVisible();
    await expect(page.getByText(/2 tests/i)).toBeVisible();
  });

  test('analyzes one report per container as a measured setup (multi-upload)', async ({ page }) => {
    await page.goto('/');

    // The product's preferred input (spec §3.1): N files at once → N is
    // deduced and the current situation is MEASURED, imbalance included.
    await page.getByLabel(/upload your cypress reports/i).setInputFiles([
      {
        name: 'container-1.json',
        mimeType: 'application/json',
        buffer: Buffer.from(reportWithCanary('slow container')),
      },
      {
        name: 'container-2.json',
        mimeType: 'application/json',
        buffer: Buffer.from(reportWithCanary('fast container')),
      },
    ]);

    await expect(page.getByText(/2 uploaded reports/i)).toBeVisible();
    const current = page.getByRole('region', { name: /your setup today/i });
    await expect(current.getByText(/measured/i)).toBeVisible();
    await expect(current.getByText(/2 containers/i)).toBeVisible();
  });

  test('surfaces a clear error for a malformed report', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel(/upload your cypress reports/i).setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ not valid json'),
    });

    await expect(page.getByRole('alert')).toBeVisible();
    // The demo analysis stays on screen.
    await expect(page.getByText(/demo.*3 containers/i)).toBeVisible();
  });

  test('never sends the report off the page (privacy)', async ({ page }) => {
    const canary = 'PRIVACY-CANARY-9f3a2b7c';

    const requests: string[] = [];
    page.on('request', (request) => {
      requests.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`);
    });

    await page.goto('/');
    const baseline = requests.length;

    await page.getByLabel(/upload your cypress reports/i).setInputFiles({
      name: 'canary.json',
      mimeType: 'application/json',
      buffer: Buffer.from(reportWithCanary(canary)),
    });
    await expect(page.getByText(/canary\.json/)).toBeVisible();

    // No request anywhere ever carries the report content...
    for (const entry of requests) {
      expect(entry).not.toContain(canary);
    }
    // ...and the upload triggers no request to any non-local origin.
    const afterUpload = requests.slice(baseline);
    const offOrigin = afterUpload.filter((entry) => !/https?:\/\/(localhost|127\.0\.0\.1)/.test(entry));
    expect(offOrigin).toEqual([]);
  });
});
