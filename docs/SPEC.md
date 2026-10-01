# SPEC: Finecomb, a private medical bill checker (lane A1, 2026-10-01)

Inputs to this spec: RESEARCH.md (taxonomy E01–E30, laws, sources [S#]), DATA-LICENSING.md, LETTERS.md, and LANE-RULES.md.

## 1. Name

| Option | URL check (2026-10-01) | Collision check (one web search each, 2026-10-01) | Verdict |
|---|---|---|---|
| **Finecomb** ("go over your bill with a fine-tooth comb") | `finecomb.vercel.app`: HTTP 404 DEPLOYMENT_NOT_FOUND (free) | No app or health product named Finecomb / Fine Comb found | **PICK** |
| Billtective | `billtective.vercel.app`: 404 (free) | None found, but it's close to the existing "Bill Sherlock" checker and the detective trope is crowded | backup |
| Medlint | `medlint.vercel.app`: 404 (free) | None found; developer-flavored ("lint your bill") | backup |

Rejected:
- **BillProof**: an existing iOS app, "BillProof: Bill Decoder", from June 2026.
- **BillSleuth**: too close to Bill Sherlock.
- **Itemized, LineByLine, ClearBill, FairBill, ChargeCheck, BillLens, Itemwise, SecondLook, CounterCheck**: the `*.vercel.app` names were already taken (HTTP 200/308).

These checks aren't a trademark search; Nick or Tanya should do a USPTO TESS check before launch.

**Tagline:** "Comb through your medical bill, privately. Find what to ask about, write the letter, check for charity care. Your bill never leaves your device."

## 2. User flows and screens

```
Landing ─► Add bill ─► Check lines ─► Context ─► Findings ─► Letters
   │                                     │           │
   └► Privacy proof        Charity screener ◄────────┘
   └► Know your rights     Accuracy scoreboard
```

1. **Landing (/):**
   - what it does, in 3 bullets;
   - the privacy promise, with a "prove it" link to /privacy;
   - a "Not legal, medical or financial advice" line;
   - "Start" opens /check.

   Landing is the only page that may load Vercel Web Analytics; it carries no query parameters.
2. **Add bill (/check, step 1).** Four input modes:
   - (a) **Paste text** from an online bill or portal.
   - (b) **PDF upload**: pdf.js extracts the text layer with x/y positions. If a page has no text layer, it falls back to OCR on the rendered page canvas.
   - (c) **Photo / camera** (`<input type=file accept=image/* capture>`): tesseract.js is lazy-loaded with self-hosted worker, core and `eng` data. Pre-processing: grayscale, adaptive threshold, deskew.
   - (d) **Manual grid entry**.

   Multi-page and multi-file inputs are supported (bill + EOB + GFE).
3. **Check lines (step 2).** An editable grid: date, code, modifier, revenue code, NDC, description, qty, unit price, amount, plus a "✕ I didn't get this" toggle per line.
   - A parse-confidence chip and a crop of the source image per row (photo/PDF).
   - The header fields are detected and editable: patient, provider, account number, admit/discharge dates, statement date, totals, payments, adjustments, balance.
   - **Rules never run on unconfirmed OCR numbers.** The user ticks "These lines look right."
4. **Context (step 3).** Short questions; each is skippable, and skipped questions disable the rules that need them:
   - Insurance: none or self-pay / commercial / Marketplace / Medicare / Medicaid / other; secondary coverage?
   - Were you admitted? Admit and discharge dates. Observation?
   - Emergency? Air ambulance?
   - Was the facility in-network? Were any doctors out-of-network?
   - (Uninsured) Did you schedule ahead? Did you get a Good Faith Estimate? Enter its per-provider totals.
   - EOB entry: billed, allowed, plan paid, deductible, copay, coinsurance, non-covered, patient responsibility, group/reason codes as typed.
   - Dates: first bill, first post-discharge statement, collections letters; is it on your credit report?
   - State; hospital (search the CMS list); household size and income (optional, used by the screener).
5. **Findings (/check/results).**
   - **Header:** "N possible issues to ask about", "$X at stake where computable", confidence breakdown, and a "Not advice" banner.
   - **Each finding card:** title, why it was flagged, evidence lines (highlighted rows), how to verify (what to ask for or check), confidence (High / Medium / Low / Info), $ at stake, a citation link with its "verified 2026-10-01" date, and the rule ID.
   - **Actions:** "Add to dispute letter" and "Not an issue" (feeds only the local session).
   - **Export:** print/PDF via window.print, or download JSON locally. Neither involves a server.
6. **Letters (/letters):** pick a template (LETTERS.md L1–L7); merge fields auto-fill from the bill, context and selected findings; editable text; copy, print or download .txt or .docx (client-side). Never sent by the app. "Mail certified, keep copies" guidance.
7. **Charity and assistance screener (/help):** the §4 logic. Results: likely, possible, or still worth asking. A program list with links; a deadline tracker (120-day PPDR, 240-day FAP); an .ics download generated locally.
8. **Know your rights (/rights):** static pages, one per topic (itemized bill + HIPAA, NSA insured, GFE/PPDR, 501(r), state charity care, credit reports, Medicaid retroactive coverage, price transparency). Each claim carries a citation and a "verified on" date. Unverified items show a grey "not verified" badge.
9. **Accuracy (/accuracy):** the scoreboard (§9).
10. **Privacy (/privacy):** what runs where, the CSP text, the published network test results, "try it in airplane mode", and the source link.

## 3. Rules catalog

**Confidence levels:**
- **High:** deterministic from numbers the user confirmed.
- **Medium:** a rule match where legitimate exceptions are common.
- **Low:** a pattern signal.
- **Info:** context, no error implied.

Every rule emits a finding with these fields: `{id, title, why, evidenceLineIds, verify, confidence, dollarsAtStake|null, citations[], userText}`.

### v1: 21 rules, reliable client-side

| ID | Taxonomy | Inputs | Logic | Conf. | User-facing text (template) | Citation |
|---|---|---|---|---|---|---|
| DUP-01 | E01 | lines | Group by (date, code∨norm(desc), qty, amount); count > 1 after netting credits | High | "These {n} lines look identical (same date, item, quantity and price). Ask whether you received this {n} times." | internal |
| DUP-02 | E02 | lines | Same date + same code, different amount or description | Medium | "The same item appears twice on {date} with different prices. Ask whether both are correct." | internal |
| MATH-01 | E03 | lines | \|qty×unit − amount\| > max($0.05, 0.5%) | High | "Quantity × price doesn't equal the line total ({calc} vs {amount})." | [S41] (FL unit-price rule, example) |
| MATH-02 | E04 | totals, lines, payments | Σlines ≠ total charges, or charges − payments − adjustments ≠ balance | High | "The bill's totals don't add up by {diff}." | internal |
| MUE-01 | E05 | code, units, date, setting | Units per code per date > MUE (L2 shipped; CPT via BYO). MAI 2 → High, 3 → Medium, 1 → Medium per line | High/Med | "{units} units of {code} on one day is more than Medicare's usual maximum ({mue}). Ask for the records supporting this quantity." | [S20] |
| QTY-01 | E06 | lines, stay dates | Per-day items > stay days; hourly > 24 per date; per-stay kit > 1 | Medium | "This is charged {units} times, but your stay was {days} days." | internal |
| RB-01 | E07 | room lines, admit/discharge | Room units > max(1, discharge − admit) | High (Medicare) / Medium | "You were billed {units} room days for {nights} nights. Hospitals generally don't count the day you go home. Ask them to remove the extra day ({$})." | [S28] |
| DATE-01 | E08 | line dates, discharge | Facility line date > discharge date | Medium | "This charge is dated after your discharge." | internal |
| NCCI-01 | E12 | codes, mods, date | Active PTP pair on the same date; MI 0 → flag; MI 1 + no NCCI modifier → flag; MI 9 → skip | Medium | "{col2} is normally included in {col1} when billed on the same day. Ask why it was billed separately." | [S19] |
| CANC-01 | E16 | user marks; desc keywords | User-marked → Medium; CANCEL/D/C/NOT GIVEN/RETURNED with no credit → Low | Med/Low | "You marked this as not received." / "This line mentions a cancellation. Ask whether it should be removed." | [S15][S16] (ask for records) |
| RX-01 | E19 | NDC, qty, unit | billed unit price ÷ NADAC unit ≥ 10 | Info | "This drug was billed at {x}× the national average pharmacy acquisition cost. That isn't an error by itself, but it's useful when negotiating." | [S26] |
| EOB-01 | E23 | bill balance, EOB PR | balance − EOB patient responsibility > $1 | High | "Your EOB says you owe {pr}; the bill asks for {bal}." | EOB; [S8] if NSA |
| EOB-02 | E24 | EOB group code, line | CO / provider-liability amount appears in the patient balance | Medium | "Your insurer marked {$} as the provider's responsibility, not yours." | EOB |
| INS-01 | E25 | insured=yes; no payer activity | Insured, but no insurance payment or adjustment, or wrong payer, or secondary not billed | Medium | "It looks like this bill may not have been sent to your insurance. Ask them to bill {insurer}." | user |
| MCD-01 | E27 | Medicaid on DOS; balance | balance > copay | Medium | "Medicaid providers must accept Medicaid's payment (plus any required copay) as payment in full." | [S29] |
| NSA-01 | E28a,c | insured, emergency or air ambulance, OON, EOB | balance > in-network cost-sharing from the EOB | Med/High | "Emergency (or air-ambulance) care from out-of-network providers can't cost more than in-network cost-sharing." | [S6][S8] |
| NSA-02 | E28b | insured, in-network facility, OON clinician type | Ancillary type (emergency medicine, anesthesia, pathology, radiology, neonatology, assistant surgeon, hospitalist, intensivist, diagnostic lab/imaging) + balance bill | Medium | "This type of out-of-network clinician at an in-network facility can't balance-bill you, even if you signed a form." | [S7][S8] |
| GFE-01 | E29 | uninsured, GFE per provider, bill per provider, first-bill date | billed − GFE ≥ $400 for any provider; days since first bill ≤ 120 | High | "{Provider} billed {$} more than its Good Faith Estimate. You may be able to file a federal dispute ($25 fee) by {deadline}." | [S4][S3] |
| ECA-01 | E30a,b | nonprofit hospital, first post-discharge statement date, ECA dates, FAP pending | ECA < 120 days after first statement; or no 30-day notice; or ECA while FAP is pending | Medium | "Nonprofit hospitals must wait at least 120 days and give 30 days' written notice before actions like credit reporting, and must pause them while your assistance application is pending." | [S12][S14] |
| PPDR-01 | E30c | PPDR filed (user), collections or late-fee events | Any collection or late fee after PPDR filing | High | "During a federal bill dispute, providers can't send the bill to collections and must suspend late fees." | [S4][S3] |
| CR-01 | E30d | reported to credit? balance, paid?, age | Paid, initial balance < $500, or < 1 year since… → bureau policy; state ban → state law (with preemption caveat) | Medium | "The three credit bureaus say they don't report paid medical collections, those under $500, or those under a year old." + the state line | RESEARCH §b5 (2023-04-11 joint release) |

**Info cards (always on; not counted as rules):**
- **FAP-01:** nonprofit hospital, or FPL ≤ 400% → "check charity care" (opens /help).
- **ID-01:** checklist for name, DOB, member ID and group number (E26).
- **FAC-01:** facility-fee explainer when "FACILITY FEE" or 051X appears (E21).

### v1.1 (after a scoreboard review)
- TIME-01 (E18)
- UP-01 (E13, Low)
- MOD-01 (E14)
- GFE-02 (no GFE when scheduled 3+ business days ahead) [S5]
- DATE-02 (E09)
- ROOM-01 (E10)
- OBS-01 (E11)
- SUP-01 (E17)
- FAP-02 (E22, AGB)
- PRICE-01 (E20, MRF)
- GLOB-01 (E15)

Every v1.1 rule that cites an UNVERIFIED source must get its source verified first.

**Rule engine:**
- Pure TypeScript functions `(bill, context, data) → Finding[]`, with no I/O.
- Each rule ships with a JSON metadata file (id, version, citations with fetch dates, required inputs). That file generates the rights pages, the scoreboard rows and the letters' citation blocks, so they can't drift apart.
- A rule whose required inputs are missing reports "skipped: needs X" in a collapsible "checks we couldn't run" list. That list is honest coverage reporting.

## 4. Charity-care screener logic

1. **FPL %** = annual household income ÷ guideline(n, region) × 100.
   - guideline(n) = base + (n−1) × increment, using the 2026 values (DATA-LICENSING): 48 states + DC 15,960/5,680; AK 19,950/7,100; HI 18,360/6,530.
   - The app shows "2026 guidelines; your hospital may use the year of service."
2. **Hospital check:** search `hospitals.json` (CMS Hospital General Information) [S27] by name, city or ZIP. Ownership decides the message:
   - `Voluntary non-profit – Private / Church / Other` → "Likely a 501(c)(3) hospital: federal 501(r) rules apply." Link to the IRS exempt-organization search to confirm.
   - `Government – *` → "Public hospital. 501(r) applies only if it has 501(c)(3) status. Most still have assistance policies, and state law may apply."
   - `Proprietary` → "For-profit. 501(r) doesn't apply; your state's law may."
   - `Tribal`, `VA`, `Physician` → specific notes.
3. **State law tier:** look up the state row (RESEARCH §b4, from `state-charity.json`, generated from that table). Output, e.g. for WA, using the hospital's tier:
   - Tier A (large systems): free ≤300% FPL; 75% off 301–350%; 50% off 351–400%.
   - Tier B (other hospitals): free ≤200% FPL; 75% off 201–250%; 50% off 251–300%.
   - Each state shows: who is covered (uninsured vs insured), residency, verified badge, citation, and caveats (e.g. "DE law starts 2027-01-01"; "NM: collection actions barred ≤200% FPL"; "WAC thresholds outdated; statute governs").
4. **501(r) timing** (from the first post-discharge statement date):
   - ≤ 240 days → "The hospital must accept and process your application now."
   - Later → "You can still apply. Hospitals may accept late applications" [S13].
   - Any ECA before day 120, or with no 30-day notice → ECA-01.
   - An application (even incomplete) → ECAs must be suspended [S12].
5. **Other programs:**
   - **Medicaid:** "If you're uninsured, apply now. Medicaid can cover care from before you applied." Today: up to 3 months before the application month. For applications on or after 2027-01-01: 1 month for expansion adults, 2 for others (P.L. 119-21 §71112; CMS CIB 2025-11-18). Banner: "Applying before 2027 may matter."
   - **Marketplace:** an SEP if there's a qualifying life event. The income-based SEP no longer gets premium tax credits from plan year 2026 (§71304).
   - **Disease-specific copay foundations** (insured): PAN, HealthWell (≤500% FPL), PAF.
   - **Others:** Dollar For (help applying); state CAP (insured disputes); 211; Undue Medical Debt (no application).
6. **Output wording:**
   - "You may qualify" (FPL under a mandated threshold, with the citation);
   - "Worth asking" (nonprofit hospital, or FPL ≤ 400%);
   - "Less likely, but ask anyway."

   Never "you qualify" or "you will save."

## 5. Privacy model (rule 1) and how QA proves it

- **Architecture:** a fully static SPA. **No API routes. No server receives bill content.** Data shards are static files.
- **Headers on every route** (`vercel.json`):
  ```
  Content-Security-Policy: default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; img-src 'self' blob: data:; style-src 'self'; font-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(self), microphone=(), geolocation=(), interest-cohort=()
  X-Content-Type-Options: nosniff
  Cross-Origin-Opener-Policy: same-origin
  ```
  On landing only, `connect-src` may add the Vercel analytics endpoint if Nick wants visit counts. Tool routes never get it.
- **No third-party scripts. No Sentry or analytics on tool routes.** Errors are caught and shown locally, with a "copy diagnostic" button that strips bill content (counts and rule IDs only).
- **No bill data in URLs** (no query or hash state). State lives in memory. "Save on this device" is an opt-in (IndexedDB) with "Delete everything".
- **Content-independent fetches:** all datasets load up front, or in a fixed full sequence (DATA-LICENSING privacy note). There is never a per-code or per-NDC request.
- **OCR and PDF assets are self-hosted** (tesseract worker, core wasm, `eng.traineddata`; the pdf.js worker). No CDN.
- **Outbound links that include a code** (cms.gov look-up, MRF pages) are explicit clicks, labeled "opens cms.gov and sends this one code."
- **Letters:** no `mailto:` with a body; copy, print and download only.
- **QA proof** (Playwright, published on /privacy):
  - (1) Load the app, run a synthetic bill with canary strings (patient "QUOKKA-ZEBRA-7781", account "ACCT-CANARY-55", unique amounts like $1,234.57), generate a letter and run the screener. Record every request (`page.on('request')`, plus service worker and `requestfinished`).
  - (2) Assert: no request carries a body; no URL or header contains any canary, code or amount from the bill; and the request list is **identical** to a run with a different bill.
  - (3) `curl -I` every route and assert the CSP is present and exact.
  - (4) `context.setOffline(true)` after the first load, and assert analysis still works.
  - (5) Grep the build output for `fetch(`/`sendBeacon`/`XMLHttpRequest` outside the data loader, so new network paths fail CI.

## 6. Optional BYOK Claude "explain my bill": **not in v1; v1.1 behind an opt-in**

Why not in v1:
1. "Your bill never leaves your device" is the product's sharpest difference from the roughly 12 upload-based AI checkers (RESEARCH §d). Any LLM call breaks it for that session.
2. A global CSP `connect-src https://api.anthropic.com` would weaken the guarantee for everyone.
3. LLM explanations can invent legal claims, which undercuts the "every claim cited" promise.
4. Keys in the browser need the `anthropic-dangerous-direct-browser-access` header, and any XSS could expose them.
5. The deterministic engine is what the scoreboard can measure.

**v1.1 design:**
- A separate route, `/explain`, with its **own** CSP allowing only `https://api.anthropic.com`.
- The key is held in memory, never stored, unless the user opts in.
- A **local redaction step** sends only the line table (codes, generic descriptions, qty, amounts). Dates become day offsets; names, IDs, addresses and account numbers are removed.
- The **exact JSON payload is shown** with a "Send to Anthropic using my key" button.
- Default model `claude-sonnet-5` (cheaper), with `claude-opus-5-5` as an option.
- The system prompt is limited to plain-language explanations and "questions to ask." It may cite only from our citation pack and may never add findings.
- Output is labeled "AI-generated; may be wrong; not part of the findings."

**The "into AI" story lives in the build:** Opus 5.5 + Sonnet 5 agents built it, with a public Build Receipt, an open rules engine, and a scoreboard.

## 7. Tech stack

- **Vite + React 19 + TypeScript (strict)**, static build. Vite is preferred over a Next static export because the export injects inline bootstrap scripts that need CSP hashes. Vite's module output fits `script-src 'self'` cleanly.
- **pdfjs-dist** (self-hosted worker) for PDF text with positions. **tesseract.js v5** for OCR, with self-hosted assets and lazy loading (about 2–4 MB; loaded only for photos or scans). **fflate** + a streaming CSV parser for BYO CMS ZIPs. **idb** for optional local saves. **zod** for the bill schema. **docx** (client-side) for .docx letters (stretch).
- **Parser:** a column-inference layer working on positioned text. It clusters x-positions into columns and matches regexes:
  - dates `\d{1,2}/\d{1,2}/\d{2,4}`;
  - Level II codes `[A-V]\d{4}`;
  - 5-character codes `\d{4}[0-9FTU]`;
  - revenue codes `0\d{3}`;
  - NDC 5-4-2, 4-4-2, 5-3-2, 5-4-1 → normalized to 11 digits;
  - money `\(?-?\$?[\d,]+\.\d{2}\)?` and CR.

  Then a confirmation grid.
- **Data:** A2's `data/out/*` plus `state-charity.json` (from RESEARCH §b4) and `rules-meta.json`.
- **Tests:** `node:test`/vitest (units), Playwright (e2e + privacy), axe-core (a11y).
- **Hosting:** Vercel Hobby, new project `finecomb`, static, `vercel.json` headers. Repo: MIT, `useslop/finecomb` (when the integrate lane says so).
- **Budgets:** JS < 250 KB gzipped before OCR; analysis < 500 ms for 300 lines; total data payload < 8 MB, cached by the service worker.

## 8. Test strategy

- **Synthetic corpus** (`test/corpus/`, seeded generator, no real PHI):
  - 300 bills: 100 inpatient, 100 ED/outpatient, 100 professional/office;
  - each is JSON ground truth + a rendered PDF (pdf-lib) + 2 "phone photo" PNG variants (rotation ±4°, blur, JPEG noise, shadows);
  - errors are planted per rule with labels: about 1–3 per bill, 30% of bills clean;
  - **hard negatives** that must not fire: legit repeats with modifiers, same-day admit and discharge, bilateral lines, credits that reverse duplicates, MI-1 pairs with a 59 modifier, uninsured bills $399 over the GFE, a first bill 121 days old.
- **Metrics per rule:** precision, recall, F1, and false positives per clean bill. Parser metrics: field-level line extraction accuracy (PDF text vs photo OCR), amount exact-match rate.
- **Scoreboard:**
  - CI runs the evaluator and writes `public/scoreboard.json` (commit SHA, corpus version, date, per-rule metrics, parser metrics).
  - `/accuracy` renders it, with the caveat "synthetic bills; real-world accuracy may be lower."
  - Rules below 0.9 precision on the corpus ship as Low confidence or stay off.
- **Other gates:**
  - unit tests per rule;
  - property tests for arithmetic;
  - the privacy e2e (§5) as a **merge gate**;
  - axe a11y;
  - Lighthouse performance;
  - a licensing gate: the build fails if `dist/` contains a CPT-shaped code outside the explicit allowlist of about 15 families, or any of the forbidden-text fixtures.

## 9. Over-built extras, prioritized

**v1 must-have:**
- the privacy proof page + CI gate;
- the accuracy scoreboard;
- citations with "verified on" dates on every finding and rights claim;
- the "checks we couldn't run" coverage list;
- 7 letters with print/PDF/.txt;
- the charity screener with the state table and hospital lookup;
- deadline math (120-day PPDR, 240-day FAP, 30-day HIPAA) with a local .ics;
- BYO MUE import;
- mobile-first photo flow.

**Stretch (ordered):**
1. BYO NCCI import (large file; streaming to IndexedDB).
2. Offline PWA ("works in airplane mode").
3. Spanish UI + letters.
4. Hospital MRF local compare (E20).
5. BYOK `/explain` (§6).
6. A redacted "share my finding" card, rendered locally as a PNG with no PHI (for social).
7. A CLI (`npx finecomb bill.pdf`) using the same engine.
8. A local MCP server exposing the rules engine to agents (useslop/AI tie-in).
9. A DRG context multiple (MS-DRG v44).
10. An advocate mode (multiple bills, a case file export).

## 10. Launch content angles (no posting until QA passes and Tanya reviews; LANE-RULES §6)

1. **"Your bill never leaves your phone. Here's the proof."** A screen recording of the network tab staying empty, the CSP header, and the open test.
2. **"The discharge-day charge":** Medicare doesn't count the day you go home [S28]; a 10-second check.
3. **"Uninsured? The $400 rule":** GFE + federal dispute, 120 days, $25 fee [S4][S3].
4. **"Nonprofit hospitals must have charity care":** the 240-day window, and a 30-second hospital lookup [S12][S13].
5. **"Your state's charity-care law":** a series (WA ≤300% free at big systems, CA ≤400%, NY free <200% and no lawsuits <400%, IL, MD, NJ, CO, OR).
6. **"Medical debt and credit reports in 2026":** the CFPB rule was vacated 2025-07-11; the bureau policies still hold; state bans (with the preemption caveat).
7. **"Medicaid can still pay old bills, but the window shrinks 2027-01-01."**
8. **The build story for useslop:** Opus 5.5 researched and specified it, Sonnet 5 built it, all with receipts. Open source, with an accuracy scoreboard that shows where it fails.
9. **"People already paste bills into chatbots"** (the $195k → $33k story [S40]): "here's a version that uploads nothing and cites everything."
