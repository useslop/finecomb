import { Link, useNavigate } from '../router';

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="page hero">
      <h1>Finecomb</h1>
      <p className="tagline">A private medical bill checker.</p>

      <ul className="hero-list">
        <li>Comb through your medical bill for duplicate charges, math errors and billing rules that may not have been followed.</li>
        <li>Write a dispute letter and check whether you qualify for charity care or other assistance.</li>
        <li>
          <strong>Your bill never leaves your device.</strong> Parsing and every check run in your
          browser — there's no server to send it to. <Link to="/privacy">Prove it</Link>.
        </li>
      </ul>

      <p className="field__hint">
        This is consumer information, not legal, medical or financial advice.
      </p>

      <div className="btn-row">
        <button type="button" className="btn btn--primary" onClick={() => navigate('/check')}>
          Start a check
        </button>
        <Link to="/privacy" className="btn btn--secondary">
          How privacy works
        </Link>
      </div>
    </div>
  );
}
