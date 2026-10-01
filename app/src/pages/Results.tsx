import { useAppState } from '../state/AppState';
import { Link, useNavigate } from '../router';
import { NotAdviceBanner } from '../components/Banner';
import FindingCard from '../components/FindingCard';

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function Results() {
  const { bill, result, findingActions, setFindingAction, resetCheck } = useAppState();
  const navigate = useNavigate();

  if (!result) {
    return (
      <div className="page">
        <h1>No results yet</h1>
        <p className="field__hint">
          Results live only in this browser tab's memory, so a reload clears them — nothing is
          saved to a server or to disk.
        </p>
        <Link to="/check" className="btn btn--primary">
          Start a check
        </Link>
      </div>
    );
  }

  const dollars = result.findings.reduce((sum, f) => sum + (f.dollarsAtStake ?? 0), 0);
  const byConfidence = result.findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.confidence] = (acc[f.confidence] ?? 0) + 1;
    return acc;
  }, {});

  const exportJson = () => {
    const payload = { exportedAt: new Date().toISOString(), bill, result, findingActions };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finecomb-results.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page page--wide">
      <h1>Your results</h1>
      <NotAdviceBanner />

      <div className="summary-stats">
        <div className="summary-stats__item">
          <span className="summary-stats__value">{result.findings.length}</span>
          <span className="summary-stats__label">possible issues to ask about</span>
        </div>
        <div className="summary-stats__item">
          <span className="summary-stats__value">{formatMoney(dollars)}</span>
          <span className="summary-stats__label">at stake where computable</span>
        </div>
        <div className="summary-stats__item">
          <span className="summary-stats__value">
            {['high', 'medium', 'low'].map((c) => byConfidence[c] ?? 0).join(' / ')}
          </span>
          <span className="summary-stats__label">high / medium / low confidence</span>
        </div>
      </div>

      <div className="btn-row no-print">
        <button type="button" className="btn btn--secondary" onClick={() => window.print()}>
          Print / save PDF
        </button>
        <button type="button" className="btn btn--secondary" onClick={exportJson}>
          Export JSON
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            resetCheck();
            navigate('/check');
          }}
        >
          Start a new check
        </button>
      </div>

      {result.findings.length === 0 && (
        <div className="card">
          <p>
            No findings to show.{' '}
            {bill.lines.length === 0
              ? 'Add a bill to get started.'
              : "That can mean a clean bill, or that the rule engine isn't wired in yet — check /accuracy."}
          </p>
        </div>
      )}

      {result.findings.map((f) => (
        <FindingCard
          key={f.id}
          finding={f}
          lines={bill.lines}
          action={findingActions[f.id]}
          onAction={(a) => setFindingAction(f.id, a)}
        />
      ))}

      {result.infoCards.length > 0 && (
        <>
          <h2>Worth knowing</h2>
          {result.infoCards.map((f) => (
            <FindingCard
              key={f.id}
              finding={f}
              lines={bill.lines}
              action={findingActions[f.id]}
              onAction={(a) => setFindingAction(f.id, a)}
            />
          ))}
        </>
      )}

      {result.skipped.length > 0 && (
        <details className="card no-print">
          <summary>Checks we couldn't run ({result.skipped.length})</summary>
          <ul>
            {result.skipped.map((s, i) => (
              <li key={i}>
                <code>{s.ruleId}</code> — needs: {s.needs.join(', ')}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
