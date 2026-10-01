# Finecomb corpus v1 scoreboard (engine 9492552, 2026-10-01)

300 bills, 90 clean. Synthetic bills; real-world accuracy may be lower.

| Rule | Labels | TP | FP | FN | Precision | Recall | F1 | FP/clean bill | Ship as |
|---|---|---|---|---|---|---|---|---|---|
| DUP-01 | 27 | 27 | 16 | 0 | 0.63 | 1.00 | 0.77 | 0.04 | low |
| DUP-02 | 26 | 26 | 45 | 0 | 0.37 | 1.00 | 0.54 | 0.13 | off |
| MATH-01 | 23 | 23 | 33 | 0 | 0.41 | 1.00 | 0.58 | 0.10 | off |
| MATH-02 | 22 | 22 | 0 | 0 | 1.00 | 1.00 | 1.00 | 0.00 | as-specified |
| MUE-01 | 32 | 32 | 17 | 0 | 0.65 | 1.00 | 0.79 | 0.11 | low |
| QTY-01 | 13 | 13 | 24 | 0 | 0.35 | 1.00 | 0.52 | 0.17 | off |
| RB-01 | 9 | 9 | 35 | 0 | 0.20 | 1.00 | 0.34 | 0.20 | off |
| DATE-01 | 9 | 9 | 0 | 0 | 1.00 | 1.00 | 1.00 | 0.00 | as-specified |
| NCCI-01 | 26 | 26 | 32 | 0 | 0.45 | 1.00 | 0.62 | 0.06 | off |
| CANC-01 | 21 | 21 | 16 | 0 | 0.57 | 1.00 | 0.72 | 0.07 | off |
| RX-01 | 13 | 13 | 0 | 0 | 1.00 | 1.00 | 1.00 | 0.00 | as-specified |
| EOB-01 | 86 | 86 | 0 | 0 | 1.00 | 1.00 | 1.00 | 0.00 | as-specified |
| EOB-02 | 29 | 21 | 0 | 8 | 1.00 | 0.72 | 0.84 | 0.00 | as-specified |
| INS-01 | 20 | 20 | 29 | 0 | 0.41 | 1.00 | 0.58 | 0.13 | off |
| MCD-01 | 20 | 20 | 0 | 0 | 1.00 | 1.00 | 1.00 | 0.00 | as-specified |
| NSA-01 | 19 | 19 | 0 | 0 | 1.00 | 1.00 | 1.00 | 0.00 | as-specified |
| NSA-02 | 16 | 16 | 0 | 0 | 1.00 | 1.00 | 1.00 | 0.00 | as-specified |
| GFE-01 | 20 | 20 | 0 | 0 | 1.00 | 1.00 | 1.00 | 0.00 | as-specified |
| ECA-01 | 13 | 10 | 25 | 3 | 0.29 | 0.77 | 0.42 | 0.14 | off |
| PPDR-01 | 21 | 21 | 0 | 0 | 1.00 | 1.00 | 1.00 | 0.00 | as-specified |
| CR-01 | 23 | 23 | 0 | 0 | 1.00 | 1.00 | 1.00 | 0.00 | as-specified |
| **All** | 488 | 477 | 272 | 11 | 0.64 | 0.98 | 0.77 | 1.16 | |

## Confusion (worst first)

### DUP-01: P 0.63 / R 1.00
- FP causes: hn:credit-reversal ×16, variant:credit:negqty ×16, hn:cancel-reversed ×8, variant:cancel-credit:negqty ×7
    - fc-v1-001 (inpatient/stay) lines L08,L10: 2 identical charges on 2026-04-02 | These 2 lines have the same date, item, quantity and price.
    - fc-v1-011 (inpatient/stay) lines L05,L09: 2 identical charges on 2026-01-14 | These 2 lines have the same date, item, quantity and price.
- Miss causes: none


### DUP-02: P 0.37 / R 1.00
- FP causes: hn:credit-reversal ×25, hn:jw-waste ×14, variant:credit:negqty ×13, variant:credit:posqty ×12
    - fc-v1-001 (inpatient/stay) lines L08,L10,L11: Same code, different price or description on 2026-04-02 | The same billing code appears twice on the same date with different amounts or descriptions.
    - fc-v1-006 (inpatient/stay) lines L14,L21,L22: Same code, different price or description on 2026-04-30 | The same billing code appears twice on the same date with different amounts or descriptions.
- Miss causes: none


### MATH-01: P 0.41 / R 1.00
- FP causes: hn:credit-reversal ×23, variant:credit:posqty ×22, hn:cancel-reversed ×18, variant:cancel-credit:posqty ×15
    - fc-v1-004 (inpatient/stay) lines L29: Quantity × price doesn't match the line total | 1 × $60.84 = $60.84, but the line charges $-60.84.
    - fc-v1-006 (inpatient/stay) lines L22: Quantity × price doesn't match the line total | 1 × $81.68 = $81.68, but the line charges $-81.68.
- Miss causes: none


### MUE-01: P 0.65 / R 1.00
- FP causes: hn:mue-setting ×13, hn:nsa-compliant ×6, hn:credit-reversal ×4, variant:credit:posqty ×4
    - fc-v1-106 (ed/ed) lines L07: 85025: more units billed than Medicare's usual daily maximum | 2 units of 85025 were billed on 2026-03-21; Medicare's Medically Unlikely Edit for this code and 
    - fc-v1-114 (ed/ed) lines L06: 85025: more units billed than Medicare's usual daily maximum | 2 units of 85025 were billed on 2026-08-02; Medicare's Medically Unlikely Edit for this code and 
- Miss causes: none


### QTY-01: P 0.35 / R 1.00
- FP causes: hn:kit-multi ×10, hn:hourly-overlap ×10, hn:per-day-multi ×8, variant:iv-kit-x2 ×6
    - fc-v1-014 (inpatient/stay) lines L14,L15: A per-stay kit was billed more than once | 2 units of a per-stay kit item were billed.
    - fc-v1-021 (inpatient/stay) lines L16,L17: A per-day item is billed more times than your stay lasted | 8 units were billed, but your stay was 4 day(s).
- Miss causes: none


### RB-01: P 0.20 / R 1.00
- FP causes: hn:obs-room-hours ×13, hn:per-day-multi ×8, hn:telemetry-monitor ×7, hn:hourly-overlap ×7
    - fc-v1-015 (inpatient/stay) lines L02,L03,L04,L05,L21: More room days billed than nights stayed | 10 room-and-board units were billed for a 4-night stay (2026-05-21 to 2026-05-25).
    - fc-v1-019 (inpatient/stay) lines L01,L02,L03,L04,L05: More room days billed than nights stayed | 5 room-and-board units were billed for a 4-night stay (2026-07-07 to 2026-07-11).
- Miss causes: none


### NCCI-01: P 0.45 / R 1.00
- FP causes: hn:ncci-mod25 ×32, hn:bilateral ×20, variant:bilateral-same-price ×16, variant:bilateral-discounted ×4
    - fc-v1-201 (professional/proc) lines L02,L01: 99214 is normally bundled into 20610 | 20610 and 99214 were billed on the same date (2025-03-21) and have an active NCCI edit.
    - fc-v1-201 (professional/proc) lines L03,L01: 99214 is normally bundled into 20610 | 20610 and 99214 were billed on the same date (2025-03-21) and have an active NCCI edit.
- Miss causes: none


### CANC-01: P 0.57 / R 1.00
- FP causes: hn:cancel-reversed ×16, variant:cancel-credit:negqty ×16, hn:credit-reversal ×10, variant:credit:negqty ×7
    - fc-v1-050 (inpatient/stay) lines L21: Description mentions a cancellation | "MED RETURNED TO PHARMACY" suggests this may have been canceled, not given, or returned.
    - fc-v1-058 (inpatient/stay) lines L35: Description mentions a cancellation | "MED RETURNED TO PHARMACY" suggests this may have been canceled, not given, or returned.
- Miss causes: none


### EOB-02: P 1.00 / R 0.72
- FP causes: none

- Miss causes: plant:EOB-02:co-billed ×5, collateral (label not planted for EOB-02) ×3
    - fc-v1-057 (inpatient/stay) lines -: engine ran, no matching finding
    - fc-v1-085 (inpatient/stay) lines -: engine ran, no matching finding

### INS-01: P 0.41 / R 1.00
- FP causes: variant:medicaid-no-eob ×16, hn:ins-paid-no-eob ×13, hn:same-day-admit-discharge ×5, hn:eca-proper ×4
    - fc-v1-001 (inpatient/stay) lines -: This may not have been billed to insurance | You have insurance, but there is no insurance payment or adjustment on this bill, and no EOB was entered.
    - fc-v1-016 (inpatient/stay) lines -: This may not have been billed to insurance | You have insurance, but there is no insurance payment or adjustment on this bill, and no EOB was entered.
- Miss causes: none


### ECA-01: P 0.29 / R 0.77
- FP causes: hn:eca-agency-referral ×13, hn:eca-late-fee ×12, hn:ins-paid-no-eob ×4, hn:eob-under-1 ×4
    - fc-v1-011 (inpatient/stay) lines -: Possible early or improper collection action by a nonprofit hospital | a late fee action on 2026-04-23, before the 120-day waiting period ended (2026-06-01)
    - fc-v1-014 (inpatient/stay) lines -: Possible early or improper collection action by a nonprofit hospital | a collections action on 2025-11-27, before the 120-day waiting period ended (2025-12-28)
- Miss causes: plant:ECA-01:short-notice ×3
    - fc-v1-026 (inpatient/stay) lines -: engine ran, no matching finding
    - fc-v1-059 (inpatient/stay) lines -: engine ran, no matching finding
