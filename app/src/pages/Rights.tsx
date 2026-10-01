import { Link } from '../router';

// Placeholder — lane B4 owns this page's real content (one static, cited page per topic).
export default function Rights() {
  return (
    <div className="page">
      <h1>Know your rights</h1>
      <div className="placeholder-note">
        <p>
          Static, cited explainers are coming for: itemized bills & HIPAA, the No Surprises Act,
          Good Faith Estimates & the PPDR dispute process, nonprofit hospitals' 501(r) rules, state
          charity-care law, medical debt & credit reports, Medicaid retroactive coverage, and price
          transparency. Each claim will carry a citation and a "verified on" date.
        </p>
        <p>
          <Link to="/privacy">See how we handle sources and citations</Link>.
        </p>
      </div>
    </div>
  );
}
