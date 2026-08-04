#!/usr/bin/env python3
"""One-time validation diff: APK-derived active tables vs idle-miners.com.

Cross-checks the published lossless active-level tables (manager-domain.json)
against idle-miners.com's curated `/api/sm-actives` + `/api/sm-data` to catch
extraction bugs. Output is VALIDATION EVIDENCE ONLY — the curated reference is
never a runtime dependency and never overrides the APK data.

Per manager (matched by game id), compares the APK exact active value at
level 1 and level 100 against the curated sm-actives table (promotion 0) and
the sm-data activeL1/activeL100 fields. Rows within 1% are exact; larger
gaps are flagged for investigation (extraction bug vs version drift).
"""
import json
import sys
from pathlib import Path

APK_MANAGER_DOMAIN = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/v2-candidate/manager-domain.json")
REF_DIR = Path(__file__).parent / "data"

def apk_active_by_id():
    doc = json.loads(APK_MANAGER_DOMAIN.read_text())
    rows = {}
    for m in doc.get("managers", []):
        sm_id = m.get("sourceManagerId")
        levels = {}
        for row in (m.get("activeLevels") or []):
            params = row.get("params") or []
            if not params:
                continue
            level = params[0].get("Level")
            strength = params[0].get("ActiveStrength")
            if isinstance(level, int) and isinstance(strength, (int, float)):
                levels[level] = strength
        if sm_id is not None:
            rows[str(sm_id)] = levels
    return rows

def main():
    apk = apk_active_by_id()
    sm_actives = json.loads((REF_DIR / "idleminers-sm-actives.json").read_text())
    sm_data = {str(m["gameId"]): m for m in json.loads((REF_DIR / "idleminers-sm-data.json").read_text())}
    slug_by_game_id = {str(m["gameId"]): m["id"] for m in sm_data.values()}

    matched = 0
    exact = 0
    near = 0
    drift = []
    unmatched = []
    for game_id, apk_levels in apk.items():
        slug = slug_by_game_id.get(game_id)
        curated = sm_actives.get(slug) if slug else None
        if not curated:
            unmatched.append(game_id)
            continue
        matched += 1
        values = curated.get("values") or []
        # sm-actives rows are per level (1..100), columns per promotion.
        def curated_at(level):
            row = values[level - 1] if 0 < level <= len(values) else None
            return row[0] if row else None
        for level in (1, 100):
            apk_val = apk_levels.get(level)
            cur_val = curated_at(level)
            if apk_val is None or cur_val is None:
                continue
            ratio = apk_val / cur_val if cur_val else None
            if ratio is None:
                continue
            if abs(ratio - 1.0) < 1e-9:
                exact += 1
            elif abs(ratio - 1.0) <= 0.01:
                near += 1
            else:
                drift.append({
                    "gameId": game_id,
                    "name": sm_data.get(game_id, {}).get("name"),
                    "level": level,
                    "apk": round(apk_val, 6),
                    "curated": round(cur_val, 6),
                    "ratio": round(ratio, 4),
                })

    report = {
        "apkManagers": len(apk),
        "matched": matched,
        "levelRowsCompared": exact + near + len(drift),
        "exact": exact,
        "within1Percent": near,
        "driftRows": drift,
        "unmatchedApkManagers": unmatched,
        "note": "Validation evidence only. The APK exact tables are authoritative; idle-miners.com is a cross-check, never a runtime dependency.",
    }
    out = REF_DIR / "active-table-validation-report.json"
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(f"APK managers: {len(apk)} | matched: {matched} | compared rows: {report['levelRowsCompared']}")
    print(f"exact: {exact} | within 1%: {near} | drift: {len(drift)}")
    for d in drift[:10]:
        print(f"  DRIFT {d['name']} ({d['gameId']}) L{d['level']}: apk={d['apk']} curated={d['curated']} ratio={d['ratio']}")
    print(f"unmatched APK managers: {len(unmatched)}")
    print(f"report -> {out}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
