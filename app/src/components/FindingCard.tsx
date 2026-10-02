import type { BillLine, Finding } from '../types/engine';
import type { FindingAction } from '../state/AppState';

const CONFIDENCE_LABEL: Record<Finding['confidence'], string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
  info: 'Info',
};

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function FindingCard({
  finding,
  lines,
  action,
  onAction,
}: {
  finding: Finding;
  lines: BillLine[];
  action: FindingAction | undefined;
  onAction: (action: FindingAction) => void;
}) {
  const evidence = finding.evidenceLineIds
    .map((id) => lines.find((l) => l.id === id))
    .filter((l): l is BillLine => Boolean(l));

  return (
    <article className="card finding-card">
      <div className="finding-card__header">
        <h3 className="finding-card__title">{finding.title}</h3>
        <span className={`badge badge--${finding.confidence}`}>{CONFIDENCE_LABEL[finding.confidence]}</span>
        {finding.dollarsAtStake !== null && (
          <span className="finding-card__dollars">{formatMoney(finding.dollarsAtStake)} at stake</span>
        )}
      </div>

      <p className="finding-card__why">{finding.userText || finding.why}</p>

      {evidence.length > 0 && (
        <div className="finding-card__evidence">
          {evidence.map((line) => (
            <div className="finding-card__evidence-row" key={line.id}>
              <span>
                {line.date ? `${line.date} — ` : ''}
                {line.description}
                {line.code ? ` (${line.code})` : ''}
              </span>
              <span>{formatMoney(line.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <p className="finding-card__verify">
        <strong>How to verify:</strong> {finding.verify}
      </p>

      {finding.citations.length > 0 && (
        <ul className="finding-card__citations">
          {finding.citations.map((c) => (
            <li key={c.id}>
              <a href={c.url} target="_blank" rel="noreferrer">
                {c.title}
              </a>{' '}
              {c.verified === 'unverified' ? (
                <span className="unverified-badge">(not verified)</span>
              ) : (
                <span className="verified-badge">(verified {c.verified})</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="field__hint">Rule {finding.ruleId}</p>

      {/* Info cards are pointers, not disputes: they never go into a dispute letter. */}
      {finding.confidence !== 'info' && (
        <div className="finding-card__actions no-print">
          <button
            type="button"
            className={`btn btn--secondary ${action === 'dispute' ? 'is-active' : ''}`}
            onClick={() => onAction('dispute')}
          >
            {action === 'dispute' ? '✓ Added to dispute letter' : 'Add to dispute letter'}
          </button>
          <button
            type="button"
            className={`btn btn--ghost ${action === 'dismissed' ? 'is-active' : ''}`}
            onClick={() => onAction('dismissed')}
          >
            {action === 'dismissed' ? '✓ Marked not an issue' : 'Not an issue'}
          </button>
        </div>
      )}
    </article>
  );
}
