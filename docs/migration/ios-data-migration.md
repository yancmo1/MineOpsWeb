# iOS data migration

## Confirmed source inventory

The current iOS application is `../mineops-companion`. Its active V2 workflow is Kolibri-authoritative Super Manager progress over master data from `idle-miners.com`. The manager record fields that must migrate are canonical manager ID/key, unlock state, level (minimum 1), rank (minimum 0), promotion (minimum 0), and fragments (minimum 0). The current app matches synced managers by numeric game ID, uses stable master IDs for UI/export, and persists the merged list as JSON in `UserDefaults`.

The iOS strict tracker export is a JSON object keyed by 108 canonical hyphenated manager IDs. Every value is `{ unlocked, rank, level, promoted, fragments, chronoExcluded, tierlistExcluded }`; missing managers have deterministic defaults. Known export-key mismatch risk: source directory IDs use underscores and the `rabbid-blingsley` spelling appears in the strict exporter, while fixture naming also documents a `rabbit-blingsley` expectation. Preserve the original file and report this ambiguity rather than silently remapping it.

## Migration behavior

The migration tool will accept this JSON object, validate every key and numeric range, dry-run by default, map underscore/hyphen aliases explicitly, then create `player_managers` records through the same revision-aware service used by sync. It must create a detailed additions/updates/skips/conflicts report and an exportable pre-import backup.
