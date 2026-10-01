import { useEffect, useState } from 'react';
import { useAppState } from '../../state/AppState';
import { TextField, DateField, NumberField, CheckboxField, SelectField } from '../../components/fields';
import type { CollectionEvent, Context, Eob, GroupCode, Insurance } from '../../types/engine';

type GfeEntry = NonNullable<Context['gfe']>[number];
type AdjustmentEntry = NonNullable<Eob['adjustments']>[number];

const INSURANCE_OPTIONS: { value: Insurance; label: string }[] = [
  { value: 'none', label: 'None / self-pay' },
  { value: 'commercial', label: 'Commercial (employer or individual plan)' },
  { value: 'marketplace', label: 'ACA Marketplace' },
  { value: 'medicare', label: 'Medicare' },
  { value: 'medicaid', label: 'Medicaid' },
  { value: 'other', label: 'Other' },
];

const OON_CLINICIAN_TYPES = [
  'Emergency medicine',
  'Anesthesia',
  'Pathology',
  'Radiology',
  'Neonatology',
  'Assistant surgeon',
  'Hospitalist',
  'Intensivist',
  'Diagnostic lab / imaging',
];

const COLLECTION_KINDS: { value: CollectionEvent['kind']; label: string }[] = [
  { value: 'collections', label: 'Sent to collections' },
  { value: 'credit_report', label: 'Reported to credit bureau' },
  { value: 'lawsuit', label: 'Lawsuit filed' },
  { value: 'wage_garnishment', label: 'Wage garnishment' },
  { value: 'late_fee', label: 'Late fee charged' },
  { value: 'other', label: 'Other' },
];

const GROUP_CODES: { value: GroupCode; label: string }[] = [
  { value: 'CO', label: 'CO — Contractual obligation' },
  { value: 'PR', label: 'PR — Patient responsibility' },
  { value: 'OA', label: 'OA — Other adjustment' },
  { value: 'PI', label: 'PI — Payer initiated' },
  { value: 'CR', label: 'CR — Corrections / reversal' },
];

const US_STATES: [string, string][] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];

export default function Step3Context({ onBack, onFinish }: { onBack: () => void; onFinish: () => Promise<void> }) {
  const { ctx, setCtx, appData, ensureData, dataLoading } = useAppState();
  const [hospitalQuery, setHospitalQuery] = useState('');
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    void ensureData();
    // ensureData is stable for the life of the provider; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hospitalMatches =
    hospitalQuery.trim().length >= 2 && appData
      ? appData.hospitalIndex
          .filter((h) => {
            const q = hospitalQuery.trim().toLowerCase();
            return h.name.toLowerCase().includes(q) || h.city.toLowerCase().includes(q) || h.zip.startsWith(q);
          })
          .slice(0, 20)
      : [];

  const selectedHospital = ctx.hospitalCcn ? appData?.hospitals.find((h) => h.ccn === ctx.hospitalCcn) : undefined;

  const eob = ctx.eob ?? {};
  const updateEob = (patch: Partial<Eob>) => setCtx({ eob: { ...eob, ...patch } });

  const addGfe = () => setCtx({ gfe: [...(ctx.gfe ?? []), { provider: '', total: 0 }] });
  const updateGfe = (i: number, patch: Partial<GfeEntry>) => {
    const next = [...(ctx.gfe ?? [])];
    const current = next[i];
    if (!current) return;
    next[i] = { ...current, ...patch };
    setCtx({ gfe: next });
  };
  const removeGfe = (i: number) => setCtx({ gfe: (ctx.gfe ?? []).filter((_, idx) => idx !== i) });

  const addAdjustment = () => updateEob({ adjustments: [...(eob.adjustments ?? []), { group: 'CO', amount: 0 }] });
  const updateAdjustment = (i: number, patch: Partial<AdjustmentEntry>) => {
    const next = [...(eob.adjustments ?? [])];
    const current = next[i];
    if (!current) return;
    next[i] = { ...current, ...patch };
    updateEob({ adjustments: next });
  };
  const removeAdjustment = (i: number) => updateEob({ adjustments: (eob.adjustments ?? []).filter((_, idx) => idx !== i) });

  const addCollection = () => setCtx({ collections: [...(ctx.collections ?? []), { date: '', kind: 'collections' }] });
  const updateCollection = (i: number, patch: Partial<CollectionEvent>) => {
    const next = [...(ctx.collections ?? [])];
    const current = next[i];
    if (!current) return;
    next[i] = { ...current, ...patch };
    setCtx({ collections: next });
  };
  const removeCollection = (i: number) => setCtx({ collections: (ctx.collections ?? []).filter((_, idx) => idx !== i) });

  return (
    <div>
      <p className="field__hint">
        Every question here is optional — skip anything you don't know. Skipped answers just mean
        fewer checks run; you'll see what was skipped and why on your results.
      </p>

      <fieldset>
        <legend>Insurance</legend>
        <SelectField
          id="ins"
          label="Insurance"
          value={ctx.insurance ?? ''}
          onChange={(v) => setCtx({ insurance: v as Insurance | undefined })}
          options={INSURANCE_OPTIONS}
        />
        <TextField id="ins-name" label="Insurer name" value={ctx.insurerName ?? ''} onChange={(v) => setCtx({ insurerName: v })} />
        <CheckboxField
          id="ins-secondary"
          label="I have secondary coverage too"
          checked={Boolean(ctx.secondary)}
          onChange={(v) => setCtx({ secondary: v || undefined })}
        />
      </fieldset>

      <fieldset>
        <legend>Admission</legend>
        <CheckboxField id="admitted" label="I was admitted as an inpatient" checked={Boolean(ctx.admitted)} onChange={(v) => setCtx({ admitted: v || undefined })} />
        <CheckboxField id="observation" label="I was under observation status" checked={Boolean(ctx.observation)} onChange={(v) => setCtx({ observation: v || undefined })} />
        <CheckboxField id="emergency" label="This was emergency care" checked={Boolean(ctx.emergency)} onChange={(v) => setCtx({ emergency: v || undefined })} />
        <CheckboxField id="air" label="Air ambulance was used" checked={Boolean(ctx.airAmbulance)} onChange={(v) => setCtx({ airAmbulance: v || undefined })} />
      </fieldset>

      <fieldset>
        <legend>Network</legend>
        <SelectField
          id="in-network"
          label="Was the facility in-network?"
          value={ctx.facilityInNetwork === undefined ? '' : String(ctx.facilityInNetwork)}
          onChange={(v) => setCtx({ facilityInNetwork: v === undefined ? undefined : v === 'true' })}
          options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
        />
        <fieldset>
          <legend>Were any of these out-of-network?</legend>
          {OON_CLINICIAN_TYPES.map((type) => (
            <CheckboxField
              key={type}
              id={`oon-${type}`}
              label={type}
              checked={(ctx.oonClinicianTypes ?? []).includes(type)}
              onChange={(checked) => {
                const current = ctx.oonClinicianTypes ?? [];
                setCtx({ oonClinicianTypes: checked ? [...current, type] : current.filter((t) => t !== type) });
              }}
            />
          ))}
        </fieldset>
      </fieldset>

      <fieldset>
        <legend>If uninsured: Good Faith Estimate</legend>
        <CheckboxField
          id="scheduled-ahead"
          label="I scheduled this care ahead of time"
          checked={Boolean(ctx.scheduledAhead)}
          onChange={(v) => setCtx({ scheduledAhead: v || undefined })}
        />
        {(ctx.gfe ?? []).map((g, i) => (
          <div className="form-grid form-grid--2" key={i}>
            <TextField id={`gfe-provider-${i}`} label="Provider" value={g.provider} onChange={(v) => updateGfe(i, { provider: v ?? '' })} />
            <NumberField id={`gfe-total-${i}`} label="GFE total" value={g.total} onChange={(v) => updateGfe(i, { total: v ?? 0 })} />
            <button type="button" className="btn btn--ghost" onClick={() => removeGfe(i)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn btn--secondary" onClick={addGfe}>
          + Add a Good Faith Estimate
        </button>
      </fieldset>

      <fieldset>
        <legend>Explanation of Benefits (EOB)</legend>
        <div className="form-grid form-grid--2">
          <NumberField id="eob-billed" label="Billed" value={eob.billed ?? ''} onChange={(v) => updateEob({ billed: v })} />
          <NumberField id="eob-allowed" label="Allowed amount" value={eob.allowed ?? ''} onChange={(v) => updateEob({ allowed: v })} />
          <NumberField id="eob-planpaid" label="Plan paid" value={eob.planPaid ?? ''} onChange={(v) => updateEob({ planPaid: v })} />
          <NumberField id="eob-deductible" label="Deductible" value={eob.deductible ?? ''} onChange={(v) => updateEob({ deductible: v })} />
          <NumberField id="eob-copay" label="Copay" value={eob.copay ?? ''} onChange={(v) => updateEob({ copay: v })} />
          <NumberField id="eob-coinsurance" label="Coinsurance" value={eob.coinsurance ?? ''} onChange={(v) => updateEob({ coinsurance: v })} />
          <NumberField id="eob-noncovered" label="Non-covered" value={eob.nonCovered ?? ''} onChange={(v) => updateEob({ nonCovered: v })} />
          <NumberField id="eob-pr" label="Patient responsibility" value={eob.patientResponsibility ?? ''} onChange={(v) => updateEob({ patientResponsibility: v })} />
        </div>

        <h4>Adjustment / reason codes (as typed on the EOB)</h4>
        {(eob.adjustments ?? []).map((a, i) => (
          <div className="form-grid form-grid--2" key={i}>
            <SelectField
              id={`adj-group-${i}`}
              label="Group code"
              value={a.group}
              onChange={(v) => { if (v) updateAdjustment(i, { group: v as GroupCode }); }}
              options={GROUP_CODES}
              placeholder="Choose"
            />
            <TextField id={`adj-reason-${i}`} label="Reason code" value={a.reason ?? ''} onChange={(v) => updateAdjustment(i, { reason: v })} />
            <NumberField id={`adj-amount-${i}`} label="Amount" value={a.amount} onChange={(v) => updateAdjustment(i, { amount: v ?? 0 })} />
            <button type="button" className="btn btn--ghost" onClick={() => removeAdjustment(i)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn btn--secondary" onClick={addAdjustment}>
          + Add an adjustment code
        </button>
      </fieldset>

      <fieldset>
        <legend>Dates</legend>
        <div className="form-grid form-grid--2">
          <DateField id="first-bill" label="First bill date" value={ctx.firstBillDate ?? ''} onChange={(v) => setCtx({ firstBillDate: v })} />
          <DateField
            id="first-post-discharge"
            label="First post-discharge statement date"
            value={ctx.firstPostDischargeStatementDate ?? ''}
            onChange={(v) => setCtx({ firstPostDischargeStatementDate: v })}
          />
        </div>

        <h4>Collections, credit reporting, late fees</h4>
        {(ctx.collections ?? []).map((c, i) => (
          <div className="form-grid form-grid--2" key={i}>
            <DateField id={`coll-date-${i}`} label="Date" value={c.date} onChange={(v) => updateCollection(i, { date: v ?? '' })} />
            <SelectField
              id={`coll-kind-${i}`}
              label="Event"
              value={c.kind}
              onChange={(v) => { if (v) updateCollection(i, { kind: v as CollectionEvent['kind'] }); }}
              options={COLLECTION_KINDS}
              placeholder="Choose"
            />
            <DateField id={`coll-notice-${i}`} label="30-day notice date (if any)" value={c.noticeDate ?? ''} onChange={(v) => updateCollection(i, { noticeDate: v })} />
            <button type="button" className="btn btn--ghost" onClick={() => removeCollection(i)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn btn--secondary" onClick={addCollection}>
          + Add an event
        </button>
      </fieldset>

      <fieldset>
        <legend>Dispute & credit status</legend>
        <div className="form-grid form-grid--2">
          <DateField id="ppdr" label="PPDR filed date" value={ctx.ppdrFiledDate ?? ''} onChange={(v) => setCtx({ ppdrFiledDate: v })} />
          <DateField id="fap-applied-date" label="Financial assistance applied date" value={ctx.fapAppliedDate ?? ''} onChange={(v) => setCtx({ fapAppliedDate: v })} />
        </div>
        <CheckboxField id="fap-applied" label="I applied for financial assistance" checked={Boolean(ctx.fapApplied)} onChange={(v) => setCtx({ fapApplied: v || undefined })} />
        <CheckboxField id="on-credit" label="This is on my credit report" checked={Boolean(ctx.onCreditReport)} onChange={(v) => setCtx({ onCreditReport: v || undefined })} />
        <CheckboxField id="paid-full" label="I've paid this in full" checked={Boolean(ctx.paidInFull)} onChange={(v) => setCtx({ paidInFull: v || undefined })} />
        <NumberField id="original-balance" label="Original balance" value={ctx.originalBalance ?? ''} onChange={(v) => setCtx({ originalBalance: v })} />
      </fieldset>

      <fieldset>
        <legend>Location & hospital</legend>
        <SelectField
          id="state"
          label="State"
          value={ctx.state ?? ''}
          onChange={(v) => setCtx({ state: v })}
          options={US_STATES.map(([code, name]) => ({ value: code, label: `${name} (${code})` }))}
        />

        <label className="field" htmlFor="hospital-search">
          <span className="field__label">Hospital (search by name, city or ZIP)</span>
          <input
            id="hospital-search"
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
      </fieldset>

      <fieldset>
        <legend>Household (used by the charity-care screener)</legend>
        <div className="form-grid form-grid--2">
          <NumberField id="household-size" label="Household size" value={ctx.householdSize ?? ''} onChange={(v) => setCtx({ householdSize: v })} />
          <NumberField id="annual-income" label="Annual household income" value={ctx.annualIncome ?? ''} onChange={(v) => setCtx({ annualIncome: v })} />
        </div>
      </fieldset>

      <div className="btn-row">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={finishing}
          onClick={() => {
            setFinishing(true);
            void onFinish();
          }}
        >
          {finishing ? 'Checking…' : 'See results'}
        </button>
      </div>
    </div>
  );
}
