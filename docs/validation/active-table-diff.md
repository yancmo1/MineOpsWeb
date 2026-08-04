# Active-table validation diff (APK vs idle-miners.com)

**Date:** 2026-08-04
**Tool:** `tools/validate-active-tables.py` (reference data + report under `tools/data/`)
**Status:** Validation evidence only — idle-miners.com is a cross-check, never a runtime dependency and never overrides APK data.

## Result

| Metric | Value |
|---|---|
| APK managers (lossless-v2 `manager-domain.json`) | 118 |
| Matched to the curated reference (by game id) | 112 |
| Level rows compared (levels 1 and 100) | 112 |
| **Exact match** | **105** |
| Within 1% | 0 |
| Systematic drift (exactly ×100) | 7 |
| Unmatched (not present in the reference) | 6 |

Full rows: `tools/data/active-table-validation-report.json`.

## Interpretation

1. **The APK exact active tables are consistent with the community reference.** 105/112 matched managers agree at both level 1 and level 100 to full precision — strong evidence the lossless extraction is correct.

2. **The 7 drifts are a display convention, not an extraction bug.** Every drift row has ratio exactly 0.01 (curated value = APK value × 100) and is an **income-passive manager** (Goodman family 10002/10009/10012, Belle Snowdrop, Lei Na, Drethos, Remedy Rose). The curated site displays income-type actives scaled ×100; the APK raw `ActiveStrength` (e.g. Mr. Goodman 0.885) is the game's base value. MineOps uses the raw APK value.

3. **The 6 unmatched APK managers are exactly the duplicate/legacy variant twins** from the Phase-2 classification (10020, 10021, 10022, 10023, 10027, 10028). They are not separate managers in the community database — independent confirmation that variants must never score as independent roster candidates.

## Follow-up

If a future APK release changes active tables, re-run `python3 tools/validate-active-tables.py <path-to-manager-domain.json>`; the report records the baseline so regressions are visible.
