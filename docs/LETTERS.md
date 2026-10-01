# LETTERS: 7 plain-language templates (lane A1, 2026-10-01)

**Format:**
- Merge fields use `{{snake_case}}`. Loops use `{{#findings}} … {{/findings}}` (Mustache-style), with fields from the finding schema.
- The app fills fields from the parsed bill, the context answers, the screener and the user's selected findings. Every field stays editable. Letters are generated on the device and never sent by the app.

**Every letter footer includes:**
- "This letter was prepared with Finecomb, a free consumer tool. It is not legal advice."
- "I am keeping a copy of this letter. Please reply in writing."

**Guidance shown beside every letter:**
- Send by certified mail with a return receipt, or through the patient portal's message center, and save a copy or screenshot.
- Write down the date sent; the app adds it to the local deadline tracker.
- Never mail originals.

**Common merge fields:**
- **Patient and guarantor:** `{{today}}`, `{{patient_name}}`, `{{patient_dob}}`, `{{patient_address}}`, `{{guarantor_name}}`, `{{phone}}`, `{{email}}`.
- **Provider and account:** `{{provider_name}}`, `{{provider_billing_address}}`, `{{account_number}}`, `{{statement_date}}`, `{{dates_of_service}}`, `{{total_billed}}`, `{{balance_due}}`.
- **Insurance:** `{{insurer_name}}`, `{{member_id}}`, `{{group_number}}`, `{{claim_number}}`.

---

## L1. Request for an itemized bill and billing records

Merge fields: common + `{{state_itemized_law_sentence}}` (optional; e.g. Florida §395.301).

> {{today}}
>
> {{provider_name}} — Billing Office
> {{provider_billing_address}}
>
> **Re: Itemized bill request — {{patient_name}}, DOB {{patient_dob}}, account {{account_number}}, dates of service {{dates_of_service}}**
>
> Hello,
>
> Please send me a complete itemized bill for the account above. For each charge, please list:
> - the date of service;
> - the billing code (CPT/HCPCS) and any modifiers;
> - the revenue code;
> - the National Drug Code (NDC) for each drug;
> - the quantity or units;
> - the unit price and line total;
> - the department or provider.
>
> Please also send copies of the claim forms you sent to my insurance (UB-04 and/or CMS-1500), and a record of all payments and adjustments on this account.
>
> I am asking for these as part of my right to access my billing records under HIPAA. A provider's "designated record set" includes billing records (45 CFR 164.501), and you must act on my request within 30 days (45 CFR 164.524). {{state_itemized_law_sentence}}
>
> While I review the bill, please put this account on hold and do not send it to collections. Please send the records to {{patient_address}} or {{email}}, in electronic form if possible.
>
> Thank you,
> {{patient_name}} · {{phone}}

Citations: 45 CFR 164.501, 164.524 [S15][S16]; Florida §395.301 if applicable [S41].

---

## L2. Line-item dispute

Merge fields: common + the loop `{{#findings}} {{line_date}} · {{line_description}} · {{line_code}} · {{line_amount}} · {{issue_plain}} · {{request_plain}} {{/findings}}`, `{{total_disputed}}`, `{{records_requested}}` (e.g. "the medication administration record and the anesthesia record").

> {{today}}
>
> {{provider_name}} — Billing Office / Patient Financial Services
> {{provider_billing_address}}
>
> **Re: Billing questions — {{patient_name}}, account {{account_number}}, dates of service {{dates_of_service}}**
>
> Hello,
>
> I reviewed my itemized bill dated {{statement_date}} and have questions about the charges below. Each one may be an error. Please review them and correct the bill if needed.
>
> {{#findings}}
> - **{{line_date}} — {{line_description}} ({{line_code}}) — {{line_amount}}.** {{issue_plain}} *I am asking you to:* {{request_plain}}
> {{/findings}}
>
> The total in question is {{total_disputed}}.
>
> To help me check these charges, please also send {{records_requested}}. I am asking for these under my HIPAA right of access (45 CFR 164.524).
>
> Please send me a corrected itemized bill, or a written explanation for each item. Please do not send this account to collections or report it to a credit bureau while these questions are open.
>
> Thank you,
> {{patient_name}} · {{phone}}

Each finding's `issue_plain` and `request_plain` come from the rule's user text (SPEC §3). For example, RB-01: "I was billed for 4 room days, but I was admitted 6/2 and discharged 6/5 (3 nights). Hospitals generally don't count the discharge day." / "remove the extra room day."

Citations: per finding (each carries its own); 45 CFR 164.524 [S16].

---

## L3. Financial assistance (charity care) application + request to pause collections

Merge fields: common + `{{household_size}}`, `{{annual_income}}`, `{{fpl_percent}}`, `{{first_statement_date}}`, `{{is_nonprofit_501r}}` (bool), `{{state_law_sentence}}` (from the state table; e.g. WA RCW 70.170.060), `{{enclosures}}`.

> {{today}}
>
> {{provider_name}} — Financial Assistance / Charity Care
> {{provider_billing_address}}
>
> **Re: Financial assistance application — {{patient_name}}, account {{account_number}}**
>
> Hello,
>
> I am applying for financial assistance for the bill above. My household has {{household_size}} people and an annual income of about {{annual_income}} (about {{fpl_percent}}% of the 2026 federal poverty guideline). My completed application and documents are enclosed: {{enclosures}}.
>
> If anything is missing, please tell me in writing what you need.
>
> {{#is_nonprofit_501r}}
> As a nonprofit hospital, you must accept and process financial assistance applications for at least 240 days after the first post-discharge bill. Mine was dated {{first_statement_date}} (26 CFR 1.501(r)-1). While my application is pending, please suspend all collection actions, including credit reporting, sale of the debt and lawsuits (26 CFR 1.501(r)-6). If I qualify, I understand that I cannot be charged more than the amounts generally billed to insured patients (IRS §501(r)(5)), and that payments above my share will be refunded.
> {{/is_nonprofit_501r}}
>
> {{state_law_sentence}}
>
> Please also send me your Financial Assistance Policy and its plain-language summary. Please send your decision in writing.
>
> Thank you,
> {{patient_name}} · {{phone}}

Citations: [S10][S11][S12][S13][S14]; the state row from RESEARCH §b4.

---

## L4. Surprise bill (insured): No Surprises Act dispute to the provider, copied to the insurer

Merge fields: common + `{{scenario}}` ∈ {emergency, ancillary_in_network_facility, air_ambulance}, `{{facility_name}}`, `{{clinician_type}}`, `{{eob_patient_responsibility}}`, `{{amount_over}}`.

> {{today}}
>
> {{provider_name}} — Billing Office · cc: {{insurer_name}}, Member Services
>
> **Re: Out-of-network bill protected by the No Surprises Act — {{patient_name}}, account {{account_number}}, claim {{claim_number}}, date of service {{dates_of_service}}**
>
> Hello,
>
> I received a bill for {{balance_due}}. My insurer's Explanation of Benefits says my share is {{eob_patient_responsibility}}. You are billing me {{amount_over}} more than that.
>
> {{#emergency}}This was emergency care. Under the No Surprises Act, out-of-network providers may not bill me more than my in-network cost-sharing for emergency services (45 CFR 149.410).{{/emergency}}
> {{#ancillary_in_network_facility}}I received this care at {{facility_name}}, an in-network facility, from a {{clinician_type}}. Out-of-network {{clinician_type}} services at an in-network facility are protected, and these providers cannot ask patients to waive that protection (45 CFR 149.420).{{/ancillary_in_network_facility}}
> {{#air_ambulance}}This was an air ambulance service. The No Surprises Act limits my cost to in-network cost-sharing.{{/air_ambulance}}
>
> Please correct my bill to the in-network cost-sharing amount and refund any overpayment. Please do not send this bill to collections while it is resolved.
>
> If this is not corrected, I will file a complaint with the No Surprises Help Desk (1-800-985-3059).
>
> Thank you,
> {{patient_name}} · {{phone}}

Citations: [S6][S7][S8]. Guidance shown: "If your deductible isn't met, owing that amount isn't an NSA violation" [S3]; "ground ambulance isn't covered by the federal law" [S8].

---

## L5. Uninsured / self-pay: notice of a federal bill dispute (PPDR) when the bill is $400+ over the Good Faith Estimate

Merge fields: common + `{{gfe_date}}`, `{{gfe_amount}}`, `{{billed_amount}}`, `{{difference}}`, `{{initial_bill_date}}`, `{{ppdr_deadline}}` (= initial bill date + 120 calendar days), `{{ppdr_filed_date}}` (optional).

> {{today}}
>
> {{provider_name}} — Billing Office
>
> **Re: Bill is $400 or more above my Good Faith Estimate — {{patient_name}}, account {{account_number}}, date of service {{dates_of_service}}**
>
> Hello,
>
> I did not use insurance for this care, and I received your Good Faith Estimate dated {{gfe_date}} for {{gfe_amount}}. Your bill dated {{initial_bill_date}} charges {{billed_amount}}, which is {{difference}} more than the estimate.
>
> Under federal rules, when a provider's bill is at least $400 more than its Good Faith Estimate, an uninsured or self-pay patient can start a patient-provider dispute within 120 days of the first bill (45 CFR 149.620). {{#ppdr_filed_date}}I started that dispute on {{ppdr_filed_date}}.{{/ppdr_filed_date}}{{^ppdr_filed_date}}I plan to start that dispute by {{ppdr_deadline}} unless we resolve this first.{{/ppdr_filed_date}}
>
> While a dispute is pending, you may not send this bill to collections or threaten to, must stop any collection already under way, must suspend late fees, and may not take action against me for disputing (45 CFR 149.620).
>
> I would prefer to settle this directly. Please send a corrected bill that matches the estimate, or an explanation of the extra charges.
>
> Thank you,
> {{patient_name}} · {{phone}}

Guidance shown:
- File at the CMS dispute page; the fee is $25, deducted from what you owe if you win [S3].
- "Keep your GFE and the first bill."

Citations: [S4][S5][S3].

---

## L6. Appeal to the insurer: EOB mismatch or wrong denial

Merge fields: common + `{{eob_date}}`, `{{issue}}` ∈ {balance_exceeds_eob, provider_liability_billed, not_processed_in_network, wrong_member_info, other}, `{{issue_details}}`, `{{requested_action}}`.

> {{today}}
>
> {{insurer_name}} — Appeals / Grievances
>
> **Re: Request for review — member {{patient_name}}, ID {{member_id}}, group {{group_number}}, claim {{claim_number}}, provider {{provider_name}}, date of service {{dates_of_service}}**
>
> Hello,
>
> I am asking you to review how this claim was processed (Explanation of Benefits dated {{eob_date}}). {{issue_details}}
>
> I am asking you to: {{requested_action}}
> (For example: reprocess the claim as in-network; correct my member information; confirm in writing that the amount marked "provider responsibility" is not owed by me; or treat this as a formal internal appeal.)
>
> Please also send me a copy of the claim and the records you used to decide it. Health plans' payment and claims records are part of my designated record set under HIPAA (45 CFR 164.501, 164.524).
>
> Thank you,
> {{patient_name}} · {{phone}}

Guidance shown:
- Find the appeal deadline on your EOB or denial letter.
- Your state Consumer Assistance Program can help: https://www.cms.gov/cciio/resources/consumer-assistance-grants [S30].

Citations: [S15][S16]; NSA [S6][S7] when relevant.

---

## L7. HIPAA right-of-access request for medical and billing records

Merge fields: common + `{{records_list}}` (default below), `{{format}}` (e.g. "PDF by secure email" / "paper copy by mail"), `{{deliver_to}}`.

> {{today}}
>
> {{provider_name}} — Health Information Management / Privacy Officer
>
> **Re: Request for access to my records — {{patient_name}}, DOB {{patient_dob}}, dates of service {{dates_of_service}}**
>
> Hello,
>
> Under the HIPAA right of access (45 CFR 164.524), I request copies of the following records from my designated record set, which includes medical and billing records (45 CFR 164.501):
>
> {{records_list}}
> *(default: the itemized bill with codes, units and NDCs; the claim forms sent to insurers; the payment and adjustment history; the medication administration record; the operative and anesthesia records with start and stop times; the emergency department record; the admission, discharge and transfer times.)*
>
> Please provide them as {{format}}, to {{deliver_to}}. You must act on this request within 30 days (45 CFR 164.524). Any fee must be a reasonable, cost-based fee limited to the cost of labor for copying, supplies and postage (45 CFR 164.524(c)(4)). Please tell me in advance if there will be a fee.
>
> Thank you,
> {{patient_name}} · {{phone}}

Citations: [S15][S16].

---

**Optional v1.1 letter, L8: credit-report dispute for medical debt.** It goes to the bureau and cites the 2023-04-11 joint bureau policy (paid, under $500, under 1 year) and the state ban row, with the preemption caveat, from RESEARCH §b5. It's deferred because state-ban enforceability is in litigation (Colorado, *ACA International v. Fulford*).
