import { formatDuration } from '@ci-shard-advisor/core';
import type { Findings } from '@ci-shard-advisor/core';

interface FindingsCardProps {
  findings: Findings;
}

export function FindingsCard({ findings }: FindingsCardProps) {
  if (findings.warnings.length === 0 && findings.flaky.length === 0) return null;

  return (
    <section className="card" aria-labelledby="findings-heading">
      <h2 id="findings-heading">Findings</h2>
      {findings.warnings.length > 0 ? (
        <ul className="findings">
          {findings.warnings.map((warning, i) => (
            <li key={i}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {findings.flaky.length > 0 ? (
        <>
          <h3 className="findings__subhead">Flaky tests</h3>
          <table className="blocks">
            <thead>
              <tr>
                <th scope="col">Test</th>
                <th scope="col">Retries</th>
                <th scope="col">Wasted</th>
              </tr>
            </thead>
            <tbody>
              {findings.flaky.map((f) => (
                <tr key={f.id}>
                  <td>{f.title}</td>
                  <td>{f.retries}</td>
                  <td>{formatDuration(f.wastedMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </section>
  );
}
