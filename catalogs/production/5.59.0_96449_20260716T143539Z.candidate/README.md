# Production Candidate Package

Release ID:    5.59.0_96449_20260716T143539Z
Game Version:  5.59.0
Generated:     2026-07-18T12:54:41.630Z
Manager Count: 118
Status:        candidate
Source:        APK extraction (Unity AssetBundle TextAsset configs)
Generator:     mineops-data-engine catalog-v2 + produce-candidate-package.mjs

## Contents

- `manifest.json` — Package manifest with SHA-256 hashes
- `catalog-core.json` — 118 manager records (118 fully extracted, 0 partial)
- `mappings.json` — 354 id mappings (118 kolibri_id, 236 apk_superManagerId) + 118 name key aliases
- `validation-report.json` — Validation checks
- `localization.json` — Display name entries (118 total, names require MonoBehaviour parsing)
- `relationships.json` — Entity relationships
- `assets.json` — Asset references
- `changelog.json` — Change tracking

## Known Limitations

1. Display names are null (stored in MonoBehaviours, not TextAssets)
2. Only 9 SuperManagerElementalConfig files found (10074-10082)
3. Kolibri_id mappings use superManagerId values directly (unverified against real Kolibri response)
4. 6 managers have partially unresolved fields (10020-10025 missing some assets)
