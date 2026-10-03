import { useEffect } from 'react';
import { useAppState } from '../state/AppState';
import { CITATIONS } from '@finecomb/engine';
import type { Citation } from '../types/engine';
import { Link } from '../router';

function CiteBadge({ citation }: { citation: Citation }) {
  return (
    <span className="field__hint">
      {' '}
      <a href={citation.url} target="_blank" rel="noreferrer">{citation.title}</a>{' '}
      {citation.verified === 'unverified' ? (
        <span className="unverified-badge">(not verified)</span>
      ) : (
        <span className="verified-badge">(verified {citation.verified})</span>
      )}
    </span>
  );
}

function Claim({ text, cites }: { text: string; cites: Citation[] }) {
  return (
    <p>
      {text}
      {cites.map((c) => <CiteBadge key={c.id} citation={c} />)}
    </p>
  );
}

const TOPICS: { id: string; title: string; intro: string }[] = [
  { id: 'itemized', title: 'Itemized bills & HIPAA records', intro: 'Your right to see exactly what you were charged for, and to get your billing records.' },
  { id: 'nsa', title: 'No Surprises Act (insured)', intro: 'Protection from unexpected out-of-network bills for emergency care and certain in-network-facility care.' },
  { id: 'gfe-ppdr', title: 'Good Faith Estimates & the PPDR dispute (uninsured)', intro: "If you're uninsured or self-pay, what your estimate must say and what to do if the bill runs far over it." },
  { id: '501r', title: "Nonprofit hospitals' rules (501(r))", intro: 'Federal rules nonprofit hospitals must follow on financial assistance, pricing and collections.' },
  { id: 'state-charity', title: 'State charity-care law', intro: 'Many states mandate free or discounted care at certain income levels, on top of federal rules.' },
  { id: 'credit', title: 'Medical debt & credit reports', intro: 'What the credit bureaus do voluntarily, the status of the federal rule, and state bans.' },
  { id: 'medicaid', title: 'Medicaid retroactive coverage', intro: 'Medicaid can pay bills from before you applied — but the window is shrinking in 2027.' },
  { id: 'price-transparency', title: 'Price transparency', intro: "Hospitals must publish their prices. Here's how to use that when checking a bill." },
];

export default function Rights() {
  const { appData, ensureData } = useAppState();

  useEffect(() => {
    void ensureData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stateRows = appData?.stateCharity ? Object.values(appData.stateCharity.states).sort((a, b) => a.state.localeCompare(b.state)) : [];

  return (
    <div className="page page--wide">
      <h1>Know your rights</h1>
      <p className="field__hint">
        Consumer information, not legal, medical or financial advice. Every claim below links to the primary source we
        fetched, with the date we checked it. Unverified items are flagged — ask before relying on them.
      </p>

      <nav className="card no-print">
        <strong>Jump to:</strong>{' '}
        {TOPICS.map((t, i) => (
          <span key={t.id}>
            <a href={`#${t.id}`}>{t.title}</a>
            {i < TOPICS.length - 1 ? ' · ' : ''}
          </span>
        ))}
      </nav>

      <section className="card" id="itemized">
        <h2>{TOPICS[0]!.title}</h2>
        <p>{TOPICS[0]!.intro}</p>
        <Claim
          text='A covered provider must give you access to your "designated record set," which includes billing records — not just a summary statement.'
          cites={[CITATIONS.S15]}
        />
        <Claim
          text="The provider must act within 30 days of your request, with one 30-day extension allowed if they explain why."
          cites={[CITATIONS.S16]}
        />
        <Claim
          text="Any copying fee must be reasonable and cost-based (labor, supplies, postage) — not an arbitrary records fee."
          cites={[CITATIONS.S16]}
        />
        <Claim
          text="Florida law requires an itemized statement within 7 days of discharge or your request, listing services by date and provider with unit pricing, and a response to a billing complaint within 7 business days. Other states' itemized-bill laws haven't been verified yet — check yours."
          cites={[CITATIONS.S41]}
        />
        <p className="field__hint"><Link to="/letters">Use letter L1 or L7</Link> to request these records.</p>
      </section>

      <section className="card" id="nsa">
        <h2>{TOPICS[1]!.title}</h2>
        <p>{TOPICS[1]!.intro}</p>
        <Claim
          text="Out-of-network emergency care can't cost you more than your plan's in-network cost-sharing — the provider can't bill you for the difference."
          cites={[CITATIONS.S6]}
        />
        <Claim
          text="The same protection applies to certain out-of-network clinicians (emergency medicine, anesthesiology, pathology, radiology, neonatology, assistant surgeons, hospitalists, intensivists, and diagnostic lab/imaging) at an in-network hospital or surgery center, even if you signed a consent form — consent isn't allowed for these specialties."
          cites={[CITATIONS.S7]}
        />
        <Claim
          text="Air ambulance rides are protected the same way. Ground ambulance is not protected by this federal law, though your state may have its own rule."
          cites={[CITATIONS.S8]}
        />
        <p className="field__hint">Complaints: No Surprises Help Desk, 1-800-985-3059. <Link to="/letters">Letter L4</Link> covers this.</p>
      </section>

      <section className="card" id="gfe-ppdr">
        <h2>{TOPICS[2]!.title}</h2>
        <p>{TOPICS[2]!.intro}</p>
        <Claim
          text="If you're uninsured or self-pay and a provider or facility bills you at least $400 more than its own Good Faith Estimate, you may be able to start a federal dispute (PPDR) within 120 days of receiving the first bill with those charges."
          cites={[CITATIONS.S4]}
        />
        <Claim
          text="Your Good Faith Estimate is due within 1 business day of scheduling (3+ business days out), 3 business days (10+ business days out), or 3 business days of your request."
          cites={[CITATIONS.S5]}
        />
        <Claim
          text="The dispute has a $25 non-refundable fee; if the decision goes your way, the $25 is deducted from what you owe the provider. While it's pending, the provider can't send you to collections, must pause any collection already underway, and must suspend late fees."
          cites={[CITATIONS.S3]}
        />
        <p className="field__hint"><Link to="/help">Check your deadline</Link> or use <Link to="/letters">letter L5</Link>.</p>
      </section>

      <section className="card" id="501r">
        <h2>{TOPICS[3]!.title}</h2>
        <p>{TOPICS[3]!.intro}</p>
        <Claim
          text="Nonprofit (501(c)(3)) hospitals must publish a Financial Assistance Policy, a plain-language summary, and post notice on billing statements — free, in the ER and admissions areas, and online."
          cites={[CITATIONS.S10]}
        />
        <Claim
          text="Eligible patients can't be charged more than the amounts generally billed to insured patients for emergency or medically necessary care."
          cites={[CITATIONS.S11]}
        />
        <Claim
          text="The application window runs at least 240 days from your first post-discharge billing statement; hospitals may accept later applications too."
          cites={[CITATIONS.S13]}
        />
        <Claim
          text="No 'extraordinary collection action' (credit reporting, lawsuits, selling the debt, wage garnishment, liens) is allowed in the first 120 days, and the hospital must give 30 days' written notice before any such action — and must pause them entirely while your application is pending."
          cites={[CITATIONS.S12, CITATIONS.S14]}
        />
        <p className="field__hint">CMS ownership data is a strong signal of nonprofit status, not proof — confirm on the IRS Tax Exempt Organization Search. <Link to="/help">Look up your hospital</Link> or use <Link to="/letters">letter L3</Link>.</p>
      </section>

      <section className="card" id="state-charity">
        <h2>{TOPICS[4]!.title}</h2>
        <p>{TOPICS[4]!.intro} <Link to="/help">Run the screener</Link> for your specific state and hospital.</p>
        {stateRows.length === 0 ? (
          <p className="field__hint">Loading…</p>
        ) : (
          <div className="table-scroll">
            <table className="grid-table">
              <thead>
                <tr><th>State</th><th>What the law does</th><th>Citation</th><th>Status</th></tr>
              </thead>
              <tbody>
                {stateRows.map((r) => (
                  <tr key={r.state}>
                    <td>{r.state}</td>
                    <td>{r.summary}</td>
                    <td>{r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noreferrer">{r.citation}</a> : r.citation}</td>
                    <td>{r.verified ? <span className="verified-badge">verified</span> : <span className="unverified-badge">not verified</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="field__hint">Researched 2026-10-01; only a subset of states (plus a few confirmed "no mandate found"). Not every state has been checked.</p>
      </section>

      <section className="card" id="credit">
        <h2>{TOPICS[5]!.title}</h2>
        <p>{TOPICS[5]!.intro}</p>
        <Claim
          text="The CFPB's rule banning medical debt from credit reports was vacated by a federal court on 2025-07-11, at the Bureau's own request — it is not in force."
          cites={[CITATIONS.CFPBVACATED2025]}
        />
        <Claim
          text="Separately, the three credit bureaus (Equifax, Experian, TransUnion) announced in 2022-2023 that they exclude paid medical collections, medical collections under $500, and unpaid medical collections less than a year old. This is a company policy, not a law, and could change."
          cites={[CITATIONS.CRB2023]}
        />
        <Claim
          text="A 2025 CFPB interpretive rule says federal credit-reporting law generally preempts state medical-debt reporting bans; a Colorado case challenging that state's ban was pending when we checked (2026-10-01), so a state ban should be treated as 'applies unless a court rules it preempted,' not a guarantee."
          cites={[CITATIONS.CFPBPREEMPT2025, CITATIONS.NCLCMEDDEBT]}
        />
      </section>

      <section className="card" id="medicaid">
        <h2>{TOPICS[6]!.title}</h2>
        <p>{TOPICS[6]!.intro}</p>
        <Claim
          text="Today, Medicaid can cover eligible care from up to 3 months before your application month."
          cites={[CITATIONS.PL11921]}
        />
        <Claim
          text="For applications filed on or after 2027-01-01, that drops to 1 month before for expansion adults, or 2 months before for everyone else."
          cites={[CITATIONS.CMSCIB2025]}
        />
        <p className="field__hint">If you're uninsured, applying before 2027 may preserve more retroactive coverage.</p>
      </section>

      <section className="card" id="price-transparency">
        <h2>{TOPICS[7]!.title}</h2>
        <p>{TOPICS[7]!.intro}</p>
        <Claim
          text="Hospitals must publish a machine-readable file of their standard charges — including gross charges, discounted cash prices, and payer-specific negotiated rates — plus a consumer-friendly shoppable-services list or price estimator."
          cites={[CITATIONS.S17, CITATIONS.S18]}
        />
        <p className="field__hint">
          Finecomb doesn't fetch a hospital's price file automatically — that would mean sending
          your billing codes to the hospital's site. If you open one yourself, Finecomb labels
          that as an explicit click, and parses anything you download locally.
        </p>
      </section>

      <p className="field__hint">
        Full source list, including everything marked unverified above: see the Build Receipt and
        <code> docs/RESEARCH.md</code> in the open-source repo (link on <Link to="/accuracy">/accuracy</Link>).
      </p>
    </div>
  );
}
