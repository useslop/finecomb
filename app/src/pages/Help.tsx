import { Link } from '../router';

// Placeholder — lane B4 owns this page's real content (SPEC.md §4 charity-screener logic).
export default function Help() {
  return (
    <div className="page">
      <h1>Charity care & assistance</h1>
      <div className="placeholder-note">
        <p>
          This page will screen for hospital charity care (501(r) and state law), Medicaid
          retroactive coverage, Marketplace special enrollment and copay-assistance programs,
          based on your household size, income, state and hospital — with a deadline tracker and a
          local .ics download. Coming soon.
        </p>
        <p>
          Add your household and hospital details on the <Link to="/check">check</Link> page's
          context step so they're ready once this ships.
        </p>
      </div>
    </div>
  );
}
