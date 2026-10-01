# Data sources

All fetches below were run 2026-10-01 (ET) with `curl -L -A "medbill-data-pipeline research fetch"`
or `mcp__openclaw__web_fetch`, directly against the official agency URL — no browser automation,
no `openclaw`/`tanya` browser profiles. Raw downloads live in `data/tmp/` (gitignored; re-run the
fetch commands below to regenerate). Normalized output is reproducible from `data/tmp/` via the
scripts in `data/scripts/`.

## Shipped to `data/out/` (public domain / permissive, safe to ship)

### 1. HHS Poverty Guidelines 2026 — `out/fpl-2026.json`

- **Source:** Federal Register notice "Annual Update of the HHS Poverty Guidelines," 91 FR 1797,
  document number 2026-00755, published 2026-01-15, effective 2026-01-13.
  https://www.federalregister.gov/documents/2026/01/15/2026-00755/annual-update-of-the-hhs-poverty-guidelines
  PDF: https://www.govinfo.gov/content/pkg/FR-2026-01-15/pdf/2026-00755.pdf
- Cross-checked against https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines
  (fetched 2026-10-01), which confirms the 2026 guidelines were issued and describes the same
  CPI-U calculation (the Oct 2025 government shutdown meant BLS didn't publish that month's CPI-U,
  so 2026 guidelines compare 11 months of 2025 vs. 12 months of 2024).
- **Fetch date:** 2026-10-01.
- **License:** U.S. Government work, public domain (17 U.S.C. 105).
- **Rows:** 3 regions (48 states + DC, Alaska, Hawaii) x household sizes 1-8 explicit + increment
  rule above 8. Figures transcribed directly from the notice text, then spot-checked
  programmatically (see `data/scripts/fetch-fpl.mjs`).
- **Size / hash:** 1,672 bytes, sha256 `1f4f6cea7d2cbd0b5e9edd55342fc843da0bffc5c3bd6b59f804ee1c32d32b63`.
- **Refresh:** `node data/scripts/fetch-fpl.mjs` (figures are hardcoded from the primary source;
  re-verify against the next year's Federal Register notice before editing).

### 2. CMS Hospital General Information — `out/hospitals.json` + `out/hospitals-search-index.json`

- **Source:** CMS Care Compare provider data catalog, dataset `xubh-q36u`, "Hospital General
  Information." Metadata: https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/xubh-q36u
  Download: https://data.cms.gov/provider-data/sites/default/files/resources/893c372430d9d71a1c52737d01239d47_1785189955/Hospital_General_Information.csv
  Data dictionary: https://data.cms.gov/provider-data/sites/default/files/data_dictionaries/hospital/HOSPITAL_Data_Dictionary.pdf
  Landing page: https://data.cms.gov/provider-data/dataset/xubh-q36u
- Dataset metadata reports `"modified": "2026-07-22"`, `"released": "2026-08-13"`.
- **Fetch date:** 2026-10-01.
- **License:** `accessLevel: public`; CMS public provider data, public domain (17 U.S.C. 105).
- **Rows:** 5,419 hospitals. Raw CSV: 1,450,767 bytes, sha256 `f874f09fef895a1ccf5bb7392dcbb2be05c9860339261b093fe00f0c1b013480`.
- **Fields kept:** CCN, name, address, city, state, ZIP, county, phone, hospital type, ownership
  (raw CMS string + a derived `ownershipCategory` of `nonprofit` / `government` / `proprietary` /
  `unknown`, for §501(r) relevance — nonprofit hospitals carry community-benefit/charity-care
  obligations under §501(r) that government and for-profit hospitals don't), emergency services
  flag. Quality-rating columns from the source CSV (star ratings, mortality/safety measure
  counts) were dropped as out of scope.
- **Output:** `hospitals.json` 1,665,606 bytes, sha256 `285cc0862666ee4b50db5e1e164dfa18e895bd11486aec905fe0e477e1d772d5`.
  `hospitals-search-index.json` (ccn/name/city/state/zip only, for client typeahead) 552,196 bytes,
  sha256 `991563d9f80447d4c66ac48cae3d16b8b486c92cb3215ece2317004240e1d915`. Not sharded — single
  files, ~2.2 MB combined, judged small enough to load whole rather than shard by state; revisit
  if that proves too heavy on slow connections.
- **Refresh:**
  ```
  curl -L -A "medbill-data-pipeline" "https://data.cms.gov/provider-data/sites/default/files/resources/893c372430d9d71a1c52737d01239d47_1785189955/Hospital_General_Information.csv" -o data/tmp/hospitals_raw.csv
  node data/scripts/build-hospitals.mjs
  ```
  Note: the resource hash in the CSV URL (`893c372430d9d71a1c52737d01239d47_1785189955`) is
  CMS-assigned and may change on their next refresh — re-resolve it from the metastore URL above
  (`distribution[0].downloadURL`) rather than hardcoding.

### 3. NADAC (National Average Drug Acquisition Cost) — `out/nadac/*.json`

- **Source:** data.medicaid.gov, dataset "NADAC (National Average Drug Acquisition Cost) 2026,"
  identifier `fbb83258-11c7-47f5-8b18-5f8e79f7e704`, modified 2026-09-29.
  Download: https://download.medicaid.gov/data/nadac-national-average-drug-acquisition-cost-09-30-2026.csv
  (found via https://data.medicaid.gov/api/1/search?fulltext=NADAC%202026 — the dataset is a
  rolling current-year file that CMS updates weekly; prior years are frozen archives, e.g.
  `nadac-national-average-drug-acquisition-cost-12-25-2024.csv` for 2024.)
- **Fetch date:** 2026-10-01.
- **License:** `https://www.usa.gov/publicdomain/label/1.0/` — public domain.
- **Rows:** 1,178,135 source rows (full 2026 year-to-date weekly price history, one row per
  NDC per price change) -> deduplicated to **32,808 unique NDCs**, keeping only the row with the
  latest Effective Date per NDC ("latest weekly file" per the brief — a bill checker needs the
  current price, not the full history). Raw CSV: 102,139,428 bytes, sha256
  `a9cacfa9bd60c902acd6f4ba234127ab74e125dc06459734b07f0e8943b0b410`.
- **Fields kept:** NDC, description, price per unit, pricing unit, effective date, pharmacy type
  indicator, OTC flag, rate-setting classification.
- **Shard scheme:** by the first 5 digits of the 11-digit NDC (FDA labeler code) — 535 shards,
  6,781,710 bytes total. Manifest with per-shard count/bytes/sha256:
  `out/nadac/manifest.json` (77,500 bytes, sha256 `37cd73c8698a91b60ccd6ebb7b82bf65b148ca2386bc47d714b1710139de43a9`).
- **Refresh:**
  ```
  curl -L -A "medbill-data-pipeline" "https://download.medicaid.gov/data/nadac-national-average-drug-acquisition-cost-09-30-2026.csv" -o data/tmp/nadac_raw.csv
  node data/scripts/build-nadac.mjs
  ```
  Re-resolve the download URL from the search API each time — the filename date changes weekly.

### 4. HCPCS Level II — `out/hcpcs2.json`

- **Source:** CMS HCPCS Quarterly Update page, October 2026 Alpha-Numeric HCPCS file.
  Landing page: https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system/quarterly-update
  Download: https://www.cms.gov/files/zip/october-2026-alpha-numeric-hcpcs-file.zip
  (contains `HCPC2026_OCT_ANWEB_09232026.txt`, a fixed-width "HCPCS Contractor Record" file, plus
  `HCPC2026_recordlayout.txt` defining field positions, released by CMS 2026-09-23.)
- **Fetch date:** 2026-10-01.
- **License:** CMS states Level II codes/descriptors are maintained by CMS and public domain.
  **Important:** the same combined file also contains HCPCS Level I (CPT) rows, which ARE
  AMA-copyrighted — this pipeline filters those out entirely (see below) and never writes them
  anywhere, including `_pending-license/`.
- **Rows:** 16,900 lines in the source file (fixed-width, cols defined in
  `HCPC2026_recordlayout.txt`: code cols 1-5, long description cols 12-91, short description cols
  92-119, termination date cols 285-292, action code col 293) -> filtered to rows whose code
  starts with a letter (Level II codes are 1 letter + 4 digits; Level I/CPT codes are 5 numeric
  digits — this is CMS's own documented distinction, stated in the record layout) -> **9,154
  Level II codes**. Raw file: 3,208,022 bytes, sha256
  `c25240c63108756d4ba6c0ea785c517117d83bfed9526c51da8acf123de1feb6`.
- **Fields kept:** code, short description (28-char CMS short description, not the 80-char long
  description — kept minimal), `active` (no termination date on file), CMS action code.
- **Output:** 862,946 bytes, sha256 `415c3955b75d8bc142e0507562c9ec0be16ac2c855a8f72fde491e91e83c7074`.
  Not sharded — under 1 MB, single file.
- **Refresh:**
  ```
  curl -L -A "medbill-data-pipeline" "https://www.cms.gov/files/zip/<quarter>-<year>-alpha-numeric-hcpcs-file.zip" -o data/tmp/hcpcs.zip
  unzip data/tmp/hcpcs.zip -d data/tmp/hcpcs_<quarter><year>
  # update RAW path in data/scripts/build-hcpcs2.mjs to the new .txt filename, then:
  node data/scripts/build-hcpcs2.mjs
  ```
  The download URL slug changes quarterly (`january-`/`april-`/`july-`/`october-YYYY-...`); current
  links are listed on the quarterly-update landing page above.

## Quarantined to `data/_pending-license/` (CPT-bearing; A1 decides whether they ship)

Everything in this section is keyed by CPT/HCPCS code and the **source files themselves open with
an explicit AMA CPT copyright notice** ("Current Procedural Terminology (CPT) codes, descriptions
and other data only are copyright 20XX American Medical Association. All rights reserved.
Applicable FARS/DFARS Restrictions Apply to Government Use."). No CPT descriptor text was copied
into any of these outputs — only code numbers, numeric values (RVUs/MUE values), and CMS's own
short policy-category labels.

### 5. NCCI MUE tables — `_pending-license/mue-practitioner/`, `_pending-license/mue-outpatient-hospital/`

- **Source:** CMS NCCI edits page, PTP edits sub-navigation.
  Landing page: https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medically-unlikely-edits
  Practitioner: https://www.cms.gov/files/zip/medicare-ncci-2026-q4-practitioner-services-mue-table.zip
  Outpatient hospital: https://www.cms.gov/files/zip/medicare-ncci-2026-q4-facility-outpatient-hospital-services-mue-table.zip
  Effective date 2026-10-01 (Q4 2026), files released/updated 2026-08-07 per the zip contents.
- **Fetch date:** 2026-10-01.
- **License:** see quarantine note above — AMA CPT copyright notice on the source CSV. CMS's own
  MUE values and adjudication indicators are CMS policy data, but they're keyed to AMA CPT code
  numbers, so this needs a human license call, not a pipeline judgment call.
- **Rows:** practitioner 15,212 rows (raw CSV 940,657 bytes, sha256
  `ef038efaf902b7bd41b8d43318ead2944e712806f903358eb2f8ab5df98711b3`); outpatient hospital 15,162
  rows (raw CSV 948,882 bytes, sha256 `3af9f4e99cc587e23f0a2fc4884bdb85ab6467db229b0d7d2a07f22c75ceddaa`).
- **Fields kept:** code, MUE value, adjudication indicator (+ CMS's own short label, e.g. "Date of
  Service Edit: Policy" — not an AMA descriptor), effective date. No CPT descriptor text.
- **Shard scheme:** by first character of code (digit or letter) — 26 shards each. Manifests with
  per-shard sha256: `_pending-license/mue-practitioner/manifest.json` (4,262 bytes, sha256
  `7491b0883a52c6d747b65addcc6984efcb650f46420e82300d90770f2c1dff8c`), `_pending-license/mue-outpatient-hospital/manifest.json`
  (4,269 bytes, sha256 `a282caa8ae85733c80bca4471f40ee699c9cb18b40aa6f4d149ffba5f371f831`).
- **Refresh:** `node data/scripts/build-mue-pending.mjs` after re-downloading the quarterly zips
  (URL slug changes quarterly: `medicare-ncci-<YYYY>-q<N>-<practitioner|facility-outpatient-hospital>-services-mue-table.zip`).

### 6. CMS PFS relative value file (RVUs; NOT yet dollarized) — `_pending-license/pfs/`

- **Source:** CMS PFS Relative Value Files page -> RVU26D sub-page -> zip.
  Landing: https://www.cms.gov/medicare/payment/fee-schedules/physician/pfs-relative-value-files
  Sub-page: https://www.cms.gov/medicare/payment/fee-schedules/physician/pfs-relative-value-files/rvu26d
  Download: https://www.cms.gov/files/zip/rvu26d-updated-08-26-2026.zip (CY2026 October release,
  released 2026-08-26; file used: `PPRRVU2026_Oct_QPP.csv`).
- **Fetch date:** 2026-10-01.
- **License:** source file explicitly: "CPT codes and descriptions only are copyright 2026
  American Medical Association. All Rights Reserved." — quarantined for the same reason as MUE.
- **Rows:** 11,978 rows kept (raw CSV 1,639,015 bytes, sha256
  `59d3734704853936070f972d741f7b6739bf22510f08998a599d2fcd5c865cfe`; header is at row 10, 1-indexed,
  of the CSV, preceded by title/copyright/release-date rows).
- **Fields kept:** HCPCS/CPT code, modifier, status code, work RVU, non-facility PE RVU, facility
  PE RVU, MP RVU, non-facility/facility total RVU, PCTC indicator. The AMA-copyrighted
  `DESCRIPTION` column (short CPT descriptor text) was read but **never written to any output
  file** — dropped during parsing in `build-pfs-pending.mjs`.
- **Open issue — not actually "national payment amounts" yet:** Medicare's national payment is
  `(work RVU * work GPCI + PE RVU * PE GPCI + MP RVU * MP GPCI) * conversion factor`. This pipeline
  did not locate and confirm a primary-sourced CY2026 conversion factor within the lane's time
  budget (the CY 2026 PFS final rule is 90 FR, published 2025-11-05, with a correction at
  document 2026-04797, https://www.federalregister.gov/documents/2026/03/12/2026-04797/ —
  neither was fetched/read in full). **A1/next lane must source the CF before shipping anything
  described as a "payment amount"**; until then this is RVUs only. `GPCI2026.csv` (also in the
  RVU26D zip, `data/tmp/pfs_rvu26d/`) has the geographic practice cost indices if/when per-locality
  amounts are wanted instead of a national-average figure.
- **Shard scheme:** by first character of code — 17 shards. Manifest:
  `_pending-license/pfs/manifest.json` (3,346 bytes, sha256
  `300f7367367aaee98b60607e3e08c5c7a288353d4160219d5cc2f089e73ca135`), `openIssue` field repeats the
  conversion-factor note above.
- **Refresh:** `node data/scripts/build-pfs-pending.mjs` after re-downloading the current quarter's
  RVU zip (sub-page slug `rvu26<a|b|c|d>` for Jan/Apr/Jul/Oct; re-resolve the actual zip filename
  from the sub-page, it includes a release-date suffix that changes).

## Not fetched (documented per lane rules, not attempted further within the 45-minute budget)

### NCCI PTP edits (practitioner + outpatient hospital) — CMS gates these behind an AMA license click-through

- Landing/sub-page: https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-procedure-procedure-ptp-edits
- Unlike the MUE tables (direct `/files/zip/...` links, no gate), **every current-quarter PTP edit
  file link on this page routes through `https://www.cms.gov/license/ama?file=/files/zip/...`** —
  e.g. `/license/ama?file=/files/zip/medicare-ncci-2026-q4-practitioner-ptp-edits-ccipra-v323r0-f1.zip`.
  That is CMS's own AMA-license click-through gate. Fetching through it programmatically (without
  a human agreeing to AMA's license terms) is exactly the kind of licensing ambiguity the lane
  rules say to quarantine rather than route around, so this pipeline did not fetch these files at
  all — not even into `_pending-license/`. Two non-gated zips were found on the same page
  (`medicare-ncci-2026q4-hospital-quarterly-additions-deletions-revisions-ptp.zip` and the
  practitioner equivalent) but those are quarter-over-quarter *change logs*, not the full active
  edit table the brief asked for, so they weren't fetched either.
- **For A1/next lane:** if PTP edits are wanted, a human needs to click through the AMA license
  gate in a real browser session (not this pipeline) and hand off the resulting files, or CMS's
  licensing terms need review to see if programmatic access is permitted under some agreement.

### CMS OPPS Addendum B (current year)

- Not located within the time budget. Checked: the Hospital Outpatient PPS landing page
  (https://www.cms.gov/medicare/payment/prospective-payment-systems/hospital-outpatient, fetched
  2026-10-01, 204,288 bytes) has no direct Addendum link in its static HTML; a few guessed URL
  slugs for an "addendum-b" page both 404'd. This is very likely the same pattern as HCPCS/PFS —
  a dynamic-list-table page whose real download page is one click deeper — but that next click
  wasn't found before the lane's time ran out.
- **For A1/next lane:** start from the Hospital Outpatient PPS landing page above and look for an
  "Annual/Quarterly Addendum A and Addendum B Updates" link (CMS reorganizes these URLs
  periodically); the HCPCS/PFS fetch pattern in this file (landing page -> per-item sub-page ->
  `/files/zip/...`) is very likely to apply here too.

## Pipeline notes

- `data/scripts/lib/csv.mjs` — small RFC4180 CSV parser shared by the hospital/NADAC/MUE/PFS
  scripts (no dependency; files are tens of MB at most, so a non-streaming parser was fine).
- `data/tmp/` holds raw downloads and is gitignored — it's fully regenerable from the commands
  above and the sha256 hashes recorded here, and the largest file (`nadac_raw.csv`, ~102 MB) has
  no business in git history.
- Every build script is idempotent: re-running it overwrites `out/`/`_pending-license/` shards
  from whatever is currently in `data/tmp/`.
