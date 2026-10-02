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
          canary values (a made-up patient name, account number and amounts), generates a letter
          and runs the screener while recording every network request. Then it runs a second,
          different bill and compares.
        </p>
        <p>
          <strong>Last run: 2 October 2026, against this site.</strong> Every check passed:
        </p>
        <ul>
          <li>
            9 requests in total, all to this site: the page, one script, one stylesheet and six
            reference-data files (poverty guidelines, the hospital list and its search index,
            HCPCS Level II codes, drug prices, state charity-care rules).
          </li>
          <li>The request list was identical for both bills, in the same order.</li>
          <li>No request had a body, and no URL or header contained the canaries, a code or an amount.</li>
          <li>With the network switched off after the first load, the full check still ran.</li>
          <li>
            Uploading a PDF adds only the PDF reader and its worker; a photo adds only the OCR
            engine, its worker and its English model. All are served from this site.
          </li>
          <li>The policy above is sent, exactly, on every route.</li>
        </ul>
        <p className="field__hint">
          Run it yourself from the source: <code>npm run test:privacy -w app</code>.
        </p>
      </div>

      <div className="card">
        <h2>Try it yourself</h2>
        <p>
          Open <em>Check a bill</em> once (that downloads the reference data), then turn on
          airplane mode or your browser's offline switch. Everything after that keeps working,
          including a full check, a letter and the charity-care screener, because nothing in the
          flow needs the network.
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
