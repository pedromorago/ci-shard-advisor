/**
 * In-app guidance so a first-time Cypress user knows exactly what file to
 * upload and how to produce it. The report is a reporter output, not something
 * `cypress run` writes by default.
 */
export function ReportHelp() {
  return (
    <details className="card details help">
      <summary>Which file do I upload, and how do I get it?</summary>
      <div className="details__body">
        <p>
          Upload the <strong>JSON report</strong> of your last Cypress run — ideally{' '}
          <strong>one file per container</strong> (that lets the advisor <em>measure</em> your
          real split, imbalance included). In CI each container saves it as a build{' '}
          <strong>artifact</strong> you download.
        </p>

        <h3>The standard way: mochawesome</h3>
        <p>Cypress has no built-in JSON reporter, so use <code>mochawesome</code>:</p>
        <pre className="help__code">
          <code>{`npm i -D mochawesome
npx cypress run --reporter mochawesome \\
  --reporter-options "reportDir=reports,overwrite=false,html=false,json=true"
# → reports/mochawesome*.json  (upload these)`}</code>
        </pre>
        <p>
          Running several containers? Add that reporter to <em>each</em> container's{' '}
          <code>cypress run</code> and upload every container's JSON together.
        </p>

        <h3>Also accepted: the Module API result</h3>
        <p>
          If you drive Cypress from a script, the object <code>cypress.run()</code> resolves
          with (saved as JSON) works too — retries included, which powers the flaky findings.
        </p>
      </div>
    </details>
  );
}
