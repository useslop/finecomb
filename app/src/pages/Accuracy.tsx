import { useEffect, useState } from 'react';

type Scoreboard = Record<string, unknown>;

// Renders public/scoreboard.json if B2's CI evaluator has written one; otherwise "coming soon".
export default function Accuracy() {
  const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/scoreboard.json')
      .then((res) => (res.ok ? (res.json() as Promise<Scoreboard>) : null))
      .then((data) => {
        if (!cancelled) setScoreboard(data);
      })
      .catch(() => {
        if (!cancelled) setScoreboard(null);
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <h1>Accuracy scoreboard</h1>
      <p className="field__hint">
        Measured on a synthetic test corpus, not real bills — real-world accuracy may be lower.
      </p>

      {!checked && <p>Loading…</p>}

      {checked && !scoreboard && (
        <div className="placeholder-note">
          <p>
            No scoreboard published yet. Once the test corpus and evaluator run in CI, results
            (commit, corpus version, date, and per-rule precision / recall / F1) will show here.
          </p>
        </div>
      )}

      {checked && scoreboard && (
        <div className="card">
          <pre>{JSON.stringify(scoreboard, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
