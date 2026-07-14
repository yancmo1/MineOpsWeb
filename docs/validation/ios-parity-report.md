# iOS parity report

| iOS workflow | Web status | Notes |
| --- | --- | --- |
| Kolibri-authoritative manager progress | In progress | Web data shape and revisioned sync vertical slice exist; authenticated Kolibri import remains. |
| Managers list/filter/sort/detail | Planned | Needs master-catalog presentation and parity tests. |
| Today dashboard: coverage, strongest by area, upgrade opportunities | Planned | The calculation rules have been inventoried from `SMProgressService`. |
| Strategy context and AI advice | Planned | Retain mine type, mine number, continent mine, and manager inputs; never embed provider secrets in the PWA. |
| Strict Super Manager tracker JSON export | Planned | Format and canonical-key requirements captured in migration documentation. |
| Catalog/master data caching | In progress | Staged snapshot ingestion exists; field-level validation and activation history remain. |

## Calculation inventory

- Strength: `log10(max(active value, 1)) * 100 + level * 1.5 + rank * 20 + promotion * 10 + rarity weight` (legendary 25, epic 18, rare 12, common 6).
- Known rank-up fragment thresholds: rank 0 → 15, rank 1 → 30, rank 2 → 50, rank 3 → 80; higher ranks intentionally report unknown rather than infer.
- Active-value fallback: linearly interpolate active level 1 to level 100 when a catalog scaling table is missing.
- Department values: mineshaft, elevator, warehouse. Catalog rank requirements gate elements; promotion requirements gate passives.

Parity is not complete until these rules have fixture-backed TypeScript tests against iOS-derived fixtures.
