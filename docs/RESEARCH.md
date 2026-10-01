# RESEARCH: medical bill checker (lane A1, 2026-10-01)

Every legal or policy claim below cites a source in the **Source register** (§S at the end). Each source has a URL and the date it was fetched; all fetches were on **2026-10-01** unless marked otherwise. Anything not fetched today is marked **UNVERIFIED**, and the app must show it with a "not verified" badge or leave it out. Federal regulation text was read from the eCFR API at the **2026-09-29** point-in-time version, which was the latest available on 2026-10-01.

This is consumer information, not legal, medical or financial advice. The app says that on every page that shows findings, letters or rights.

---

## a) Error taxonomy: 30 detectable billing problems

**How to read this section:**
- **Inputs** are the user's itemized bill lines plus the context answers from SPEC §2. Optional extras are the EOB, the GFE, the hospital, and the dates.
- **Data** is shipped public data (see DATA-LICENSING.md); "BYO" means a CMS file the user imports locally.
- **$ impact** is how the app computes dollars at stake. The size classes (S <$50, M $50–$500, L >$500 per instance) are this lane's estimates, not statistics from a source.
- **Every finding is a "possible issue to ask about."** It is never an accusation.

### Group A: internal consistency (bill only, highest reliability)

**E01. Exact duplicate charge**
- **Detect:** the same date of service, the same code (or normalized description if there's no code), the same units and the same amount appear two or more times. Credits that reverse a line cancel it first.
- **Inputs / data:** lines only.
- **$ impact:** the amount of each extra copy. S–L.
- **False-positive traps:**
  - genuinely repeated services: two x-ray views, labs drawn at different times, a drug given twice;
  - bilateral procedures billed as two lines;
  - one charge split across lines;
  - a duplicate already reversed by a credit on a later page.
- **Source:** internal consistency; no rule needed. Medicare's per-day unit logic is in the MUE definition [S20].

**E02. Near-duplicate (same service, different label or price)**
- **Detect:** the same date and code with different amounts or descriptions; or a description-only line that matches a coded line on the same date; or a panel line plus its component lines on the same date (component logic only through BYO NCCI).
- **Inputs / data:** lines; optional BYO NCCI.
- **$ impact:** the smaller line. S–M.
- **Traps:** a professional charge and a facility charge for the same service are both legitimate (different bills); repeat tests.
- **Source:** [S19] (bundling concept).

**E03. Line arithmetic error**
- **Detect:** |qty × unit price − line amount| > $0.01 (a $0.05 tolerance for rounded unit prices).
- **Inputs / data:** lines with qty, unit price and amount.
- **$ impact:** the difference. S–L.
- **Traps:** OCR misreads (always show the parsed number next to the image); unit prices printed rounded; per-dose vs per-unit pricing.
- **Source:** Florida requires itemized statements with "unit price data on rates charged" [S41] (shown as a state example).

**E04. Totals don't reconcile**
- **Detect:** sum of lines ≠ printed total charges; or charges − payments − adjustments ≠ balance due; or a payment shown on the EOB or entered by the user is missing from the bill.
- **Inputs / data:** totals block, payments; optional EOB.
- **$ impact:** the difference. S–L.
- **Traps:** multi-page bills only partly entered; prior balances carried forward; statement vs itemization (a statement is not itemized).
- **Source:** internal consistency.

**E05. Units above the CMS Medically Unlikely Edit (MUE)**
- **Detect:** total units per code per date of service > the MUE value for that code and setting (practitioner vs outpatient hospital vs DME). The MAI column changes confidence:
  - MAI 2 (per-day, policy-based) = higher;
  - MAI 3 (per-day, clinical) = medium;
  - MAI 1 (per line) = check per line.
- **Inputs / data:** HCPCS code, units, date. MUE table: the Level II subset is shipped; CPT rows only through BYO import (see DATA-LICENSING).
- **$ impact:** (units − MUE) × unit price. S–L.
- **Traps:**
  - MUEs are Medicare adjudication edits, not law for commercial plans;
  - some MUE values are confidential and unpublished [S20];
  - drug units are per HCPCS dosage unit, not per vial or mg;
  - inpatient claims are not subject to practitioner/outpatient MUEs.
- **Source:** [S20].

**E06. Implausible quantity**
- **Detect:**
  - a per-day item (room, telemetry, daily monitoring) has more units than stay days;
  - an hourly item has more than 24 units per date;
  - an "admission kit" or "per-stay" item is billed more than once;
  - a decimal shift: qty is 100 but the description says "1 EA", or the unit price × 100 equals a common price;
  - a tablet count that's impossible for the length of stay.
- **Inputs / data:** lines + stay dates.
- **$ impact:** excess units × unit price. S–L.
- **Traps:** per-hour vs per-15-minute units; IV fluids billed per 100 ml.
- **Source:** internal plausibility; MUE concept [S20].

### Group B: dates and the stay

**E07. Room-and-board days exceed nights (the discharge-day charge)**
- **Detect:** room-and-board units > (discharge date − admit date) in days, with a minimum of 1 if admitted and discharged the same day. Room lines are identified by:
  - bill text (ROOM, R&B, SEMI-PRIV, PRIVATE, MED/SURG, TELEMETRY, ICU, CCU, NURSERY);
  - or revenue-code family 010X–021X (numbers only).

  Count every room line across all room types.
- **Inputs / data:** room lines, admit and discharge dates (from the bill header or the user).
- **$ impact:** extra days × that day's room rate from the bill. Typically L.
- **Traps:**
  - observation hours are not room-and-board days;
  - a mid-stay transfer between room types (count the total, not each type);
  - leave-of-absence days;
  - some commercial contracts pay per case;
  - a death or discharge on the admission day still counts as 1 day.
- **Source:** Medicare's day-counting rule: "Do not count the day of discharge or death, unless discharge or death occur on the day of admission"; days run midnight to midnight (Medicare Benefit Policy Manual, Pub. 100-02, ch. 3 §20.1, as quoted by Medicare contractor Noridian) [S28]. Medicare rule; commercial contracts usually follow the same midnight census but aren't bound by it, so confidence is High for Medicare and Medium otherwise.

**E08. Charges dated after discharge**
- **Detect:** a facility line with a date of service later than the discharge date on an inpatient bill.
- **Inputs / data:** line dates, discharge date.
- **$ impact:** the sum of those lines. S–L.
- **Traps:** follow-up outpatient visits printed on the same statement; pharmacy take-home meds; professional reads (radiology or path) dated when the report was finalized; billing-system posting dates printed instead of service dates.
- **Source:** internal consistency (the stay window comes from the admit and discharge dates).

**E09. Charges dated before admission**
- **Detect:** inpatient-bill lines dated before the admit date.
- **Inputs / data:** dates.
- **$ impact:** sum. S–M.
- **Traps:** pre-admission testing is often legitimately bundled into the inpatient claim; for Medicare there is a 3-day payment window. **UNVERIFIED (not fetched):** 42 CFR 412.2(c)(5). Info-level only.

**E10. Room level doesn't match the care received**
- **Detect:** the user says they were never in the ICU or a private room, but there are ICU, CCU or private-room lines; or there are private-room lines with no request.
- **Inputs / data:** room lines + user answer.
- **$ impact:** (billed rate − semi-private rate on the same bill) × days. M–L.
- **Traps:** step-down units; a private room for medical necessity (isolation).
- **Source:** user-verified; no rule cited.

**E11. Inpatient vs observation status mismatch**
- **Detect:** the user says they were "in observation" (or got a Medicare MOON notice) but the bill shows inpatient room-and-board, or the reverse.
- **Inputs / data:** user answer + lines.
- **$ impact:** changes cost-sharing (Part A vs Part B for Medicare). M–L.
- **Traps:** status changes mid-stay are legitimate.
- **Source:** **UNVERIFIED (not fetched):** the CMS two-midnight rule and the MOON notice. Info-level until verified.

### Group C: coding

**E12. Unbundling (NCCI procedure-to-procedure pairs)**
- **Detect:** for each pair of codes on the same date of service (and the same provider, for professional bills), look up an active NCCI PTP edit (column 1 / column 2). The modifier indicator decides the outcome:
  - indicator 0: flag (no modifier can bypass it);
  - indicator 1: flag only if no NCCI-associated modifier is on the column-2 line (25, 59, XE/XS/XP/XU, 91, anatomic modifiers, etc.);
  - indicator 9: ignore (the edit doesn't apply).
- **Inputs / data:** codes, dates, modifiers. PTP edits: Level II pairs are shipped; CPT pairs only through BYO import.
- **$ impact:** the column-2 line amount. S–L.
- **Traps:**
  - itemized bills often omit modifiers (ask for the claim form: UB-04 / CMS-1500);
  - different sessions on the same day;
  - NCCI binds Medicare and Medicaid, while commercial payers use their own edits;
  - hospital vs practitioner edit files differ.
- **Source:** [S19] (structure, column 1/2, quarterly updates). The meaning of modifier indicators 0/1/9 comes from the CMS PTP file documentation (A2 should store the README text from the file it downloads).

**E13. Upcoding signals (evaluation and management levels)**
- **Detect (signals, not proof):**
  - an emergency department visit billed at the top level (code 99285, or facility level 5) when the user reports a short visit with no imaging, labs or admission;
  - critical care (99291/99292) on a visit under about 30 minutes;
  - an office visit at the highest established level (99215) for a brief follow-up;
  - every visit for a provider at the top level (needs several bills).
- **Inputs / data:** codes + user-reported duration and services. Only a handful of CPT numbers appear in the logic; no descriptors.
- **$ impact:** not computable without a benchmark; the app shows "ask for the level criteria." M.
- **Traps:** level is driven by medical decision-making or time, not by visit length; hospitals set their own facility ED-level criteria; critical care can be legitimately short.
- **Source:** **UNVERIFIED (not fetched):** the CMS E/M guidance. Confidence: Low. User text must say "ask how the level was chosen."

**E14. Modifier red flags**
- **Detect:** 25, 59 or X{EPSU} on most lines of a professional bill, or on a pair that has an indicator-1 NCCI edit.
- **Inputs / data:** modifiers; BYO NCCI.
- **$ impact:** amount of the modified line. S–M.
- **Traps:** these modifiers are often correct.
- **Source:** [S19]. Confidence: Low.

**E15. Post-operative visits billed inside a global surgery period**
- **Detect:** E/M visits within 10 or 90 days after a surgery, from the same provider.
- **Inputs / data:** codes, dates, provider. PFS global-days data (CPT-keyed, so BYO only).
- **$ impact:** the visit amounts. S–M.
- **Traps:** unrelated problems; modifiers 24/25/57.
- **Source:** **UNVERIFIED (not fetched):** the PFS global-days indicator. Stretch rule.

### Group D: services not received, or already included

**E16. Canceled, not received, or "phantom" services**
- **Detect:**
  - the user taps "I didn't get this" on a line (the main path);
  - the description contains CANCEL, CANC, D/C'D, NOT GIVEN, RETURNED, WASTE with no matching credit;
  - a med or supply line dated after a cancellation line for the same item;
  - lines for a procedure the user says was canceled.
- **Inputs / data:** lines + user marks.
- **$ impact:** the line amounts. S–L.
- **Traps:** drug "waste" (JW modifier) can be billable; users may not remember meds given while sedated, so the app suggests asking for the Medication Administration Record (MAR) through the HIPAA access right [S15][S16].
- **Source:** the access right to billing and medical records [S15][S16].

**E17. Routine supplies or nursing billed separately**
- **Detect:** lines like GLOVES, GOWN, LINEN, BEDPAN, TOOTHBRUSH, ADMISSION KIT, IV START KIT, "NURSING SERVICES", "ROUTINE CARE" on an inpatient bill that also has room-and-board.
- **Inputs / data:** descriptions.
- **$ impact:** sum. S–M.
- **Traps:** commercial contracts vary, and some items are separately billable.
- **Source:** **UNVERIFIED (not fetched):** the Medicare Provider Reimbursement Manual's routine-services concept. Confidence: Low; text says "ask whether this is included in the room rate."

**E18. Time-based OR, anesthesia and recovery minutes don't add up**
- **Detect:**
  - OR minutes or units billed > anesthesia minutes + 30 (anesthesia usually brackets OR time);
  - recovery-room hours > 6 for outpatient surgery;
  - OR time units not consistent with printed start/stop times;
  - anesthesia minutes > the user-reported procedure length by a wide margin.
- **Inputs / data:** OR/anesthesia/recovery lines with units; optional times from the anesthesia record.
- **$ impact:** excess increments × increment price. M–L.
- **Traps:** OR charges include setup and cleanup in some chargemasters; units may be 15 or 30 minutes; multiple procedures.
- **Source:** **UNVERIFIED (not fetched):** the CMS anesthesia-time definition (Claims Processing Manual ch. 12). Confidence: Low–Medium. The main output is "request the operative and anesthesia records."

### Group E: price context (not errors by themselves)

**E19. Pharmacy markup vs NADAC**
- **Detect:** if a line has an NDC, then billed unit price ÷ (NADAC per unit for that NDC) ≥ 10, with the multiple shown; if there's no NDC, suggest asking for NDCs.
- **Inputs / data:** NDC, qty, unit of measure. NADAC is shipped.
- **$ impact:** the user sees the multiple, not "savings." M–L.
- **Traps:**
  - NADAC is the retail community-pharmacy acquisition cost, not a hospital's cost of preparing and administering a drug;
  - unit mismatches (EA vs ML vs GM);
  - inpatient drugs are often paid per case by insurers.
- **Source:** NADAC 2026 dataset, data.medicaid.gov, public-domain label [S26]. Confidence: Info.

**E20. Price above the hospital's own posted prices**
- **Detect:** the user loads the hospital's machine-readable file (MRF) locally, and the app compares the billed code against that hospital's discounted cash price (uninsured) or the user's plan's negotiated rate (insured).
- **Inputs / data:** code, setting, payer/plan; the MRF is user-supplied.
- **$ impact:** billed − posted. M–L.
- **Traps:** MRF codes and settings vary in quality; packaged vs itemized services.
- **Source:** 45 CFR 180.50 requires gross charge, discounted cash price, payer-specific negotiated charge and de-identified min/max [S18][S17]. Stretch.

**E21. Facility fee on a clinic or telehealth visit**
- **Detect:** lines labeled FACILITY FEE / CLINIC FEE, or revenue family 051X, on what the user says was a doctor's office visit.
- **Inputs / data:** lines + user answer.
- **$ impact:** the facility line. M.
- **Traps:** legitimate under provider-based billing; state rules vary.
- **Source:** Florida requires itemized bills to "clearly identify any facility fee" [S41]. Other state facility-fee laws are **UNVERIFIED**. Confidence: Info.

**E22. A FAP-eligible patient charged more than the amount generally billed (AGB), or charged gross charges, at a 501(r) hospital**
- **Detect:** the screener estimates FAP eligibility, the hospital is nonprofit, and the bill shows full charges with no FAP discount.
- **Inputs / data:** screener + hospital list.
- **$ impact:** at least (gross − AGB). L.
- **Traps:** eligibility needs an application; the hospital sets its own FAP thresholds; ownership "non-profit" in CMS data ≠ confirmed 501(c)(3).
- **Source:** [S11][S9].

### Group F: insurance and the EOB

**E23. Patient balance higher than the EOB's patient responsibility**
- **Detect:** bill balance due (for the same claim and dates) > EOB "patient responsibility" (deductible + copay + coinsurance + non-covered); or the bill shows full charges and the EOB shows an allowed amount and a contractual adjustment.
- **Inputs / data:** bill totals; EOB fields entered by the user.
- **$ impact:** the difference. M–L.
- **Traps:** multiple claims on one statement; a secondary payer still pending; an EOB for a different provider (facility vs physician).
- **Source:** [S8] for NSA cases. Otherwise this rests on the plan contract; in-network contract terms aren't public. Confidence: High when the numbers are entered.

**E24. Provider-liability amounts billed to the patient**
- **Detect:** the EOB shows a denial or adjustment marked as provider responsibility (group "CO", contractual obligation) or "you owe $0" for a line, but the bill asks the patient for it.
- **Inputs / data:** EOB line, group code (the user types it from the EOB; no CARC text is shipped).
- **$ impact:** the line. M–L.
- **Traps:** user typos; out-of-network claims (OON providers aren't bound by the plan contract, except under the NSA, E28).
- **Source:** plan EOB; NSA [S6][S7]. Confidence: Medium.

**E25. Not billed to insurance, or billed to the wrong or old insurer; secondary not billed**
- **Detect:**
  - the user is insured, but the bill shows no insurance payment or adjustment and no "pending insurance" note;
  - there's no EOB for the date;
  - the insurer named on the bill ≠ the user's insurer;
  - the user has secondary coverage (incl. Medicaid) but the bill shows a patient balance after primary.
- **Inputs / data:** bill header + user answers.
- **$ impact:** potentially the full balance. L.
- **Traps:** claims in process; a self-pay election.
- **Source:** user-verified.

**E26. Wrong patient or insurance details**
- **Detect:** the user's own checklist: name spelling, DOB, member ID, group number, subscriber, address, and guarantor vs patient. The app can't see the insurer's records, so it highlights fields to compare.
- **Inputs / data:** user-confirmed.
- **$ impact:** denials can shift the whole claim to the patient. L.
- **Traps:** none (user-confirmed).
- **Source:** HIPAA access to billing records for verification [S15][S16].

**E27. A Medicaid enrollee is balance-billed**
- **Detect:** the user says they had Medicaid on the date of service, and the bill asks for more than the plan's copay.
- **Inputs / data:** user answer + balance.
- **$ impact:** the balance − copay. L.
- **Traps:** the provider didn't know about Medicaid (send the card now); a non-covered service with advance agreement (state rules vary); a provider not enrolled in Medicaid.
- **Source:** 42 CFR 447.15: providers participating in Medicaid must "accept, as payment in full, the amounts paid by the agency plus any deductible, coinsurance or copayment" [S29]. The parallel Medicare protection for Qualified Medicare Beneficiaries is **UNVERIFIED (not fetched)**.

### Group G: legal protections

**E28. A No Surprises Act-protected bill (insured)**
- **Detect:** the user is insured with a plan the NSA covers (not short-term, indemnity or a sharing ministry), and one of these:
  - (a) **emergency care** from an out-of-network (OON) hospital or provider, with the balance asked for > in-network cost-sharing;
  - (b) **non-emergency care at an in-network hospital, outpatient department or ambulatory surgery center** from an OON provider, especially ancillary providers, who can't use notice-and-consent: emergency medicine, anesthesiology, pathology, radiology, neonatology, assistant surgeons, hospitalists, intensivists, and diagnostic radiology and lab services;
  - (c) **air ambulance** OON;
  - (d) a notice-and-consent form signed less than 72 hours before a visit scheduled at least 72 hours ahead.
- **Inputs / data:** context answers + bill.
- **$ impact:** balance − in-network cost-sharing (from the EOB). L.
- **Traps:**
  - ground ambulance is not covered federally [S8];
  - the deductible still applies ("If you got a bill and haven't met your deductible, that's not a violation of the No Surprises Act") [S3];
  - grandfathered or uncovered plan types;
  - a valid waiver by a non-ancillary provider.
- **Source:** 45 CFR 149.410 (emergency) [S6], 149.420 (non-emergency at in-network facilities; ancillary list; 72-hour notice) [S7], CMS consumer page [S8]. Help desk: 1-800-985-3059 [S8].

**E29. Uninsured or self-pay bill ≥ $400 over the Good Faith Estimate; or a missing GFE**
- **Detect:** for each provider or facility on the GFE: total billed − that provider's expected charges ≥ $400 → eligible for patient-provider dispute resolution (PPDR) if the first bill is ≤ 120 calendar days old. Also flag: the visit was scheduled 3 or more business days ahead and there was no GFE → complaint path.
- **Inputs / data:** GFE totals per provider; bill totals per provider; dates.
- **$ impact:** billed − GFE (the PPDR reviewer decides the outcome; the app never promises one). L.
- **Traps:**
  - the threshold is per provider or facility, not the grand total;
  - the uninsured person must have told the provider they weren't using insurance;
  - care before 2022-01-01 isn't eligible;
  - co-provider substitution rules apply.
- **Source:** 45 CFR 149.620 ("at least $400 more than the total amount of expected charges listed on the good faith estimate for the provider or facility"; 120 calendar days from receiving the initial bill) [S4]; 45 CFR 149.610 (GFE timing) [S5]; CMS PPDR page ($25 fee, collections pause) [S3].

**E30. Collection conduct that breaks the rules**
- **Detect** (from user-entered dates and status):
  - (a) at a 501(r) hospital, an extraordinary collection action (ECA: credit reporting, debt sale, lawsuit, lien, garnishment, or denying care over an old bill) before 120 days from the first post-discharge statement, or without a 30-day written notice that included the plain-language FAP summary;
  - (b) collections continue while a FAP application is pending;
  - (c) during a PPDR, the bill is sent to collections or late fees accrue;
  - (d) a medical collection appears on a credit report in violation of bureau policy or state law (see §b5).
- **Inputs / data:** dates + status.
- **$ impact:** n/a (leverage). L.
- **Traps:** non-501(c)(3) hospitals aren't bound by 501(r) (state law may still apply); third-party debt buyers.
- **Source:** [S12][S13][S14] (501(r)); [S4][S3] (PPDR).

---

## b) Patient rights and laws, current as of 2026-10-01

### b1. The right to an itemized bill and billing records

- **Federal (HIPAA right of access).** A covered provider's "designated record set" includes "the medical records and **billing records** about individuals," and a health plan's includes its "enrollment, payment, claims adjudication, and case or medical management record systems" (45 CFR 164.501) [S15].
  - The patient has a right to access these records.
  - The provider or plan must act **no later than 30 days** after receiving the request, and may extend that **once, by no more than 30 days**, with a written statement of the reason (45 CFR 164.524(b)(2)) [S16].
  - The copy must be in the form and format requested "if it is readily producible" [S16].
  - Any fee must be "reasonable, cost-based" and include only labor for copying, supplies, postage, and preparing a summary if the patient agreed to one (164.524(c)(4)) [S16].
  - Note: HHS's older access-guidance page (hhs.gov/hipaa/for-professionals/privacy/guidance/access) returned **404** on 2026-10-01, so the app cites the regulation itself.
  - Practical use: a "billing record" request gets the UB-04 / CMS-1500 claim data, with the codes, modifiers, NDCs and units that many itemized statements leave out.
- **States (example, verified): Florida §395.301.**
  - On request after discharge, a facility must give an itemized statement "within 7 days after the patient's discharge or release or after a request ..., whichever is later."
  - The statement must list services "by date and provider" with "unit price data on rates charged," must "clearly identify any facility fee," and may not use "other" or "miscellaneous" categories.
  - The facility must give an initial response to a billing grievance within 7 business days [S41].
- **Other state itemized-bill laws are UNVERIFIED.** They likely include Illinois (Fair Patient Billing Act, 210 ILCS 88; the fetch failed on a TLS error) and Texas (Health & Safety Code ch. 185; the fetch gave no text). The app should show them as "check your state."

### b2. No Surprises Act (NSA)

**Insured patients** (group plans and individual-market coverage):
- **Emergency services:**
  - out-of-network emergency care can't cost more than in-network cost-sharing;
  - the OON provider "must not bill, and must not hold liable," the patient for more than that cost-sharing (45 CFR 149.410) [S6].
- **Non-emergency care at an in-network hospital, hospital outpatient department or ambulatory surgery center from an OON provider:** the same protection applies, unless there's valid notice and consent (45 CFR 149.420) [S7].
  - Notice and consent is **not allowed** for ancillary services: "emergency medicine, anesthesiology, pathology, radiology, and neonatology," "assistant surgeons, hospitalists, and intensivists," and "diagnostic services, including radiology and laboratory services" [S7].
  - The notice must be given "not later than 72 hours prior" for appointments scheduled at least 72 hours ahead; for same-day scheduling, on the day the appointment is made [S7].
  - CMS says the consent form must be available in the 15 most common languages in the state [S8].
- **Air ambulance** is protected; **ground ambulance is not** under federal law, though state law may protect it. Short-term plans, health care sharing ministries, fixed indemnity, and vision- or dental-only plans are outside the protections [S8].
- **Where to go:** complaints to the No Surprises Help Desk, **1-800-985-3059** [S8]; denied claims are appealed through the plan [S3].

**Uninsured or self-pay patients** (Good Faith Estimate + PPDR):
- **GFE timing (45 CFR 149.610)** [S5]:
  - scheduled at least 3 business days ahead → the GFE is due within 1 business day of scheduling;
  - scheduled at least 10 business days ahead → within 3 business days;
  - requested by the patient → within 3 business days.
- **PPDR eligibility** (45 CFR 149.620; CMS page) [S4][S3]:
  - care on or after 2022-01-01;
  - the patient had or used no insurance and told the provider so;
  - the patient has the GFE;
  - total billed charges are **at least $400 more** than that provider's or facility's expected charges on the GFE;
  - the dispute is started **within 120 calendar days of receiving the initial bill**.
- **Fee:** **$25, non-refundable**; the dispute doesn't start until it's paid. If the patient wins, the $25 is deducted from what they owe. If they settle, the provider must cut the bill by at least $12.50 [S3].
- **During the dispute** the provider must not send the bill to collections or threaten to; must stop collection if it already started; must **suspend late fees**; and must not retaliate (45 CFR 149.620) [S4].
- **CFPB complaint channel** for collectors and credit reports: consumerfinance.gov/complaint, 1-855-411-2372 [S3][S35].

### b3. IRS §501(r): nonprofit-hospital financial assistance

Applies to **501(c)(3) hospital organizations, facility by facility.** For-profit hospitals, and government hospitals without 501(c)(3) status, are not covered (state law may still apply) [S9].
- **FAP contents (501(r)(4)):** eligibility criteria and whether assistance means free or discounted care; the basis for calculating amounts; how to apply; collection actions [S10].
- **Wide publicity:**
  - the full FAP, application and plain-language summary on a website, "without payment of any fee";
  - paper copies in the ER and admissions;
  - the plain-language summary offered at intake or discharge;
  - "conspicuous written notice on billing statements" [S10].
- **Limitation on charges (501(r)(5)):** FAP-eligible patients may be charged no more than the **amounts generally billed (AGB)** to insured patients for emergency or medically necessary care, and less than gross charges for other covered care. AGB is set by the look-back method (allowed ÷ gross charges over 12 months) or the prospective Medicare/Medicaid method [S11].
- **Application period:**
  - starts on the date of care;
  - ends **no earlier than the 240th day after the first post-discharge billing statement** (26 CFR 1.501(r)-1(b)(3)) [S13][S12];
  - hospitals may accept applications later [S13].
- **Notification period:** no ECAs for **at least 120 days** from the first post-discharge billing statement (26 CFR 1.501(r)-6(c)) [S14][S12].
- **30-day notice:** a written notice of the ECAs the hospital intends to take, with a deadline "no earlier than 30 days after" the notice, sent together with the plain-language FAP summary [S14].
- **What counts as an ECA:**
  - selling the debt;
  - reporting to credit bureaus;
  - deferring or denying (or requiring payment before) medically necessary care because of unpaid bills;
  - legal actions: liens, foreclosure, bank-account attachment, civil suits, arrest or body attachment, wage garnishment [S12].
- **Applications:**
  - an incomplete application → the hospital suspends ECAs and tells the patient how to complete it;
  - a complete application → ECAs suspended, a written determination, and refunds of payments above the patient's FAP responsibility (amounts over $5) [S12][S14].
- **Tooling note:** CMS Hospital General Information ownership values ("Voluntary non-profit - Private / Church / Other") are a strong signal, **not proof**, of 501(c)(3) status [S27]. The app links to the IRS Tax Exempt Organization Search for confirmation (**UNVERIFIED link, not fetched**).

### b4. State charity-care laws with mandated thresholds

*(Included from `_work/state-charity-care.md`, sub-agent research, 2026-10-01.)*

Lane A1 working file. Researched 2026-10-01, 12:52-12:59 ET (18-minute hard limit). Every source below was fetched on 2026-10-01. Raw copies (HTML, PDF, DOC and stripped .txt) are saved next to this file in `_work/raw/`.

**Verified = yes** means I fetched the official statute, regulation or agency page and saw the numbers myself. "FPL" means the HHS federal poverty guidelines for the family or household size.

#### 1. Table

| State | Free care | Discount tiers / caps | Who's covered | Hospitals covered | Citation | Source URL (fetched 2026-10-01) | Verified |
|---|---|---|---|---|---|---|---|
| Washington | **Tier A:** ≤300% FPL gets 100% of the patient-responsibility portion free. **Tier B:** ≤200% FPL free. | **Tier A:** 301-350% FPL 75% off; 351-400% FPL 50% off. **Tier B:** 201-250% FPL 75% off; 251-300% FPL 50% off. The discount tiers (not the free tier) "may be reduced by amounts reasonably related to assets", subject to statutory asset exclusions (see notes). | "All patients and their guarantors". It applies to the "patient responsibility portion", so insured patients' balances are covered too. No residency clause in the RCW text. | **Tier A:** hospitals in a system that operates 3+ acute hospitals licensed in WA; acute hospitals with >300 beds in the most populous county; acute hospitals with >200 beds in a county with ≥450,000 residents on the southern border. **Tier B:** all other hospitals. | RCW 70.170.060(5) (2022 c 197 = HB 1616; last amended 2025 c 182); WAC 246-453 (procedures) | https://app.leg.wa.gov/RCW/default.aspx?cite=70.170.060&full=true ; https://app.leg.wa.gov/WAC/default.aspx?cite=246-453&full=true | yes |
| California | The statute sets no separate free-care FPL line. Each hospital must have both a charity care policy and a discount payment policy, and patients at or below 400% FPL "shall be eligible" under one or the other. | Expected payment from an eligible patient at or below 400% FPL is capped at what the hospital would expect from **Medicare or Medi-Cal, whichever is greater** (§127405(d)(1)). Extended payment plan required; a "reasonable payment plan" is ≤10% of monthly family income after essential living expenses (§127400(i)). | Uninsured ("self-pay") patients, **or** insured patients with "high medical costs" (annual out-of-pocket at the hospital >10% of family income, or documented out-of-pocket >10% in the prior 12 months); all at or below 400% FPL. No residency test in the text. | Facilities licensed under H&SC §1250(a), (b) or (f) (general acute, acute psychiatric, special hospitals), except state-hospital, DDS and CDCR facilities. Rural hospitals may set thresholds below 400% (§127405(a)(2)). Emergency physicians must also discount at ≤400% FPL. | H&SC §§127400, 127405 (amended by AB 2297, Stats. 2024 ch. 511, eff. 2025-01-01) | https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=127400 ; https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=127405 | yes |
| New York | <200% FPL: hospital must waive all charges (uninsured and underinsured). | **200-300% FPL:** uninsured pay at most 10% of what Medicaid would have paid (sliding scale); underinsured pay at most 10% of their insurance cost-sharing. **301-400% FPL:** 20% of the Medicaid amount, or 20% of cost-sharing. Monthly payment plan ≤5% of gross monthly income; interest ≤2%. | Uninsured patients up to 400% FPL; underinsured patients up to 400% FPL (out-of-pocket costs over the past 12 months >10% of gross annual income); patients who exhausted their benefits. Residency: eligibility is presumed for emergency services for NY residents, and for other services if the patient lives in the hospital's primary service area. | All DOH-licensed hospitals, whether or not they take part in the Indigent Care Pool. | PHL §2807-k(9-a), as amended by the 2024 budget, eff. **2024-10-20**; DOH DAL CPSO 2024-01 and DAL 25-04 | https://healthweb-back.health.ny.gov/facilities/hospital/financial_assist/ ; https://healthweb-back.health.ny.gov/facilities/hospital/financial_assist/docs/25-04_hospital_financial_assistance.pdf ; https://healthweb-back.health.ny.gov/facilities/hospital/financial_assist/docs/dal_24-01.pdf | yes (DOH agency pages and letters). The statute text itself could not be fetched: nysenate.gov returned a Cloudflare 403. |
| Illinois | **Urban hospitals:** 100% charitable discount at ≤200% FPL. **Rural and Critical Access Hospitals:** 100% at ≤125% FPL. Applies to medically necessary services over $150 (urban) or $300 (rural/CAH) per admission or encounter. | **Urban:** discount for uninsured patients at ≤600% FPL. **Rural/CAH:** discount at ≤300% FPL. The discount is defined so the hospital collects at most charges × cost-to-charge ratio × 1.35 (≈135% of cost). **Maximum collectible:** 20% of family income in any 12-month period. Hospitals may opt out of the 20% cap if assets exceed 600% FPL (MSA hospitals) or 300% FPL (CAH and non-MSA hospitals); primary residence, exempt personal property and retirement plans are excluded. | **Uninsured only.** The patient must be an "Illinois resident" (lives in IL and intends to stay; moving there just for care does not count). Patients with high-deductible plans count as insured. | All hospitals licensed under the Hospital Licensing Act, plus University of Illinois hospitals. | 210 ILCS 89/5, 89/10 (Source: P.A. 102-581, eff. 2022-01-01; P.A. 103-492, eff. 2024-01-01) | https://www.ilga.gov/Documents/legislation/ilcs/documents/021000890K10.htm ; https://www.ilga.gov/Documents/legislation/ilcs/documents/021000890K5.htm | yes |
| Maryland | ≤200% FPL: free medically necessary care. | **Reduced-cost care (minimum out-of-pocket reduction):** 201-250% FPL 75%; 251-300% FPL 60%. **Financial hardship** (medical debt over 12 months >25% of family income) with income <500% FPL: 201-250% 75%; 251-300% 60%; 301-350% 50%; 351-400% 45%; 401-450% 40%; 451-500% 35%. The HSCRC may set higher thresholds. Payment plan required (§19-214.2(d)). | Patients who lack coverage, **or whose coverage does not pay the full bill** (insured are covered). "Medical debt" includes copays, coinsurance and deductibles. Presumptive free-care eligibility for households in means-tested programs, e.g. free or reduced school meals (§(b)(7)). | Every acute care and chronic care hospital under HSCRC jurisdiction. | Md. Code, Health-Gen. §19-214.1. COMAR 10.37.10.26 not verified (see notes). | https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=ghg&section=19-214.1&enactments=false | yes (statute) |
| New Jersey | **Charity care:** ≤200% FPL pays 0%. | **Charity care, share the patient pays:** 201-225% FPL 20%; 226-250% 40%; 251-275% 60%; 276-300% 80%; >300% 100%. At 200-300% FPL, out-of-pocket medical expenses above 30% of gross annual income may also qualify. Asset limits: $7,500 individual, $15,000 family (spend-down allowed). **Separate uninsured cap (§26:2H-12.52):** an uninsured NJ resident with family gross income <500% FPL may be charged no more than **115% of the applicable Medicare rate**, on a DOH sliding scale (§26:2H-12.53). | **Charity care:** NJ residents (proof of residency at the time of service; some exceptions for non-residents) who have no coverage or coverage that pays only part of the bill, and who are not eligible for Medicaid or other programs. **115% cap:** uninsured NJ residents only. | Charity care: all NJ acute care hospitals. 115% cap: all DOH-licensed hospitals. | N.J.A.C. 10:52-11 (charity care); N.J.S.A. 26:2H-12.52 and -12.53 (P.L. 2008, c. 60, effective 180 days after 2008-08-08 approval) | https://www.nj.gov/health/hcf/charity-care/overview/ ; https://pub.njleg.state.nj.us/bills/2008/PL08/60_.HTM | yes (DOH page and enacted law). The N.J.A.C. text itself was not fetched. The DOH page does not say what the 20-80% shares are a percentage of (see notes). |
| Colorado | The statute sets no free tier. Hospitals may write off more, but screening must still be done. | For patients at or below **250% FPL**: charges capped at HCPF-set rates, "the greater of the Medicare rate or the Medicaid base rate" (described as approximating 100% of Medicare or Medicaid, whichever is greater). Payment plans ≤**4%** of monthly household income for facility bills and ≤**2%** for each health care professional's bills. | Uninsured patients must be screened or formally decline screening. **Insured patients may also qualify** ("even if you have health insurance"). Generally Colorado residents only. **Lawful presence not required.** | General acute hospitals, critical access hospitals and freestanding EDs, plus licensed professionals billing for care in those settings. | C.R.S. 25.5-3-501 to -506 (HB21-1198) | https://hcpf.colorado.gov/hospital-discounted-care ; https://hcpf.colorado.gov/hospital-discounted-care-FAQs ; https://hcpf.colorado.gov/sites/hcpf/files/PatientRightsEnglish07012025.pdf | yes (HCPF agency pages). The C.R.S. text itself was not fetched: the leg.colorado.gov fetch returned 0 bytes. |
| Oregon | ≤200% FPL: costs adjusted by 100%. | 200-300% FPL ≥75% off; 300-350% FPL ≥50% off; 350-400% FPL ≥25% off. A hospital may not require a Medicaid application before screening for or providing assistance. | "Patients". §442.614 is not limited to the uninsured on its face; I did not check the definitions in §442.612. **Presumptive screening (§442.615):** required before billing for patients who are uninsured, enrolled in Medicaid, or owe more than $500. Screening needs no documentation and must not affect the patient's credit. | **§442.614 tiers:** nonprofit hospitals and their nonprofit affiliated clinics. **§442.615 screening:** every hospital licensed under ORS 441.025. | ORS 442.614 (2019 c.497; 2021 c.96); ORS 442.615 | https://www.oregonlegislature.gov/bills_laws/ors/ors442.html | yes |
| Connecticut | None mandated. | **Cost cap only:** a hospital, or an entity it owns or is affiliated with, may collect no more than the "cost of providing services" (published charges × the hospital's cost-to-charge ratio) from an "uninsured patient" at or below **250% FPL**. | Uninsured only. The patient must have **applied and been denied Medicaid** and have no other coverage. | Hospitals as defined in §19a-490, plus owned or affiliated entities. | C.G.S. §19a-673 | https://www.cga.ct.gov/current/pub/chap_368z.htm | yes |
| Massachusetts | unverified: per secondary source (mass.gov search-result snippets of 101 CMR 613), "Low Income Patient" status at MAGI ≤150% FPL gives full Health Safety Net coverage with no deductible. | unverified: 150-300% FPL is "Health Safety Net - Partial" with a deductible under 613.04(8)(c). Medical Hardship applies to countable income ≤300% FPL. Deductible formula not obtained. | unverified: MA residents only. Insured patients are covered via "HSN - Secondary". | unverified: acute hospitals and community health centers bill the HSN. It is a state pool, not a hospital-funded mandate. | 101 CMR 613.00 | Tried https://www.mass.gov/doc/health-safety-net-eligible-services-effective-april-1-2024-0/download and https://www.mass.gov/regulations/101-CMR-61300-health-safety-net-eligible-services: **403 / blocked** | no |
| Rhode Island | ≤200% FPL: full charity care (100% discount). Optional asset test: if assets exceed the asset-protection threshold, the patient must get the hospital's highest discount. | 200-300% FPL: partial charity care on a sliding scale that each hospital sets. Hospitals may be more generous but may not be stricter. | **Uninsured, low-income RI residents** who are ineligible for state, federal or employer coverage. | Every licensed hospital. | 216-RICR-40-10-23, §23.14.1 | https://rules.sos.ri.gov/regulations/part/216-40-10-23 | yes |
| Nevada | No FPL mandate. | Not FPL-based: a "major hospital" must discount total billed charges by ≥30% for uninsured inpatients who make reasonable payment arrangements within 30 days of notice. | Uninsured inpatients not eligible for public programs. | "Major hospitals" (definition not checked). | NRS 439B.260 | https://www.leg.state.nv.us/NRS/NRS-439B.html | yes (confirmed there is no FPL mandate) |
| Maine | ≤150% FPL: free medically necessary care (DHHS income guideline, eff. 2007-07-01). | No mandated discount tier found in the rule. | Maine residents. In the rule text I saw, §1.05(B)(1)(b) requires that the individual "is not covered by any insurance nor eligible for" public coverage, so effectively uninsured. | Every hospital must adopt and follow a free care policy. | 10-144 CMR ch. 150 (Free Care Guidelines); 22 M.R.S. §1716 (statute page returned 404) | https://www11.maine.gov/sos/sites/maine.gov.sos/files/content/assets/144c150.doc | yes (rule). The statute was not fetched. |
| New Mexico | None mandated as a discount. Instead, collection is barred: for an "indigent patient" (household income ≤**200% FPL**, measured with Medicaid methods), charges and medical debt "shall not be pursued through collection actions", and existing actions must end. | n/a | Indigent patients. Before seeking payment, facilities must offer uninsured patients screening for public coverage, other programs and facility financial assistance. | Health care facilities. The act also covers some independently billing providers. | Patients' Debt Collection Protection Act, NMSA 1978 §57-32-1 et seq. (SB 71, 2021) | https://www.nmlegis.gov/Sessions/21%20Regular/final/SB0071.pdf | yes (2021 enacted bill text; later amendments not checked) |
| Delaware (**not yet in effect**) | **From 2027-01-01:** ≤300% FPL gets full financial assistance. | 300-350% FPL ≥75% off; 350-400% FPL ≥50% off. Each hospital must have a medical-hardship policy (hospital out-of-pocket ≥10% of household income) with an income ceiling no lower than 500% FPL. Hospitals may go above 400% FPL. | "Financially qualified patient": income under the threshold **and a Delaware resident**. Applies to "patient responsibility" after insurance, so insured patients are covered. | Hospitals defined in 16 Del. C. §1001, excluding psychiatric-only, rehab-only and LTAC hospitals. | 16 Del. C. §§9961-9963 (85 Del. Laws c. 349) | https://delcode.delaware.gov/title16/c099/sc07/index.html | yes |
| Minnesota | No FPL mandate found. | §144.587 imposes a duty to screen uninsured patients for presumptive eligibility and charity care, plus notice and posting rules. The fetched text has no FPL numbers. | n/a | n/a | Minn. Stat. §144.587 | https://www.revisor.mn.gov/statutes/cite/144.587 | yes (confirmed there is no FPL tier) |

#### 2. Per-state notes (subtle points)

- **WA:** The asset exclusions apply only to the discount tiers and only if a hospital chooses to consider assets: first $5,000 for an individual, $8,000 for a family of two and $1,500 per extra member; home equity; non-401(k) retirement plans; one car, or two if needed for work or medical care; burial plans; life insurance with face value ≤$10,000. One account statement is enough proof. Asset information may not be used for collections. Income is measured at the time of service, or at the time of application if the patient applies within 2 years. **Trap:** WAC 246-453-040 still shows the old floors (free care at ≤100% FPL; a sliding scale at 101-200%). The RCW tiers override it, so a checker must not scrape the WAC numbers. WAC procedures: 14 days to decide; 30 days to appeal, with no referral to a collection agency during the first 14 of those days; overpayments refunded within 30 days. The last amendment was 2025 c 182; I did not check what it changed.
- **CA:** Assets cannot be considered at all (§127405(b)(1)), except for Medicare bad-debt purposes when waiving Medicare cost-sharing. Hospitals may not impose time limits on applications (§127405(e)(3)). Income proof is limited to pay stubs or tax returns, and presumptive eligibility is allowed. A hospital cannot require a Medi-Cal application before screening for discounts. Unverified: the 400% FPL level came from AB 1020 (Stats. 2021, ch. 473, eff. 2022-01-01), per my recollection. The current text is as amended by AB 2297 (eff. 2025-01-01).
- **NY:** Under the October 2024 rules (DAL 25-04): assets may not be considered; patients may apply at any time, including during collections; patients cannot be required to pay while an application is pending. No lawsuit may be filed before 180 days after the first bill, and none at all against patients under 400% FPL (the CFO must attest that income is above 400%). Debt may not be sold unless the buyer forgives it. Before the amendment, patients had 90 days to apply, assets could be counted, and payment plans could reach 10% of income. Hospitals may be more generous.
- **IL:** The guaranteed-income exclusion in 89/10(a)(5) became inoperative on 2026-07-01. The "$150" eligibility threshold in 10(a)(1)-(2) differs from the "$300" in 10(b); this is quoted as written. A separate act, 210 ILCS 88 (Fair Patient Billing Act), sets collection rules; it was not checked.
- **MD:** Income is measured at the time of service and updated for changes within 240 days after the initial bill. Patients must have a way to ask for reconsideration, with help from the AG's Health Education and Advocacy Unit. The scaled minimum discounts (75/60/50/45/40/35) appear in the current mgaleg text; I did not check the enacting chapter or its effective date. **COMAR 10.37.10.26 is unverified:** the dsd.maryland.gov page I fetched showed prompt-payment discount text, not the financial-assistance rules.
- **NJ:** The DOH page lists only the patient's percentage share and does not say what it is a share of. Unverified: N.J.A.C. 10:52-11.8 makes it a percentage of charges, per my recollection. Physician, anesthesiology and similar professional fees are generally not covered by charity care, per the DOH page. Hospitals must screen for other coverage first, and a patient who does not finish that screening can be billed.
- **CO:** Rates are updated each July 1 and new codes each January 1. The uniform application (v3.3) has been effective since 2026-04-01. A documented decline-screening form is a complete defense to a §25.5-3-506 claim.
- **OR:** Under §442.615, a patient may apply for assistance up to 12 months after paying. The hospital may require documentation for a full application but not for presumptive screening. Unverified: §442.615 was added in 2023 (HB 3320), per my recollection.
- **CT:** §19a-673 only caps charges at cost. It does not require free care, and it applies only after a Medicaid denial.
- **RI:** The hospital must decide within 14 days of a complete application and must have written appeal and collection processes. It must use the DOH standard application and notice forms.
- **MA:** Unverified: the Health Safety Net is a state-run pool for uncompensated care, not a hospital-funded discount. mass.gov blocked both curl and WebFetch with a 403. Medical Hardship thresholds and the Partial deductible formula are unknown.
- **ME:** Unverified: LD 1955 (2024), which would have raised free care to 200% FPL, did not become law. This is per secondary sources: a Community Catalyst "Maine State Spotlight" (May 2024) summarized in search results.
- **NM:** The act bars collection rather than requiring a discount. A checker should treat ≤200% FPL in New Mexico as "no collection actions allowed".
- **DE:** **Effective 2027-01-01** ("until fulfillment of contingency in 85 Del. Laws c. 349 §6(b)"). After that, a Diamond State Hospital Cost Review Board version takes over (§9963). It is **not in force on 2026-10-01**, so it should be shown as upcoming.

#### 3. States checked with no FPL-threshold mandate

- **Nevada:** verified. NRS 439B.260 gives a flat ≥30% uninsured inpatient discount at major hospitals; it is not FPL-based.
- **Minnesota:** verified. §144.587 is a screening and notice duty with no FPL tiers.
- **Virginia:** no mandate found. Unverified, quick search only; a state indigent-care program exists, per a web-search summary with no official source fetched.
- **Pennsylvania:** no mandate found. Unverified, quick search only.
- **Texas:** no hospital FPL mandate found. Unverified: the statutes.capitol.texas.gov H&S ch. 311 page did not return usable text. Nonprofit community-benefit rules exist, per my recollection.
- **Massachusetts:** has a program (the HSN), but it is listed as unverified rather than "no mandate".

#### 4. Not reached in the time limit

Any other states not listed above. Also the WA 2025 c 182 change details, COMAR 10.37.10.26 text, N.J.A.C. 10:52-11 text, and the NY and CO statute text (agency pages were used instead).

### b5–b6. Medical debt on credit reports; Medicaid retroactive coverage (2025 law)

*(Included from `_work/credit-medicaid.md`, sub-agent research, 2026-10-01.)*

Researched 2026-10-01, 12:52-13:01 ET. Primary sources wherever possible.
- "UNVERIFIED" means I could not confirm the item on a primary or official source within the time box.
- "(secondary)" means a law-firm or advocacy page, not the government source itself.
- Note on congress.gov: it returned HTTP 403 to my fetcher. I read the enacted text of P.L. 119-21 on govinfo (GPO) instead.

---

#### 1. CFPB medical-debt credit-reporting rule (Regulation V): VACATED

##### The rule
- **Final rule.** "Prohibition on Creditors and Consumer Reporting Agencies Concerning Medical Information (Regulation V)", 90 FR 3276, FR Doc. 2024-30824. Published 2025-01-14, listed effective date 2025-03-17. (Source: https://www.federalregister.gov/documents/2025/01/14/2024-30824/prohibition-on-creditors-and-consumer-reporting-agencies-concerning-medical-information-regulation-v, fetched 2026-10-01)
- **Correction.** A correction was published at 90 FR 8173 on 2025-01-27. (Source: https://www.federalregister.gov/documents/2025/01/27/C1-2024-30824/prohibition-on-creditors-and-consumer-reporting-agencies-concerning-medical-information-regulation-v, fetched 2026-10-01)
- **What it did.** It removed the Regulation V exception that let creditors obtain and use medical-debt information. It also provided that a CRA generally may not furnish a creditor a report containing medical-debt information the creditor is barred from using. (Source: Federal Register abstract, URL above, fetched 2026-10-01)
- **Dates on the CFPB rule page:**
  - issued 2025-01-07;
  - original effective date 2025-03-17, later stayed to 2025-06-15.

  (Source: https://www.consumerfinance.gov/rules-policy/final-rules/prohibition-on-creditors-and-consumer-reporting-agencies-concerning-medical-information-regulation-v/, page last updated 2026-02-24, fetched 2026-10-01)

##### The court case: CONFIRMED vacated on 2025-07-11
*Cornerstone Credit Union League v. Consumer Financial Protection Bureau*, E.D. Tex. No. 4:25-cv-00016 (Judge Sean D. Jordan). (Source: https://www.courtlistener.com/docket/69525059/cornerstone-credit-union-league-v-consumer-financial-protection-bureau/, data via the CourtListener API, fetched 2026-10-01)

- **Filing.** Filed 2025-01-07. Cause: 5 U.S.C. 551, Administrative Procedure Act. Plaintiffs include Cornerstone Credit Union League and the Consumer Data Industry Association. (Source: same docket, fetched 2026-10-01)
- **The CFPB switched sides.** It filed a JOINT motion with the plaintiffs to approve a consent judgment (Dkt. 31).
- **Intervenors opposed it.** The defendant-intervenors were Harvey Coleman, David Deeds, the New Mexico Center on Law and Poverty, and Tzedek DC (Dkt. 38, 50).
- **Dkt. 52 (2025-07-11).** "MEMORANDUM OPINION AND ORDER granting 31 JOINT MOTION to Approve Consent Judgment".
- **Dkt. 53 (2025-07-11).** "FINAL JUDGMENT". The case terminated on 2025-07-11. (Source: same docket, fetched 2026-10-01)
- **CFPB's own statement.** The rule page says the court vacated the rule on 2025-07-11 "upon the joint request of the Bureau and the plaintiffs". It found the rule exceeded the Bureau's statutory authority and was contrary to the FCRA. It also says materials about the rule on the CFPB site "are for reference only". (Source: https://www.consumerfinance.gov/rules-policy/final-rules/prohibition-on-creditors-and-consumer-reporting-agencies-concerning-medical-information-regulation-v/, fetched 2026-10-01)
- **CFPB announcement page.** The original 2025-01-07 announcement now sits in the CFPB "archive" section. (Source: https://www.consumerfinance.gov/archive/newsroom/cfpb-finalizes-rule-to-remove-medical-bills-from-credit-reports/, URL seen in search results 2026-10-01, page not opened)

##### Appeal
- **No appeal found.** The CourtListener mirror shows no docket entry after Dkt. 53 (Final Judgment, 2025-07-11), so no notice of appeal appears. (Source: CourtListener docket above, fetched 2026-10-01)
- **UNVERIFIED against PACER.** CourtListener's RECAP data can be incomplete.

##### Federal Register cleanup
- I found no FR document removing the vacated text from 12 CFR part 1022. A Federal Register API search for "medical information" + "Regulation V" published after 2025-02-01 returned only the 2026 Unified Agenda introduction. (Source: https://www.federalregister.gov/api/v1/documents.json?conditions[term]=%22medical+information%22+%22Regulation+V%22&conditions[publication_date][gte]=2025-02-01, fetched 2026-10-01)
- Whether the CFR still prints the vacated text: UNVERIFIED.

##### Related: CFPB preemption interpretive rule (matters for state laws in section 3)
- **The rule.** "Fair Credit Reporting Act; Preemption of State Laws", interpretive rule, 90 FR 48710, FR Doc. 2025-19671, published 2025-10-28. It states that the FCRA "generally preempts State laws that touch on broad areas of credit reporting". It replaces the July 2022 interpretive rule, which the Bureau withdrew in May 2025. (Source: https://www.federalregister.gov/documents/2025/10/28/2025-19671/fair-credit-reporting-act-preemption-of-state-laws, fetched 2026-10-01)
- **Earlier rules it replaces:**
  - 2022 rule: 87 FR 41042, 2022-07-11 (Source: https://www.federalregister.gov/documents/2022/07/11/2022-14150/the-fair-credit-reporting-acts-limited-preemption-of-state-laws, fetched 2026-10-01);
  - May 2025 withdrawal: 90 FR 20084, 2025-05-12 (Source: https://www.federalregister.gov/documents/2025/05/12/2025-08286/interpretive-rules-policy-statements-and-advisory-opinions-withdrawal, fetched 2026-10-01).
- **Effect on state medical-debt bans (secondary).** Commentary says the rule reaches state medical-debt reporting bans, and that interpretive rules are not legally binding. (Source: https://www.goodwinlaw.com/en/insights/blogs/2025/11/cfpb-issues-rule-that-fcra-preempts-state-measures-barring-medical-debt, fetched 2026-10-01)
- **Preemption ruling in Cornerstone (secondary).** Reports say the Cornerstone court also found that the FCRA preempts state laws. (Source: https://www.bhfs.com/insight/federal-court-vacates-cfpbs-medical-debt-rule-finds-fcra-preempts-state-laws/, search result 2026-10-01) UNVERIFIED: I did not read the opinion text.

---

#### 2. Credit-bureau voluntary policies (Equifax, Experian, TransUnion): CONFIRMED

All three bureaus issued the same joint press release on **2023-04-11**. It states:

| Policy | Quote from the release | Status |
|---|---|---|
| Under $500 | "medical collection debt with an initial reported balance of under $500 has been removed from U.S. consumer credit reports" | CONFIRMED |
| Paid collections | "as of July 1, 2022, all medical collection debt that has been paid by the consumer in full is no longer included on U.S. consumer credit reports" | CONFIRMED |
| Waiting period | "The time period before unpaid medical collection debt appears on a consumer's credit report was also increased from six months to one year" | CONFIRMED |
| Scale | Nearly 70% of medical collection tradelines removed from credit files | CONFIRMED |

(Source: https://investor.equifax.com/news-events/press-releases/detail/1286/equifax-experian-and-transunion-remove-medical-collections, fetched 2026-10-01)

The same release appears on the other two bureaus' sites (seen in search results, not opened):
- https://newsroom.transunion.com/equifax-experian-and-transunion-remove-medical-collections-debt-under-500-from-us-credit-reports/
- https://www.experianplc.com/newsroom/press-releases/2023/equifax-experian-and-transunion-remove-medical-collections-debt-under-500-from-us-credit-reports

UNVERIFIED: the date of the bureaus' original 2022 announcement. The 2023 release only says the paid-debt and one-year changes took effect July 1, 2022.

##### Scoring models
- **VantageScore 3.0 and 4.0: CONFIRMED.** Announced 2022-08-10. Neither model "will continue to use medical debt collection data in the calculation of consumers' credit scores". A page update says the three CRAs were expected to implement this "at the end of January 2023". (Source: https://vantagescore.com/resources/knowledge-center/major-credit-score-news-vantagescore-removes-medical-debt-collection-records-from-latest-scoring-models, fetched 2026-10-01)
- **FICO Score 9: CONFIRMED.** A FICO blog post dated 2015-07-13 says "FICO Score 9 disregards all paid collection accounts". It also says unpaid medical collections have a smaller impact than unpaid non-medical collections. (Source: https://www.fico.com/blogs/impact-medical-debt-collections-fico-scores, fetched 2026-10-01)
- **FICO Score 10 / 10T: UNVERIFIED.** No primary FICO page was read. A search snippet said FICO 9 and the FICO 10 Suite give unpaid medical collections over $500 less weight.
- **FICO 8 (the most widely used model): UNVERIFIED.**

---

#### 3. State laws restricting medical debt on credit reports

##### Preemption risk to keep in the spec
- **CFPB position.** The October 2025 interpretive rule says the FCRA generally preempts state credit-reporting laws (section 1).
- **Active challenge to Colorado's law.** *ACA International v. Fulford*, D. Colo. No. 1:25-cv-03530.
  - Filed 2025-11-05; cause 15 U.S.C. 1681 (FCRA).
  - Defendants: Martha Fulford and Phillip Weiser.
  - Still pending: the court authorized a motion to dismiss on 2026-06-08 and entered a scheduling order on 2026-06-12.

  (Source: https://www.courtlistener.com/docket/71877094/aca-international-v-fulford/, via the CourtListener API, fetched 2026-10-01)
- **Maine / First Circuit (secondary, UNVERIFIED).** NCLC says the First Circuit has held that the FCRA does not preempt these laws, and that the Maine preemption question "is back before the federal district court". (Source: https://library.nclc.org/article/latest-keeping-medical-debt-out-credit-reports, fetched 2026-10-01)
- **Product implication.** The tool should say a state ban "applies unless a court rules it preempted", not that it is guaranteed.

##### Table
Legend:
- **OFFICIAL** = the cited cell was checked on an official legislature or government site.
- **NCLC** = National Consumer Law Center table, secondary. (Source for all NCLC cells: https://library.nclc.org/article/latest-keeping-medical-debt-out-credit-reports, fetched 2026-10-01. The search snippet showed "Updated Sept. 3, 2025"; the fetched page reported an update date of Sept. 21, 2026.)

| State | Law | What it bans | Signed | Effective | Verification |
|---|---|---|---|---|---|
| Colorado | HB23-1126 | CRAs may not report medical debt information; debt collectors may not falsely say medical debt will be reported, and must disclose that it will not be (act title). Adds C.R.S. 5-18-103(11.5) and more. | 2023-06-05 (NCLC) | Act takes effect 12:01 a.m. on the day after the 90-day period following adjournment; applies to conduct on or after that date. NCLC gives 2023-08-07. | Bill text and effective-date clause OFFICIAL (Source: https://content.leg.colorado.gov/sites/default/files/2023a_1126_signed.pdf, fetched 2026-10-01). Signing and effective calendar dates UNVERIFIED (NCLC). |
| New York | S4907 (2023), Chapter 727 of 2023 | Amends GBL § 380-j; the text includes the § 380-j(f) list of barred items. Per NCLC it bars providers and collectors from reporting, bars CRA inclusion, and requires contract terms. | Delivered to the Governor 2023-12-13, then "SIGNED CHAP.727"; NCLC says signed 2023-12-13 | "§ 6. This act shall take effect immediately." | Chapter and effective clause OFFICIAL (Source: https://nyassembly.gov/leg/?default_fld=&leg_video=&bn=S04907&term=2023&Summary=Y&Actions=Y&Text=Y, fetched 2026-10-01). Exact signing date UNVERIFIED. NCLC lists the bill as "SB 4097A", which conflicts with the official S4907; treat as an NCLC typo. |
| Minnesota | 2024 Minn. Laws ch. 114, art. 3, sec. 79; new Minn. Stat. § 332C.03 "Medical Debt Reporting Prohibited" | (a) A collecting party may not report medical debt to a CRA. (b) A CRA may not make a consumer report containing information it "knows or should know concerns medical debt". | 2024-05-21 (NCLC) | 2024-10-01 | Text and effective date OFFICIAL (Source: https://www.revisor.mn.gov/laws/2024/0/Session+Law/Chapter/114/, fetched 2026-10-01). Bill number (NCLC: S.F. 4097), the "Debt Fairness Act" name, and the signing date are UNVERIFIED. |
| Connecticut | Public Act 24-6 (Sub. SB 395, 2024) | Providers and collection entities "shall not report any portion of a medical debt to a credit rating agency". Provider contracts with collectors must ban reporting. Any reported portion of the debt is void. Does not directly bind CRAs. | 2024-05-09 | 2024-07-01 | OFFICIAL (Sources: https://www.cga.ct.gov/2024/ACT/PA/PDF/2024PA-00006-R00SB-00395-PA.PDF and https://www.cga.ct.gov/asp/cgabillstatus/cgabillstatus.asp?selBillType=Bill&which_year=2024&bill_num=395, fetched 2026-10-01) |
| California | SB 1061 (2023-24), Chapter 520, Statutes of 2024 | Per NCLC: bars furnishing by providers and collectors, bars CRA inclusion, and bars creditor use. | 2024-09-24 | Non-urgency bill, so 2025-01-01 by default; NCLC says 2025-01-01 with some parts 2025-07-01 | Chapter, approval date and non-urgency OFFICIAL (Source: https://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=202320240SB1061, fetched 2026-10-01). Scope and the July 1 sub-date UNVERIFIED (NCLC). |
| Washington | ESSB 5480, Chapter 145, Laws of 2025 ("Medical debt—consumer credit reporting") | "Hospitals, physician groups, and other professional partners may not furnish information relating to a medical debt ... to a consumer credit reporting agency." A violation makes the debt "void and unenforceable". NCLC says CRA inclusion is also barred. | 2025-04-22 | 2025-07-27 | OFFICIAL (Sources: https://lawfilesext.leg.wa.gov/biennium/2025-26/Pdf/Bills/Session%20Laws/Senate/5480-S.SL.pdf and https://app.leg.wa.gov/billsummary?BillNumber=5480&Year=2025, fetched 2026-10-01). The CRA-inclusion piece was not read in full (NCLC). |
| Vermont | S.27, Act 21 (2025), "An act relating to medical debt relief and excluding medical debt from credit reports" | Per NCLC: bars furnishing by providers and collectors, and bars CRA inclusion. | 2025-05-15 (official status page: "Signed by Governor May 15, 2025") | 2025-07-01 (NCLC) | Act number, title and signing date OFFICIAL (Source: https://legislature.vermont.gov/bill/status/2026/S.27, fetched 2026-10-01). Effective date and scope UNVERIFIED. |
| Maine | LD 558 (SP 237), P.L. 2025, ch. 201, "An Act to Strengthen Consumer Protections by Prohibiting the Report of Medical Debt on Consumer Reports"; codified at 10 M.R.S. §§ 1308, 1310-H (NCLC) | Medical creditors, debt collectors and debt buyers may not report medical debt to a CRA, and CRAs may not include it (secondary: https://www.ebglaw.com/commercial-litigation-update/maine-and-oregon-join-list-of-states-prohibiting-the-reporting-of-medical-debt-on-consumer-reports, fetched 2026-10-01) | 2025-06-09 | 2025-09-24 (NCLC) | Chapter and signing date OFFICIAL (Source: https://legislature.maine.gov/LawMakerWeb/summary.asp?LD=558&SessionID=16, fetched 2026-10-01). Effective date UNVERIFIED. |
| Oregon | SB 605 (2025 R1), Chapter 343 (2025 Laws) | "Prohibits medical service providers from reporting the amount or existence of medical debt to a consumer reporting agency". A CRA may not include an item it "knows or should know is medical debt". A violation is an unlawful practice under the Unlawful Trade Practices Act. | CONFLICT: EBG says 2025-06-17; NCLC says 2025-09-15 | 2026-01-01 (NCLC) | Chapter and summary OFFICIAL (Source: https://olis.oregonlegislature.gov/liz/2025R1/Measures/Overview/SB605, fetched 2026-10-01). Signing and effective dates UNVERIFIED. |
| Illinois | Public Act 103-0648 | CRA inclusion (NCLC) | 2024-07-02 (NCLC) | 2025-01-01 (NCLC) | UNVERIFIED. The ILGA site did not return the act text. |
| New Jersey | Louisa Carman Medical Debt Relief Act. NCLC lists S2806; Orrick lists A3861 (likely companion bills). | Collectors may not report medical debt for services on or after the effective date. CRAs may not include paid medical debt or medical debt under $500. Contract terms required. (Secondary sources: https://infobytes.orrick.com/2024-08-02/new-jersey-bans-medical-debts-credit-reporting/ and NCLC) | 2024-07-22 | 2024-07-22 (NCLC) | UNVERIFIED (no official NJ page read) |
| Rhode Island | SB 2709 (2024) | Bars furnishing by providers and collectors, bars CRA inclusion, requires contract terms (NCLC) | 2024-06-24 (NCLC) | 2025-07-01 (NCLC) | UNVERIFIED |
| Virginia | HB 1370 (2024) | Bars furnishing by providers and collectors (NCLC) | 2024-04-17 (NCLC) | 2024-04-17 (NCLC) | UNVERIFIED |
| Delaware | SS 1 for SB 156 (2025), amending the Medical Debt Protection Act | Bars furnishing by providers and collectors, and bars CRA inclusion (NCLC; also https://www.sheppard.com/insights/blogs/delaware-bans-medical-debt-from-consumer-credit-reports, search result) | 2025-07-29 (NCLC) | 2025-10-27 (NCLC) | UNVERIFIED |
| Maryland | HB 1020 (2025) | Bars furnishing by providers and collectors, bars CRA inclusion, bars creditor use, requires contract terms (NCLC) | 2025-04-22 (NCLC) | 2025-10-01 (NCLC) | UNVERIFIED |
| District of Columbia (extra find) | B26-0438 | Bars furnishing by providers and collectors (NCLC) | 2026-08-20 (NCLC) | 2026-08-20 (NCLC) | UNVERIFIED. The date as reported by NCLC looks odd and should be checked on lims.dccouncil.gov. |

Other notes:
- **Count.** NCLC lists the 15 states above plus DC.
- **Secondary-only blurbs.** A July 2025 secondary article listed Arizona (wage garnishment) and Connecticut (debt relief program) for non-credit-report measures. These are not credit-report bans and are left out. (Source: https://www.certifiedcredit.com/medical-debt-and-credit-reporting-a-growing-patchwork-of-state-protections/, fetched 2026-10-01)

---

#### 4. Medicaid and Marketplace changes in P.L. 119-21 (H.R. 1, 119th Congress, signed 2025-07-04)

Text sources:
- **Enacted text, read here:** https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm (fetched 2026-10-01).
- **congress.gov text URL (requested):** https://www.congress.gov/bill/119th-congress/house-bill/1/text. It returned 403 to my fetcher; I did not read it.
- **CMS guidance:** CMCS Informational Bulletin, 2025-11-18, from Dan Brillman, "'Working Families Tax Cut' Legislation, Public Law 119-21: Summary of Medicaid and Children's Health Insurance Program (CHIP) Related Provisions". CMS calls the law "Working Families Tax Cut" (WFTC). (Source: https://www.medicaid.gov/federal-policy-guidance/downloads/cib11182025.pdf, fetched 2026-10-01)

##### Retroactive coverage, Sec. 71112 "Reducing State Medicaid Costs" (139 Stat. 298-300): CONFIRMED
- **Expansion adults (SSA § 1902(a)(10)(A)(i)(VIII)).** Coverage for care "furnished in or after the month before the month in which the individual made application". That is ONE calendar month before the application month, plus the application month itself. (Source: govinfo P.L. 119-21 text, Sec. 71112(a), new SSA § 1902(a)(34)(A), fetched 2026-10-01)
- **Everyone else.** Coverage for care "furnished in or after the second month before the month in which the individual made application", i.e. TWO calendar months before. (Source: same, new § 1902(a)(34)(B), fetched 2026-10-01)
- **Before this law.** Coverage went back to the "third month before" the application month. That is the language Sec. 71112(b) strikes from SSA § 1905(a). (Source: same, fetched 2026-10-01)
- **CHIP.** If a state chooses to offer retroactive coverage, it cannot cover services "furnished before the second month preceding the month" of application (new SSA § 2102(b)(1)(B)(vi)). (Source: same, Sec. 71112(c), fetched 2026-10-01)
- **Effective date.** The law applies to people whose eligibility "is based on an application made on or after the first day of the first quarter that begins after December 31, 2026", which is 2027-01-01. (Source: same, Sec. 71112(d), fetched 2026-10-01)
- **CMS restates it the same way.** "Effective for applications made on or after January 1, 2027", one month for the adult group and two months for all other individuals; the CHIP amendments are also effective for applications on or after 2027-01-01. (Source: CIB 2025-11-18, p. 13, fetched 2026-10-01)
- **Funding.** $10,000,000 for FY2026 to CMS for implementation. (Source: govinfo text, Sec. 71112(e), fetched 2026-10-01)
- **Your belief is correct, with two refinements:**
  - "Month" means calendar month before the application month, not 30 days.
  - The trigger is the application date (on or after 2027-01-01), not the date of service.
- **State example (state guidance, not federal; out of scope for waivers).** California DHCS letter ACWDL 26-07 implements the same 1-month/2-month rule for applications dated 2027-01-01 or later. (Source: https://www.dhcs.ca.gov/es/services/medi-cal/eligibility/letters/Documents/ACWDL-26-07.pdf, search result, not opened)

##### (a) Community engagement / work requirements, Sec. 71119 (new SSA § 1902(xx))
- **Deadline.** States must start "not later than the first day of the first quarter that begins after December 31, 2026" (2027-01-01), or earlier at state option. (Source: govinfo text, Sec. 71119, fetched 2026-10-01)
- **CMS restatement.** Requirements apply "beginning January 1, 2027". (Source: CIB 2025-11-18, p. 18, fetched 2026-10-01)
- **Good-faith exemptions.** The Secretary may exempt a state that shows good faith; exemptions "shall expire not later than December 31, 2028". (Source: govinfo text, Sec. 71119; CIB 2025-11-18, fetched 2026-10-01)
- **Interim final rule.** HHS had to issue one by 2026-06-01 (Sec. 71119(d)). (Source: govinfo text, fetched 2026-10-01) Whether the IFR was actually published: UNVERIFIED.

##### (b) Six-month redeterminations for expansion adults, Sec. 71107 (amends SSA § 1902(e)(14))
- **Rule.** For renewals "scheduled on or after the first day of the first quarter that begins after December 31, 2026", states must redetermine eligibility "once every 6 months" for § 1902(a)(10)(A)(i)(VIII) enrollees, and for equivalent-coverage waiver enrollees. (Source: govinfo text, Sec. 71107, fetched 2026-10-01)
- **CMS restatement.** "Beginning with renewals scheduled on or after January 1, 2027 ... once every 6 months ... rather than once every 12 months". Other eligibility groups are unchanged. (Source: CIB 2025-11-18, pp. 7-8, fetched 2026-10-01)

##### (c) Marketplace / premium tax credit (PTC) provisions relevant to uninsured people
All from the govinfo text of P.L. 119-21, fetched 2026-10-01.

| Section | Change | Effective |
|---|---|---|
| Sec. 71304 | No PTC for a plan "enrolled in during a special enrollment period" granted on the basis of expected household income relative to a poverty-line percentage, and not tied to a qualifying event (i.e. the low-income/income-based SEP) | Plan years beginning after 2025-12-31, so in force for 2026 coverage |
| Sec. 71305 | Removes the cap on repaying excess advance PTC (36B(f)(2)(B) struck), so people who underestimate income repay in full | Tax years beginning after 2025-12-31 (tax year 2026) |
| Sec. 71302 | Removes PTC eligibility for lawfully present people under 100% FPL who are barred from Medicaid by immigration status (36B(c)(1)(B) struck) | Tax years beginning after 2025-12-31 |
| Sec. 71303 | Pre-enrollment verification required before advance PTC | Tax years beginning after 2027-12-31 |
| Sec. 71301 | Limits PTC to certain categories of immigrants | Tax years beginning after 2026-12-31 |

Related item not in this law: whether the enhanced PTCs that were set to expire after 2025 were extended. Not researched; UNVERIFIED.

##### 2025 Marketplace Integrity and Affordability rule (90 FR 27074)
Case: *City of Columbus v. Kennedy*, D. Md. No. 1:25-cv-02114 (Judge Brendan Abell Hurson). (Source: https://www.courtlistener.com/docket/70684987/, CourtListener API, fetched 2026-10-01)

- **2026-06-12.** Dkt. 73 is the memorandum opinion. Dkt. 74 is an order granting in part and denying in part the cross-motions for summary judgment and "vacating provisions of the final rule entitled 'Patient Protection and Affordable Care Act; Marketplace Integrity and Affordability,' 90 Fed. Reg. 27074 as specified herein".
- **2026-06-16.** A consent clarifying order (Dkt. 76).
- **2026-06-23.** The Fourth Circuit granted the government's motion to voluntarily dismiss its EARLIER appeal (Dkt. 39), under Rule 42(b) (Dkt. 77).
- **2026-07-16.** The government appealed the 2026-06-12 judgment (Dkt. 79). Fourth Circuit No. 26-1938, docketed 2026-07-21, PENDING. (Source: https://www.courtlistener.com/docket/73660074/, fetched 2026-10-01)
- **Which provisions were vacated: UNVERIFIED (secondary only).** Secondary reports say the vacated parts include:
  - the $5 auto-re-enrollee charge;
  - the past-due-premium policy;
  - SEP eligibility verification;
  - failure-to-reconcile;
  - income verification;
  - the actuarial-value de minimis change.

  They also say the court blocked the shortened open enrollment for 2027 and restored the 60-day income-inconsistency extension. (Source: https://www.beckershospitalreview.com/legal-regulatory-issues/3-lawsuits-standing-in-the-way-of-an-aca-marketplace-overhaul/, search result 2026-10-01) An August 2025 stay order also existed (secondary); its date is UNVERIFIED.
- **Second related case, not examined.** The same plaintiffs filed *City of Columbus v. Kennedy*, D. Md. No. 1:26-cv-02215, on 2026-06-03 (CourtListener). Its subject (likely a later Marketplace rule) is UNVERIFIED.
- **Status of the rule's income-based-SEP pause:** UNVERIFIED. Either way, Sec. 71304 of P.L. 119-21 denies PTC for income-based-SEP enrollments starting with plan year 2026.

---

#### Still UNVERIFIED (summary)
1. Any appeal of the Cornerstone judgment: none on CourtListener, not checked on PACER. Also whether 12 CFR 1022 still prints the vacated text.
2. FICO 8 and FICO 10/10T treatment of medical collections.
3. State rows checked only against NCLC or law-firm summaries: IL, NJ, RI, VA, DE, MD, DC.
4. Partial gaps:
   - effective dates for VT, ME and OR, and signing date for OR (sources conflict);
   - CO calendar dates;
   - MN bill number;
   - NY signing date;
   - CA July 2025 sub-date and scope.
5. Whether the community-engagement interim final rule was published by 2026-06-01. The exact list of Marketplace Integrity provisions vacated on 2026-06-12. The enhanced-PTC extension status.

### b7. Hospital price transparency as a price-check source

- Since 2021-01-01, hospitals must post (1) a comprehensive **machine-readable file (MRF)** of standard charges for all items and services, and (2) a consumer-friendly display of shoppable services, or a price estimator tool [S17].
- 45 CFR 180.50 requires the MRF to include, per item or service and setting:
  - gross charge;
  - **discounted cash price**;
  - payer- and plan-specific negotiated charges;
  - de-identified minimum and maximum negotiated charges;
  - codes [S18].
- The CY 2026 OPPS final rule changed hospital price transparency (HPT) policy, **with enforcement beginning 2026-04-01** [S17]. CMS audits samples and takes complaints; contact: PriceTransparencyHospitalCharges@cms.hhs.gov [S17].
- **How the app uses it (stretch):**
  - the user downloads their hospital's MRF, or the app opens the hospital's page on the user's click (a network event the app labels);
  - the app parses the file **locally** and shows "billed vs this hospital's own discounted cash price or your plan's negotiated rate";
  - it never fetches an MRF with a URL built from bill content without that labeled click.

---

## c) Assistance programs (who each helps, plus the link)

| Program | Who it helps | Link | Verified |
|---|---|---|---|
| Hospital Financial Assistance Policy (FAP) | Patients of nonprofit (501(r)) hospitals, and patients in states with charity-care mandates (§b4). Apply directly to the hospital; the 240-day window applies under 501(r). | The hospital's website (required by [S10]) | rule: yes [S10][S13] |
| Dollar For | Nonprofit; helps anyone with hospital debt apply for hospital financial assistance (charity care); free, donor-funded. "Most hospitals are required to have programs that discount or completely forgive bills for some patients." | https://dollarfor.org | yes [S32] |
| Undue Medical Debt (formerly RIP Medical Debt) | Buys medical debt in bulk and abolishes it. Individuals generally can't apply; relief arrives by letter. | https://unduemedicaldebt.org | **UNVERIFIED**: the site returned 403 to automated fetch on 2026-10-01; description from prior knowledge |
| PAN Foundation | Insured patients with specific diseases: copays, out-of-pocket costs; funds open and close. | https://www.panfoundation.org | **UNVERIFIED** (403) |
| HealthWell Foundation | Insured patients, household income within **500% FPL**, with a covered disease: "copays, premiums, deductibles and out-of-pocket expenses"; some funds close. | https://www.healthwellfoundation.org | yes [S33] |
| Patient Advocate Foundation | Patients with chronic or serious illness: free case management, co-pay relief and financial-aid funds. | https://www.patientadvocate.org | **UNVERIFIED** (403) |
| State Consumer Assistance Programs (CAPs) | Insured people with plan problems: appeals, complaints, enrollment help. CMS keeps the state map. | https://www.cms.gov/cciio/resources/consumer-assistance-grants | link verified 200 [S30] |
| 211 | Local help (utilities, food, health programs) by phone 2-1-1 or the web. | https://www.211.org | link verified 200 [S34] |
| Medicaid / CHIP and Marketplace (incl. special enrollment periods) | The uninsured. Medicaid may pay bills from before the application (retroactive months; see §b6 for the 2027 change). Marketplace SEPs follow qualifying life events. | https://www.healthcare.gov/screener/ ; https://www.healthcare.gov/coverage-outside-open-enrollment/special-enrollment-period/ | links verified 200 [S31] |
| No Surprises Help Desk | NSA complaints (insured or uninsured). | 1-800-985-3059 | yes [S8] |
| CFPB | Complaints about debt collectors and credit reports. | https://www.consumerfinance.gov/complaint/ , 1-855-411-2372 | yes [S3][S35] |

---

## d) Preflight: existing tools, and how we differ

These were found by web search on 2026-10-01 (listing pages only; the products weren't tested) [S39]. The field is crowded. At least a dozen AI bill checkers launched in 2025–26, and most upload the bill to a server and/or an LLM and charge for letters.

| Tool | Model | Privacy (as described) | Notes |
|---|---|---|---|
| Billscope | Freemium (Pro $7.99/mo for dispute and appeal letters) | Server/AI (stated: scans, saves bills) | Detects duplicates, unbundling, upcoding, med markups, OR time, NSA |
| MedBillAI | First scan free | Upload; says "HIPAA compliant" | AI flags + dispute letter |
| BillGuard AI | Free analysis, $9.99 letter | Upload | |
| Bill Decoder | Physician-built platform | Upload | Line-by-line flags + letter |
| Barely Legible | Freemium (credits / Pro) | Photo import → app | Unbundling, NSA, med charges |
| Bill Sherlock | — | Upload | Compares charges to Medicare rates + a "5,000+ facility" price database |
| BillWitness | iOS | — | 8 error patterns |
| BillProof: Bill Decoder | iOS, Pro $9.99/mo | — | Medicare-rate comparison, duplicates, balance billing |
| Medical Bill Negotiator: IQ; Curai Health; MedBill-IQ | Negotiation services (MedBill-IQ takes 30% of savings) | Upload + humans | |
| kill-the-bill (GitHub, MIT) | Open source, 1 commit | Claims "privacy-first"; implementation unclear | Not maintained |
| MediShield free checker | Free | Claims "100% in browser" | NSA + unbundling only |
| General chatbots (e.g., the widely reported 2025 case where a family used Claude to contest a $195,628 bill, which fell to about $33,000) | $20/mo subscription | The bill goes to the chatbot provider | News coverage [S40]. Shows demand; also shows the risk of unverified AI claims. |

**How we differ (and what we can prove):**
1. **Private by construction, with proof.** The bill never leaves the browser. A strict CSP, no analytics or error reporting on tool pages, and a published Playwright test show zero bill bytes on the network (SPEC §6). Competitors ask for uploads.
2. **Free, with no upsell.** MIT open source; no letter paywall.
3. **Transparent deterministic rules.** Each finding carries a rule ID, evidence lines, a confidence level and a primary-source citation with its verification date. Nothing is an unexplained AI verdict.
4. **A published accuracy scoreboard.** Per-rule precision and recall on a synthetic planted-error corpus, including where we fail.
5. **Charity care built in.** FPL math with the 2026 guidelines, a nonprofit-hospital lookup, state-law tiers, and 501(r) clocks. Most checkers stop at "dispute."
6. **Honest scope.** We don't ship AMA CPT or NUBC text (see DATA-LICENSING); we say so, and explain how to bring your own CMS file.

---

## §S. Source register (fetched 2026-10-01 unless noted)

| ID | Source | URL | Notes |
|---|---|---|---|
| S1 | ASPE, HHS Poverty Guidelines (2026 tables) | https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines | Tables parsed from the HTML on 2026-10-01 |
| S2 | Federal Register, Annual Update of the HHS Poverty Guidelines, 91 FR (2026-01-15), doc 2026-00755 | https://www.govinfo.gov/content/pkg/FR-2026-01-15/html/2026-00755.htm | Located by search; values match S1; effective 2026-01-13 per the search summary (not opened) |
| S3 | CMS, "Dispute a medical bill" (PPDR) | https://www.cms.gov/initiatives/your-patient-rights/medical-bill-rights/get-help/dispute-bill | Redirect from /medical-bill-rights/help/dispute-a-bill |
| S4 | 45 CFR 149.620 (PPDR) | https://www.ecfr.gov/current/title-45/section-149.620 | eCFR API, as of 2026-09-29 |
| S5 | 45 CFR 149.610 (GFE) | https://www.ecfr.gov/current/title-45/section-149.610 | same |
| S6 | 45 CFR 149.410 (emergency services) | https://www.ecfr.gov/current/title-45/section-149.410 | same |
| S7 | 45 CFR 149.420 (non-emergency at in-network facilities; notice and consent) | https://www.ecfr.gov/current/title-45/section-149.420 | same |
| S8 | CMS, Know your rights: insurance | https://www.cms.gov/initiatives/your-patient-rights/medical-bill-rights/know-your-medical-bill-rights/know-your-rights-insurance | |
| S9 | IRS, Requirements for 501(c)(3) hospitals (§501(r)) | https://www.irs.gov/charities-non-profits/charitable-organizations/requirements-for-501c3-hospitals-under-the-affordable-care-act-section-501r | |
| S10 | IRS, FAP and emergency medical care policy (§501(r)(4)) | https://www.irs.gov/charities-non-profits/financial-assistance-policy-and-emergency-medical-care-policy-section-501r4 | |
| S11 | IRS, Limitation on charges (§501(r)(5)) | https://www.irs.gov/charities-non-profits/limitation-on-charges-section-501r5 | |
| S12 | IRS, Billing and collections (§501(r)(6)) | https://www.irs.gov/charities-non-profits/billing-and-collections-section-501r6 | |
| S13 | 26 CFR 1.501(r)-1 (definitions incl. application period) | https://www.ecfr.gov/current/title-26/section-1.501(r)-1 | eCFR API |
| S14 | 26 CFR 1.501(r)-6 (billing and collections) | https://www.ecfr.gov/current/title-26/section-1.501(r)-6 | eCFR API |
| S15 | 45 CFR 164.501 (designated record set) | https://www.ecfr.gov/current/title-45/section-164.501 | eCFR API |
| S16 | 45 CFR 164.524 (right of access) | https://www.ecfr.gov/current/title-45/section-164.524 | eCFR API |
| S17 | CMS, Hospital Price Transparency | https://www.cms.gov/priorities/key-initiatives/hospital-price-transparency | |
| S18 | 45 CFR 180.50 (MRF contents) | https://www.ecfr.gov/current/title-45/section-180.50 | eCFR API |
| S19 | CMS, Medicare NCCI PTP edits | https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-procedure-procedure-ptp-edits | Downloads route through /license/ama |
| S20 | CMS, Medicare NCCI MUEs | https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-medically-unlikely-edits | "other MUE values are confidential" |
| S21 | CMS, AMA CPT license (click-through) | https://www.cms.gov/license/ama | Quoted in DATA-LICENSING |
| S22 | CMS, HCPCS overview (Level I = AMA CPT; Level II = CMS) | https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system | |
| S23 | NUBC, UB-04 manual subscription (AHA copyright) | https://www.nubc.org/subscription-information | |
| S24 | CDC NCHS, ICD-10-CM | https://www.cdc.gov/nchs/icd/icd-10-cm/index.html | "WHO ... owns and publishes ICD-10, authorized NCHS" |
| S25 | CMS, MS-DRG classifications and software (v44 = FY2027, eff. 2026-10-01) | https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/ms-drg-classifications-and-software | |
| S26 | data.medicaid.gov, "NADAC (National Average Drug Acquisition Cost) 2026", id fbb83258-11c7-47f5-8b18-5f8e79f7e704 | https://data.medicaid.gov/dataset/fbb83258-11c7-47f5-8b18-5f8e79f7e704 | Metastore: modified 2026-09-29; license https://www.usa.gov/publicdomain/label/1.0/ ; accessLevel public |
| S27 | data.cms.gov, Hospital General Information (xubh-q36u) | https://data.cms.gov/provider-data/dataset/xubh-q36u | Metastore: modified 2026-07-22; accessLevel public; no license field |
| S28 | Noridian (Medicare contractor JF Part A), Counting Inpatient Days, citing Pub. 100-02 ch. 3 §20.1 | https://med.noridianmedicare.com/web/jfa/topics/claim-submission/counting-inpatient-days | The CMS manual PDF URL returned 404 today |
| S29 | 42 CFR 447.15 (Medicaid payment in full) | https://www.ecfr.gov/current/title-42/section-447.15 | eCFR API |
| S30 | CMS, Consumer Assistance Program grants (state CAP map) | https://www.cms.gov/cciio/resources/consumer-assistance-grants | HTTP 200 |
| S31 | HealthCare.gov screener and SEP page | https://www.healthcare.gov/screener/ ; https://www.healthcare.gov/coverage-outside-open-enrollment/special-enrollment-period/ | HTTP 200 |
| S32 | Dollar For | https://dollarfor.org | fetched |
| S33 | HealthWell Foundation | https://www.healthwellfoundation.org | fetched |
| S34 | 211 | https://www.211.org | HTTP 200 |
| S35 | CFPB complaint portal | https://www.consumerfinance.gov/complaint/ | HTTP 200 |
| S36–S38 | Undue Medical Debt; PAN Foundation; Patient Advocate Foundation | (see table §c) | 403 to automated fetch |
| S39 | Preflight search results (Billscope, MedBillAI, BillGuard AI, Bill Decoder, Barely Legible, Bill Sherlock, BillWitness, BillProof, Medical Bill Negotiator IQ, Curai, MedBill-IQ, kill-the-bill, MediShield) | e.g. https://apps.apple.com/app/id6761785810 ; https://peerpush.com/p/bill-sherlock ; https://appgoblin.info/apps/6776348305 ; https://github.com/abidlabs/kill-the-bill ; https://coverager.com/?p=4529 | Listings only; not tested |
| S40 | News coverage of the $195k → $33k Claude case (secondary) | https://gigazine.net/gsc_news/en/20251029-using-ai-negotiate-hospital-bill-down | Secondary source; use only as "reported" |
| S41 | Florida Statutes §395.301 (itemized statement) | http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0300-0399/0395/Sections/0395.301.html | fetched |
| SC-* | State charity-care sources | see the §b4 table (each row has its URL) | fetched by sub-agent, 2026-10-01 |
| CR-* | Credit-reporting and Medicaid sources | see §b5–b6 | fetched by sub-agent, 2026-10-01 |
