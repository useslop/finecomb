import { useEffect, useMemo, useState } from 'react';
import { useAppState } from '../state/AppState';
import { screen } from '@finecomb/engine';
import type { Insurance, ScreenResult } from '../types/engine';
import { TextField, NumberField, SelectField, DateField, CheckboxField } from '../components/fields';
import { US_STATES } from '../data/usStates';
import { Link } from '../router';

function icsDate(iso: string): string {
  return iso.replace(/-/g, '');
}

function buildIcs(events: { label: string; date: string; note: string }[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Finecomb//Deadline Tracker//EN'];
  events.forEach((e, i) => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:finecomb-${i}-${icsDate(e.date)}@local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(e.date)}`,
      `SUMMARY:${e.label.replace(/\r?\n/g, ' ')}`,
      `DESCRIPTION:${e.note.replace(/\r?\n/g, ' ')}`,
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const WORDING_LABEL: Record<ScreenResult['wording'], string> = {
  may_qualify: 'You may qualify',
  worth_asking: 'Worth asking',
  less_likely: 'Less likely, but ask anyway',
};

export default function Help() {
  const { ctx, setCtx, appData, ensureData, dataLoading } = useAppState();
  const [hospitalQuery, setHospitalQuery] = useState('');
  const [hipaaSentDate, setHipaaSentDate] = useState('');

  useEffect(() => {
    void ensureData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hospitalMatches =
    hospitalQuery.trim().length >= 2 && appData
      ? appData.hospitalIndex
          .filter((h) => {
            const q = hospitalQuery.trim().toLowerCase();
            return h.name.toLowerCase().includes(q) || h.city.toLowerCase().includes(q) || h.zip.startsWith(q);
          })
          .slice(0, 15)
      : [];
  const selectedHospital = ctx.hospitalCcn ? appData?.hospitals.find((h) => h.ccn === ctx.hospitalCcn) : undefined;

  const result = useMemo<ScreenResult | null>(() => {
    if (!appData) return null;
    return screen(ctx, appData.datasets, appData.fpl, appData.stateCharity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, appData]);

  const deadlineRows = useMemo(() => {
    const rows = (result?.deadlines ?? []).map((d) => ({ label: d.label, date: d.date, note: d.note }));
    if (hipaaSentDate) {
      const d = new Date(hipaaSentDate + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + 30);
      rows.push({
        label: 'HIPAA records request — provider must respond within 30 days',
        date: d.toISOString().slice(0, 10),
        note: 'Based on the date you told us you sent your HIPAA request (45 CFR 164.524).',
      });
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }, [result, hipaaSentDate]);

  return (
    <div className="page page--wide">
      <h1>Charity care &amp; assistance screener</h1>
      <p className="field__hint">
        This checks for financial assistance worth asking about. It never says "you qualify"; it
        says "you may qualify" only when your answers meet every condition of a verified state law
        (income, insurance, where you live, which hospital), with a citation. Not legal, medical or financial advice.
        {dataLoading && ' Loading reference data…'}
      </p>

      <div className="card">
        <h2>Your situation</h2>
        <div className="form-grid form-grid--2">
          <NumberField
            id="help-household-size"
            label="Household size"
            value={ctx.householdSize ?? ''}
            onChange={(v) => setCtx({ householdSize: v })}
          />
          <NumberField
            id="help-income"
            label="Annual household income"
            value={ctx.annualIncome ?? ''}
            onChange={(v) => setCtx({ annualIncome: v })}
          />
          <SelectField
            id="help-state"
            label="State"
            value={ctx.state ?? ''}
            onChange={(v) => setCtx({ state: v })}
            options={US_STATES.map(([code, name]) => ({ value: code, label: `${name} (${code})` }))}
          />
          <SelectField
            id="help-insurance"
            label="Health insurance"
            value={ctx.insurance ?? ''}
            onChange={(v) => setCtx({ insurance: (v || undefined) as Insurance | undefined })}
            options={[
              { value: 'none', label: 'None (uninsured / self-pay)' },
              { value: 'commercial', label: 'Employer or private plan' },
              { value: 'marketplace', label: 'Marketplace (ACA) plan' },
              { value: 'medicare', label: 'Medicare' },
              { value: 'medicaid', label: 'Medicaid' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </div>
        <CheckboxField
          id="help-resident"
          label={ctx.state ? `I live in ${ctx.state}` : 'I live in this state'}
          checked={Boolean(ctx.stateResident)}
          onChange={(v) => setCtx({ stateResident: v || undefined })}
        />

        <label className="field" htmlFor="help-hospital-search">
          <span className="field__label">Hospital (search by name, city or ZIP)</span>
          <input
            id="help-hospital-search"
            type="search"
            value={hospitalQuery}
            onChange={(e) => setHospitalQuery(e.target.value)}
            placeholder={dataLoading ? 'Loading hospitals…' : 'e.g. Dothan or 36301'}
          />
        </label>
        {hospitalMatches.length > 0 && (
          <ul className="search-results">
            {hospitalMatches.map((h) => (
              <li key={h.ccn}>
                <button
                  type="button"
                  onClick={() => {
                    setCtx({ hospitalCcn: h.ccn, state: ctx.state ?? h.state });
                    setHospitalQuery('');
                  }}
                >
                  {h.name} — {h.city}, {h.state} {h.zip}
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedHospital && (
          <p className="selected-hospital">
            Selected: <strong>{selectedHospital.name}</strong> ({selectedHospital.ownership}){' '}
            <button type="button" className="btn btn--ghost" onClick={() => setCtx({ hospitalCcn: undefined })}>
              Clear
            </button>
          </p>
        )}
        <DateField
          id="help-first-statement"
          label="First post-discharge billing statement date"
          hint="Used for the 501(r) 240-day application window and the 120-day collections floor."
          value={ctx.firstPostDischargeStatementDate ?? ''}
          onChange={(v) => setCtx({ firstPostDischargeStatementDate: v })}
        />
        <DateField
          id="help-first-bill"
          label="First bill date"
          hint="Used for the 120-day federal bill dispute (PPDR) deadline, if you're uninsured."
          value={ctx.firstBillDate ?? ''}
          onChange={(v) => setCtx({ firstBillDate: v })}
        />
      </div>

      {!appData && <div className="card">Loading reference data…</div>}

      {result && (
        <>
          <div className={`banner ${result.wording === 'may_qualify' ? 'banner--info' : 'banner--notice'}`}>
            <strong>{WORDING_LABEL[result.wording]}.</strong> {result.wordingText}
            {result.fplPercent != null && (
              <> You're at about <strong>{result.fplPercent}%</strong> of the 2026 federal poverty guideline for your household.</>
            )}
          </div>

          {result.hospital && (
            <div className="card">
              <h3>Your hospital</h3>
              <p>{result.hospital.message}</p>
              {result.hospital.citations.map((c) => (
                <p className="field__hint" key={c.id}>
                  <a href={c.url} target="_blank" rel="noreferrer">{c.title}</a>{' '}
                  {c.verified === 'unverified' ? <span className="unverified-badge">(not verified)</span> : <span className="verified-badge">(verified {c.verified})</span>}
                </p>
              ))}
            </div>
          )}

          {result.stateScreen && (
            <div className="card">
              <h3>
                {result.stateScreen.state}'s charity-care law{' '}
                {result.stateScreen.found && (result.stateScreen.verified ? (
                  <span className="verified-badge">(verified)</span>
                ) : (
                  <span className="unverified-badge">(not verified)</span>
                ))}
              </h3>
              <p>{result.stateScreen.message}</p>
              {result.stateScreen.caveats.length > 0 && (
                <ul>
                  {result.stateScreen.caveats.map((c, i) => <li key={i} className="field__hint">{c}</li>)}
                </ul>
              )}
              {result.stateScreen.citation && (
                <p className="field__hint">
                  {result.stateScreen.sourceUrl ? (
                    <a href={result.stateScreen.sourceUrl} target="_blank" rel="noreferrer">{result.stateScreen.citation}</a>
                  ) : result.stateScreen.citation}
                </p>
              )}
            </div>
          )}

          <div className="card">
            <h3>Nonprofit hospital timing (501(r))</h3>
            <p>{result.timing501r.message}</p>
          </div>

          <div className="card">
            <h3>Medicaid</h3>
            <p>{result.medicaid.message}</p>
          </div>
          <div className="card">
            <h3>Marketplace (ACA) coverage</h3>
            <p>{result.marketplace.message}</p>
          </div>

          <div className="card">
            <h3>Other assistance programs</h3>
            <ul className="hero-list">
              {result.programs.map((p) => (
                <li key={p.id}>
                  <strong>{p.title}</strong> — {p.detail}{' '}
                  {p.link && <a href={p.link} target="_blank" rel="noreferrer">{p.link}</a>}{' '}
                  {p.citations.some((c) => c.verified === 'unverified') ? (
                    <span className="unverified-badge">(not verified)</span>
                  ) : (
                    <span className="verified-badge">(verified)</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h3>Deadline tracker</h3>
            <TextField
              id="help-hipaa-sent"
              label="(Optional) Date you sent a HIPAA records request"
              hint="Adds the 30-day HIPAA response deadline below and to your calendar download."
              value={hipaaSentDate}
              onChange={(v) => setHipaaSentDate(v ?? '')}
            />
            {deadlineRows.length === 0 ? (
              <p className="field__hint">Add dates above to see your deadlines.</p>
            ) : (
              <ul>
                {deadlineRows.map((d, i) => (
                  <li key={i}>
                    <strong>{d.date}</strong> — {d.label}. <span className="field__hint">{d.note}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="btn-row no-print">
              <button
                type="button"
                className="btn btn--secondary"
                disabled={deadlineRows.length === 0}
                onClick={() => downloadText('finecomb-deadlines.ics', buildIcs(deadlineRows), 'text/calendar')}
              >
                Download .ics (add to calendar)
              </button>
            </div>
          </div>
        </>
      )}

      <p className="field__hint">
        See <Link to="/rights">Know your rights</Link> for the full citations behind these rules, or{' '}
        <Link to="/letters">write a letter</Link> to apply for financial assistance.
      </p>
    </div>
  );
}
