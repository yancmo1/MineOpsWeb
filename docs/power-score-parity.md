# Power-score parity characterization

**Date:** 2026-08-04
**Source:** `SuperManagerPowerScoreSettings.asset` from the lossless `5.59.0_96449_20260716T143539Z.lossless-v2` catalog (`power-score-domain.json`), plus `frontend/src/lib/power-score.ts`.

## Goal

Characterize how the game's own Super Manager power score relates to MineOps's current heuristic `strengthScore()` so Phase-3 ranking can move toward game parity without inventing semantics.

## Current MineOps heuristic (`strengthScore` in `frontend/src/lib/db.ts`)

```
strengthScore = log10(effectiveActiveValue) * 100
              + level * 1.5
              + rank * 20
              + promoted * 10
              + rarityWeight(rarity)   # legendary 25 / epic 18 / rare 12 / common 6
```

This is a transparent, explainable approximation ported from the iOS reference. Its terms are documented in `strengthScoreBreakdown()` in `frontend/src/lib/power-score.ts`, which splits the score into `activeTerm / levelTerm / rankTerm / promotionTerm / rarityTerm` and uses exact active-level rows when available.

## APK power-score settings evidence

The single `supermanagerpowerscore` record is a `MonoBehaviour` whose custom fields UnityPy does not decode (no embedded type tree). The structural decode that IS certain:

- Standard Unity header: `m_Enabled = 1`, `m_Name = "SuperManagerPowerScoreSettings"`.
- **26 custom int32 fields**, every one a clean multiple of 2¹⁶ → **Q16.16 fixed-point** interpretation: `[0, 1, 0, 1, 4, 1, 1, 10, 2, 2, 40, 3, 4, 150, 4, 6, 400, 1, 2, 16, 8, 2, 2, 5, 5, 2]`.
- Field **names are unverified** (no game class definition). Naming them now would be fabrication, so `power-score-domain.json` and `power-score.ts` keep them opaque with `fieldNamesUnverified: true`.

The audit's expected inputs are "level, rank, promotion, rarity, and locked-preview inputs"; the raw evidence is preserved byte-for-byte (`rawSha256` bound in the control plane).

## Parity fixtures

`buildPowerScoreParityRows()` produces a comparison matrix over unlocked managers (rarity × level × rank × promotion): each row has the heuristic `strengthScore` and a `gamePowerScore: null` slot that Phase 4 fills once the cross-check names the Q16 fields. Rows for locked managers are skipped; rows for the duplicate/legacy variant twins are excluded via the variant classification (see `manager-variants.ts`).

## Cross-check plan (Phase 4)

1. Fetch the reference site's curated SM active/passive tables (reference-only, never a runtime dependency).
2. Reverse the Q16 field layout against known-good game power values for representative managers (Lee Vatori level 30 / rank 4 / P2, Turner level 30 / P3 MIF) to name the fields.
3. Only then wire a game-parity power score into ranking, with the settings evidence cited per manager.

Until then, MineOps ranking uses the documented heuristic and never claims game-parity numbers.
