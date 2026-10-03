import { SCOREBOARD, type Scoreboard } from '../lib/shipPolicy';
import { ruleTitle } from '../lib/rulesMeta';
import { RULES_WITHOUT_SHIPPED_DATA } from '../data';

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
  const hm = sb.handmade ?? null;
  return (
    <div className="page page--wide">
      <h1>Accuracy scoreboard</h1>
      <p>
        <strong>Caveat:</strong> {sb.caveat.charAt(0).toUpperCase() + sb.caveat.slice(1)}.
      </p>
      <p>{sb.method}</p>
      <p className="field__hint">
        Test corpus {sb.corpusVersion}: {sb.corpus.bills} generated bills ({sb.corpus.clean} with no planted
        errors, {sb.corpus.labels} planted errors). Scored {sb.generated}.
      </p>
      {hm && <HandmadeSection hm={hm} />}
      <h2>Generated bills, by check</h2>

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
                <td>
                  {RULES_WITHOUT_SHIPPED_DATA[r.ruleId]
                    ? 'Not run here*'
                    : (STATUS_LABEL[r.shipAs] ?? 'Off (tuning)')}
                  {r.shipAsReason && !RULES_WITHOUT_SHIPPED_DATA[r.ruleId] && <span className="field__hint"> †</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field__hint">
        * Measured with test data, but this app can't run it on your bill: it needs a CMS table
        ({Object.values(RULES_WITHOUT_SHIPPED_DATA).join(', ')}) that carries licensed AMA codes, so
        we don't redistribute it. Your results list it under "Checks we couldn't run".
      </p>
      <p className="field__hint">
        † Shown at Low confidence for now:{' '}
        {sb.rules.filter((r) => r.shipAsReason && !RULES_WITHOUT_SHIPPED_DATA[r.ruleId]).map((r) => `${r.ruleId}: ${r.shipAsReason}`).join(' ')}
      </p>
    </div>
  );
}

function HandmadeSection({ hm }: { hm: NonNullable<Scoreboard['handmade']> }) {
  const run = hm.blind ?? hm.current;
  return (
    <section className="card">
      <h2>Hand-made bills: the more honest test</h2>
      <p>{hm.note}</p>
      <p>
        On the first run, before any fix: <strong>{pct(run.overall.precision)} precision</strong> ({run.overall.tp} of{' '}
        {run.overall.tp + run.overall.fp} flags were right) and <strong>{pct(run.overall.recall)} recall</strong>{' '}
        ({run.overall.tp} of {run.overall.tp + run.overall.fn} expected issues found), on {hm.bills} bills.
        {hm.blind && <> After the fixes it prompted: {pct(hm.current.overall.precision)} precision, {pct(hm.current.overall.recall)} recall; that second number is no longer a blind test.</>}
      </p>
      {run.falsePositives && run.falsePositives.length > 0 && (
        <>
          <h3>What it got wrong on the first run</h3>
          <ul>
            {run.falsePositives.map((x) => <li key={`fp-${x.ruleId}-${x.bill}`}>{x.ruleId} ({x.bill}): flagged {x.detail.split(' | ')[0]}.</li>)}
            {(run.misses ?? []).map((x) => <li key={`fn-${x.ruleId}-${x.bill}`}>{x.ruleId} ({x.bill}): missed an expected issue.</li>)}
          </ul>
        </>
      )}
      <p className="field__hint">
        Fifteen bills is a small sample, and the same person wrote the bills and judged the results. Treat every
        finding as a question to ask, not a verdict.
      </p>
    </section>
  );
}
