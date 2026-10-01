const CSP =
  "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; img-src 'self' blob: data:; style-src 'self'; font-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests";

export default function Privacy() {
  return (
    <div className="page">
      <h1>Privacy, proven</h1>

      <div className="card">
        <h2>What runs where</h2>
        <p>
          Finecomb is a fully static app. There are no API routes, and no server ever receives
          your bill.
        </p>
        <ul>
          <li>Parsing pasted text, PDF text extraction and photo OCR all run in your browser.</li>
          <li>
            Every check (duplicate charges, math, billing rules, EOB comparison…) runs against
            reference data already loaded into the page — never a per-line or per-code request.
          </li>
          <li>
            Your bill, context answers and results live in memory for this browser tab only.
            Nothing is written to a query string, hash or storage unless you explicitly opt in to
            a local save.
          </li>
          <li>OCR and PDF-parsing assets are self-hosted from this site — no CDN.</li>
          <li>Letters are copied, printed or downloaded — never emailed or posted by the app.</li>
        </ul>
      </div>

      <div className="card">
        <h2>The Content-Security-Policy, exactly as shipped</h2>
        <p className="field__hint">Sent as a header on every route (see app/vercel.json).</p>
        <pre>{CSP}</pre>
      </div>

      <div className="card">
        <h2>Network test</h2>
        <p>
          The build includes a Playwright test that loads the app, runs a synthetic bill with
          canary values, generates a letter and runs the screener while recording every network
          request — then asserts none of them carry any bill content, and that the request list is
          identical across two different bills. Its published results will appear here once the QA
          lane has run it.
        </p>
      </div>

      <div className="card">
        <h2>Try it yourself</h2>
        <p>
          Load this app once, then turn on airplane mode (or your browser's offline toolbar).
          Everything after that first load should keep working — including running a full check —
          because nothing in the flow needs the network.
        </p>
      </div>

      <div className="card">
        <h2>Source</h2>
        <p>
          Finecomb is open source (MIT). The code is published to the <code>useslop</code> GitHub
          org once this build has passed QA and review.
        </p>
      </div>
    </div>
  );
}
