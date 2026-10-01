import { Link } from '../router';

// Placeholder — lane B4 owns this page's real content (LETTERS.md templates L1–L7).
export default function Letters() {
  return (
    <div className="page">
      <h1>Dispute letters</h1>
      <div className="placeholder-note">
        <p>
          This page will let you pick a dispute-letter template, auto-fill it from your bill,
          context and selected findings, then edit, copy, print or download it as .txt or .docx —
          all client-side, never emailed by the app. Coming soon.
        </p>
        <p>
          <Link to="/check">Run a check</Link> first — findings you mark "Add to dispute letter" on
          your results page will show up here once this is built.
        </p>
      </div>
    </div>
  );
}
