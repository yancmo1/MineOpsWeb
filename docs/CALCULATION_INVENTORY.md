# Calculation inventory

| Rule | iOS source | Inputs | Output / edge cases | Web location | Characterization requirement |
|---|---|---|---|---|---|
| Effective active value | `V2/Models/SMModels.swift:SMProgress.effectiveActiveValue` | Level, rank, scaling table, active L1/L100 | Table lookup; linear fallback when missing/out of range | `packages/calculations/src/managerScore.ts` | Fixture for table and fallback |
| Strength score | `V2/Services/SMProgressService.swift:strengthScore` | Effective active, level, rank, promotion, rarity | `log10(max(active,1))*100 + level*1.5 + rank*20 + promoted*10 + rarity weight` | `packages/calculations/src/managerScore.ts` | Exact numeric fixtures |
| Rarity weights | `SMProgressService.swift` | Rarity | Legendary 25, Epic 18, Rare 12, Common 6, otherwise 0 | `managerScore.ts` | Table test |
| Strongest by area | `SMProgressService.swift` | Unlocked managers and strength score | Descending score, case-insensitive name tie-break | `recommendations.ts` | Tie-break fixture |
| Upgrade opportunities | `SMProgressService.swift` | Unlocked managers, fragments, score | Fragments desc, score desc, name tie-break; positive fragments only | `recommendations.ts` | Ordering fixture |
| Rank readiness | `SMProgressService.swift:knownFragmentThreshold` | Rank, fragments | thresholds R0=15, R1=30, R2=50, R3=80; unknown false | `upgradeReadiness.ts` | Threshold edge tests |
| Manager query | `ManagerListQuery.swift` | Search, area, ownership, rarity, readiness, sort | Deterministic filtering and sorting | `managerQuery.ts` | Component + unit tests |
| Strategy plan | `Strategy/StrategyEngine.swift` | Owned roster and levels | Rules-first lineup and burst steps; no fabricated managers | `strategy.ts` | Sanitized roster fixtures |
