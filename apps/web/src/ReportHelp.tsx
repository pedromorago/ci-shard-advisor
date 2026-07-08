/**
 * In-app guidance so a first-time user knows exactly what file to upload and
 * how to produce it. The report is a test-runner reporter output, not something
 * that exists by default.
 */
export function ReportHelp() {
  return (
    <details className="card details help">
      <summary>Which file do I upload, and how do I get it?</summary>
      <div className="details__body">
        <p>
          Upload the <strong>JSON</strong> your test runner writes (or a{' '}
          <strong>JUnit XML</strong>). It is not produced by default — you turn on a
          reporter. In CI it is saved as a build <strong>artifact</strong> you download.
        </p>

        <h3>Playwright</h3>
        <p>
          Enable the JSON reporter, run your tests, then upload <code>report.json</code>:
        </p>
        <pre className="help__code">
          <code>{`// playwright.config.ts
reporter: [['json', { outputFile: 'report.json' }]]`}</code>
        </pre>
        <p>
          Sharded in CI? Merge the shards first (<code>merge-reports</code>) — see the
          templates in <code>examples/ci</code>.
        </p>

        <h3>Cypress</h3>
        <pre className="help__code">
          <code>{'npx cypress run --reporter json > report.json'}</code>
        </pre>

        <h3>Any runner — JUnit XML</h3>
        <p>Jest, pytest, Playwright, Maven… all can emit JUnit XML:</p>
        <pre className="help__code">
          <code>{'npx playwright test --reporter=junit   # → results.xml'}</code>
        </pre>
      </div>
    </details>
  );
}
