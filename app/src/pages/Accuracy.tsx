import { SCOREBOARD } from '../lib/shipPolicy';
import { ruleTitle } from '../lib/rulesMeta';

// The scoreboard is bundled at build time (no fetch), so this page always matches the policy the
// results page enforces.

const STATUS_LABEL: Record<string, string> = {
  'as-specified': 'Shown',
  low: 'Low confidence',
  off: 'Off (tuning)',
  untested: 'Untested',
};

function pct(n: number | null): string {
  return n === null || Number.isNaN(n) ? '—' : `${Math.round(n * 100)}%`;
}

export default function Accuracy() {
  const sb = SCOREBOARD;
  return (
    <div className="page page--wide">
      <h1>Accuracy scoreboard</h1>
      <p>
        <strong>Caveat:</strong> {sb.caveat.charAt(0).toUpperCase() + sb.caveat.slice(1)}.
      </p>
      <p>{sb.method}</p>
      <p className="field__hint">
        Test corpus {sb.corpusVersion}: {sb.corpus.bills} synthetic bills ({sb.corpus.clean} with no planted
        errors, {sb.corpus.labels} planted errors). Scored {sb.generated}.
      </p>

      <div className="table-scroll" role="region" aria-label="Accuracy by check" tabIndex={0}>
        <table className="score-table">
          <caption>Precision and recall for each check</caption>
          <thead>
            <tr>
              <th scope="col">Check</th>
              <th scope="col">Precision</th>
              <th scope="col">Recall</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {sb.rules.map((r) => (
              <tr key={r.ruleId}>
                <td>
                  {ruleTitle(r.ruleId)}
                  <br />
                  <code className="score-table__id">{r.ruleId}</code>
                </td>
                <td>{pct(r.precision)}</td>
                <td>{pct(r.recall)}</td>
                <td>{STATUS_LABEL[r.shipAs] ?? 'Off (tuning)'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
