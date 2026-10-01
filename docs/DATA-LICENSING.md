# DATA-LICENSING: ship / don't ship / link-only (lane A1, 2026-10-01)

**The rule (LANE-RULES §4):** ship only public-domain or permissively licensed data, never AMA CPT descriptors or NUBC/AHA revenue-code text, and quarantine anything unclear in `data/_pending-license/`. Source IDs [S#] refer to RESEARCH.md §S. Fetch date for everything: 2026-10-01.

## The key fact behind most decisions

CMS gates its downloads of NCCI PTP, MUE, PFS and OPPS files behind the **AMA CPT license** (download links route through `/license/ama`) [S19][S21]. Its terms, quoted from the page [S21]:
- **Who may use it:** "You, your employees and agents are authorized to use CPT only as contained in the following authorized materials of [CMS] internally within your organization within the United States".
- **What for:** "Use is limited to use in Medicare, Medicaid or other programs administered by CMS".
- **What's forbidden:** "making copies of CPT for resale and/or license, **transferring copies of CPT to any party not bound by this agreement**, creating any modified or derivative work of CPT, or making any commercial use of CPT".
- **Copyright notice:** "CPT codes, descriptions and other data only are copyright ... American Medical Association".

A public static site that ships CPT-keyed tables to every visitor transfers copies of CPT to parties not bound by the agreement. **Therefore no CPT (HCPCS Level I) rows go into the public bundle**, whether as code numbers in bulk tables or as descriptors.

HCPCS **Level II** codes (one letter + four digits) are maintained by CMS [S22]. As U.S. government works they carry no AMA claim, so Level II rows from the same CMS files can ship.

## Decisions

| Dataset | Decision | Reasoning | What ships / how it's used |
|---|---|---|---|
| **HHS poverty guidelines 2026** | **SHIP** | Federal government data published in the Federal Register [S1][S2] | `fpl-2026.json`; values below |
| **NCCI PTP edits** (practitioner + outpatient hospital) | **SHIP the Level II-only subset; BYO-import for the full file** | CPT rows fall under the AMA license [S21]. Pairs where **both** codes match `^[A-V][0-9]{4}$` contain no CPT. | `out/ncci-l2/*.json` (active pairs, modifier indicator, effective dates). Full file: the user downloads it from CMS (accepting the license themselves), and the app parses it **locally** into IndexedDB. CPT-bearing rows stay in `_pending-license/` and are never deployed. |
| **MUE** (practitioner, outpatient hospital, DME) | **SHIP the Level II subset; BYO-import for the rest** | Same AMA gate. Some MUEs are "confidential" and never published [S20]. | `out/mue-l2.json` (code, MUE value, MAI, rationale). The full MUE file is small (tens of thousands of rows), so **BYO import is a v1 feature**. |
| **NADAC** | **SHIP** | data.medicaid.gov metastore: license `https://www.usa.gov/publicdomain/label/1.0/`, accessLevel public, modified 2026-09-29 [S26] | `out/nadac/*` (NDC → per-unit price, unit, effective date). Load the **whole** set, never per-NDC shards; see the privacy note below. |
| **CMS Hospital General Information** | **SHIP** | CMS Provider Data Catalog; accessLevel public; no license restriction; a U.S. government work; modified 2026-07-22 [S27] | `out/hospitals.json` (CCN, name, address, city, state, ZIP, phone, type, ownership) + a local search index |
| **CMS PFS national payment amounts** | **SHIP Level II rows (numbers only); link-only or BYO for CPT** | The RVU/PFS files carry the AMA license. Level II rows are CMS's. | `out/pfs-l2.json` (code, modifier, non-facility and facility national amounts). CPT: either "Open CMS PFS look-up for this code" (a labeled outbound click that sends that one code to cms.gov) or a local BYO file. |
| **OPPS Addendum B** | **SHIP Level II rows (code, status indicator, APC, payment rate); link-only or BYO for CPT** | Same | `out/opps-b-l2.json`. No descriptors, not even for Level II, unless they come from the HCPCS Level II file. |
| **HCPCS Level II** | **SHIP** codes + CMS short descriptions | CMS-maintained code set [S22]; a U.S. government work | `out/hcpcs2.json`. A2 must exclude all Level I. |
| **ICD-10-CM** | **LINK-ONLY (not needed in v1)** | CDC: "WHO ... owns and publishes ICD-10, authorized NCHS to develop ICD-10-CM" [S24]. No explicit public-domain statement was found today. v1 rules don't use diagnoses. | Link to the CDC ICD-10-CM browser. If a later rule needs it, quarantine until the WHO/CDC terms are confirmed. |
| **MS-DRG** (v44 = FY2027, effective 2026-10-01) | **SHIP-OK, deferred** (not needed in v1) | Published by CMS under SSA §1886(d) [S25]; no license terms on the page. The grouper embeds ICD-10 logic, but we'd need only DRG number, CMS title, relative weight and mean length of stay (GMLOS). | v1.1: `out/msdrg-v44.json` for an inpatient "Medicare-equivalent" context multiple. Tanya should confirm there's no license on the IPPS weights table before shipping. |
| **Revenue codes** (NUBC / AHA) | **DON'T SHIP any NUBC text** | AHA holds the copyright to the UB-04 manual; "Content cannot be shared, copied, modified or transformed into derivative works" [S23]. | Logic may reference about 10 **revenue-code number families with no descriptions** (e.g. 010X–021X room, 025X pharmacy, 036X OR, 037X anesthesia, 045X ED, 051X clinic, 071X recovery), labeled in our own generic words. **Flag for Tanya review.** The user's own bill text is user data and is shown as-is. |
| **CPT numbers vs AMA descriptors** | **Never ship descriptors. No bulk CPT-keyed tables.** About 15 code families are referenced in rule logic, with our own generic wording. | Same AMA terms [S21]. Citing a handful of code numbers (e.g. the 99281–99285 ED family, 99291–99292 critical care, the 99202–99215 office E/M family) is the kind of reference agency and consumer sites make; bulk tables are not. | CPT codes on the user's bill are user data. The app explains them **generically** (e.g. "an emergency visit level code, 1 of 5"). **Flag for Tanya review.** |

**A2 follow-ups:**
- For NCCI, MUE, PFS and OPPS, write the Level II-only subsets to `out/` and keep the full CPT-bearing builds in `_pending-license/`. They must **never be deployed**; add a build check that fails if any `out/` file contains a match for `\b\d{4}[0-9FTU]\b` in a code field.
- Record CMS's license text verbatim in SOURCES.md.

## HHS poverty guidelines 2026 (effective 2026-01-13; Federal Register doc 2026-00755, 2026-01-15) [S1][S2]

| Household size | 48 states + DC | Alaska | Hawaii |
|---|---|---|---|
| 1 | $15,960 | $19,950 | $18,360 |
| 2 | $21,640 | $27,050 | $24,890 |
| 3 | $27,320 | $34,150 | $31,420 |
| 4 | $33,000 | $41,250 | $37,950 |
| 5 | $38,680 | $48,350 | $44,480 |
| 6 | $44,360 | $55,450 | $51,010 |
| 7 | $50,040 | $62,550 | $57,540 |
| 8 | $55,720 | $69,650 | $64,070 |
| Each additional person | +$5,680 | +$7,100 | +$6,530 |

**Formula:** `guideline(n) = base1 + (n − 1) × increment`.
- 48 states + DC: base1 = 15,960, increment = 5,680.
- AK: base1 = 19,950, increment = 7,100.
- HI: base1 = 18,360, increment = 6,530.

All three tables match this formula for n = 1..8. Territories (PR, USVI, Guam and others) have no defined guidelines [S1]; the app uses the 48-state table and says so.

Note: hospitals may use the guideline in effect on the date of service or the date of application. The app shows "2026 guidelines" and suggests the user ask which year the hospital uses.

## How price benchmarking works without licensed text

All of these run on the device. None sends bill content anywhere.
1. **Bill-internal comparisons (always):** qty × unit price; the same code at different prices on the same bill; room rate per day across the stay.
2. **Public-domain benchmarks (shipped):**
   - NADAC per-unit cost for NDC lines;
   - Medicare national amounts for **Level II** codes (PFS Level II, OPPS Level II);
   - optional v1.1: the CMS Part B ASP file, Level II subset.

   Shown as "billed is N× the public benchmark." Never as "fair price" or "you should pay."
3. **BYO CMS files (user-imported, local):**
   - The user clicks through to the CMS download page, accepts the AMA license themselves, and drops the ZIP or CSV into the app.
   - The app parses it with fflate + a streaming CSV parser into IndexedDB. It never re-uploads the file and never redistributes it.
   - This unlocks CPT MUE, NCCI and PFS checks and multiples.
   - UI copy: "This file comes from CMS under the AMA's license to you. It stays on this device."
4. **Hospital MRF (user-supplied, local, stretch):** compare to the hospital's own discounted cash price or the plan's negotiated rate (45 CFR 180.50) [S18].
5. **Per-code link-out (explicit click):** "Look up this code on cms.gov". Labeled as sending that one code to cms.gov. Never automatic.

**Privacy constraint on shards:** shard requests keyed by code or NDC would tell the server (Vercel request logs) which codes are on a bill. **Every data fetch must be independent of bill content.**
- Either load full datasets up front, which is feasible because the Level II subsets, NADAC and the hospital list are each a few MB compressed;
- or fetch **all** shards in a fixed order before analysis.

QA asserts the request list is identical for two different bills (SPEC §6).
