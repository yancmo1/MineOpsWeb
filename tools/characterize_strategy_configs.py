#!/usr/bin/env python3
"""Characterize the 1,698 strategy-configs records from the lossless release.

Groups records by source domain, semantic status, and asset-name pattern, then
classifies each record into a strategy domain based on evidence in its name and
parsed fields. Output is a compact classification report used to decide which
domains can be normalized into semantic artifacts.
"""
import json
import re
import sys
from collections import Counter, defaultdict

# Domain keywords observed in Unity asset names + parsed fields.
DOMAIN_KEYWORDS = [
    ("mine-economy", r"mine|continent|shaft|elevator|warehouse|deep|surface|ice|fire|volcano|beach|amethyst|moon|underwater|mainland|region|prestige|barrier(?!reward)|cost|income|capacity|loading|walking|cooldown"),
    ("research", r"research|tech|node|boost"),
    ("power-score", r"power.?score|powerScore|SuperManagerPowerScore"),
    ("equipment", r"equipment|material|craft|equip"),
    ("frontier-event", r"frontier|event|rush|battle.?pass|barrierreward|rewardtier|fragmentdraw|offer"),
    ("collectible", r"collectible"),
    ("artifact", r"artifact"),
    ("chapter", r"chapter|tutorial|level"),
    ("elemental", r"element|elemental"),
    ("supermanager", r"supermanager|SuperManager|_sm_|_SM_"),
]

def classify(rec: dict) -> str:
    blob = " ".join([
        str(rec.get("name", "")),
        str(rec.get("domain", "")),
        json.dumps(rec.get("fields", {}))[:500],
        json.dumps(rec.get("raw", {}))[:200],
    ]).lower()
    for label, pattern in DOMAIN_KEYWORDS:
        if re.search(pattern, blob, re.IGNORECASE):
            return label
    return "unclassified"

def main(path: str) -> None:
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    recs = data if isinstance(data, list) else data.get("records", data)
    print(f"total records: {len(recs)}\n")

    print("== semanticStatus distribution ==")
    for k, v in Counter(r.get("semanticStatus", "missing") for r in recs).most_common():
        print(f"  {k}: {v}")

    print("\n== source domain distribution ==")
    for k, v in Counter(r.get("domain", "missing") for r in recs).most_common():
        print(f"  {k}: {v}")

    print("\n== asset-name pattern distribution ==")
    name_pat = Counter()
    for r in recs:
        n = r.get("name", "")
        m = re.match(r"^([A-Za-z0-9_]+?)(\d{2,4})?(\.[A-Za-z]+)?$", n)
        key = m.group(1) if m else n[:24]
        name_pat[key] += 1
    for k, v in name_pat.most_common(30):
        print(f"  {k}: {v}")

    print("\n== strategy-domain classification ==")
    classified = defaultdict(lambda: Counter())
    for r in recs:
        d = classify(r)
        classified[d][r.get("semanticStatus", "missing")] += 1
    for label, statuses in sorted(classified.items()):
        print(f"  {label}: {sum(statuses.values())}  {dict(statuses)}")

    print("\n== parsed-field key coverage (top 25 field names across records) ==")
    field_counter = Counter()
    for r in recs:
        for k in (r.get("fields") or {}).keys():
            field_counter[k] += 1
    for k, v in field_counter.most_common(25):
        print(f"  {k}: {v}")

    print("\n== records with semanticStatus != 'partial' (sample) ==")
    n = 0
    for r in recs:
        if r.get("semanticStatus") != "partial":
            print(f"  [{r.get('semanticStatus')}] {r.get('name')} :: {json.dumps(r.get('fields'))[:200]}")
            n += 1
            if n >= 8:
                break

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/sc.json")
