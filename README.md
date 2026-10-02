# Finecomb

A private medical bill checker.

## What it is

Finecomb checks a medical bill for possible issues to ask about:

- duplicate charges
- math errors
- unbundling
- No Surprises Act violations
- Good Faith Estimate overruns
- collections timing
- and more

It also screens for charity care and financial assistance, and drafts dispute letters.

This is consumer information. It is not legal, medical or financial advice, and it never promises savings.

**Status:** unannounced preview at https://finecomb.vercel.app. Not launched.

## Privacy model

Finecomb is a fully static single-page app. Every parse, every OCR pass and every check runs in the browser.

- No API routes. No server ever receives bill content.
- No analytics, no error reporting, no third-party scripts.
- All reference data (hospital list, NADAC drug prices, HCPCS Level II codes, and so on) loads up front, in a fixed order. There is never a per-code or per-NDC request — a request like that would tell a server which codes are on a bill.
- OCR (tesseract.js) and PDF parsing (pdf.js) run on self-hosted workers. No CDN.

Headers sent on every route:

```
Content-Security-Policy: default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; img-src 'self' blob: data:; style-src 'self'; font-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests
Referrer-Policy: no-referrer
Permissions-Policy: camera=(self), microphone=(), geolocation=(), interest-cohort=()
X-Content-Type-Options: nosniff
Cross-Origin-Opener-Policy: same-origin
```

This is proved, not just claimed. `npm run test:privacy -w app` runs a Playwright suite that loads a synthetic bill with canary values, then asserts: no request carries a body; no canary string, code or amount from the bill appears in any URL or header; the request list is identical between two different bills; and analysis still works with the network offline.

## How to run it

Requires Node >= 22.

```
npm install
npm test                      # unit tests across workspaces
npm run build                 # builds the app
npm run dev -w app            # local dev server
npm run test:privacy -w app   # Playwright privacy proof
npm run test:a11y -w app      # axe-core accessibility checks
```

The build runs a licensing gate (`app/scripts/license-gate.mjs`) as a postbuild step. It fails the build if the shipped output contains a CPT-shaped code outside an explicit allowlist, or any text from a forbidden-license source.

## Repo layout

- `engine/` — the pure rules engine: 21 rules plus 3 info cards, the charity-care screener, and the letter generator. No I/O.
- `app/` — the app itself: Vite + React 19 + TypeScript.
- `corpus/` — the seeded synthetic bill corpus and its evaluator.
- `data/` — the public-data pipeline: fetch, license-sort, normalize.
- `docs/` — spec, research, data-licensing decisions and letter templates.

## Data sources and licenses

| Dataset | Publisher | License | Fetch date | Rows |
|---|---|---|---|---|
| HHS Poverty Guidelines 2026 | HHS / Federal Register | Public domain (17 U.S.C. 105) | 2026-10-01 | 3 regions x household sizes 1-8, plus an increment rule |
| CMS Hospital General Information | CMS | Public domain (`accessLevel: public`) | 2026-10-01 | 5,419 hospitals |
| NADAC (National Average Drug Acquisition Cost) | CMS / Medicaid.gov | Public domain (usa.gov) | 2026-10-01 | 32,808 unique NDCs |
| HCPCS Level II | CMS | Public domain (CMS-maintained code set) | 2026-10-01 | 9,154 Level II codes |

Full detail, including file hashes and refresh commands, is in `data/SOURCES.md`.

Finecomb ships no AMA CPT descriptors, no AHA/NUBC revenue-code text, and no bulk CPT-keyed tables. CPT-keyed CMS files — the MUE tables, the PFS relative-value file, and NCCI PTP edits — are not redistributed. They are never deployed (NCCI PTP was never even fetched, since CMS gates it behind an AMA license click-through), and the build's licensing gate fails if any of that data reaches `dist/`. Checks that need those files report "couldn't run" rather than skipping silently. CPT is a registered trademark of the American Medical Association.

## The scoreboard

Accuracy is measured against a seeded synthetic corpus, not real bills: 300 generated bills (100 inpatient, 100 ED/outpatient, 100 professional), seed `20261001`.

Method: each bill is generated with planted errors and look-alike traps, labeled by an independent reading of the rule spec, then checked by the same engine the app runs. A finding counts as correct when it points at the labeled lines. The corpus deliberately over-samples look-alike traps (credits, bilateral lines, modifiers, overlapping hourly items), so precision here is a stress-test number, not a forecast.

**Caveat (shown on /accuracy):** synthetic bills; real-world accuracy may be lower.

**Ship policy**, per rule, on this corpus:

- Precision >= 0.9: ships as specified.
- Precision 0.6-0.9: ships, shown as "Low confidence."
- Precision < 0.6: kept off, listed under "Checks we're still tuning."

The numbers change as the engine is tuned, so they aren't repeated here. The app imports `app/public/scoreboard.json` at build time and enforces the policy on every finding; the current breakdown is always at `/accuracy`.

## Credits

Built by AI agents (Claude Opus 5.5 + Sonnet 5), orchestrated by Tanya for Slop.

License: MIT (see LICENSE).
