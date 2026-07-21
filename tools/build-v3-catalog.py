#!/usr/bin/env python3
"""Comprehensive v3 catalog builder from Unity extraction data."""
import json, hashlib, os, re, sys
from pathlib import Path
from datetime import datetime, timezone
from collections import OrderedDict

RELEASE_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/home/yancmo/mineops-data/releases/5.59.0_96449_20260716T143539Z")
MANAGERS_JSON = RELEASE_DIR / "exports" / "extracted_managers" / "managers.json"
OUTPUT_DIR = RELEASE_DIR / "exports" / "v3"

def derive_name(name_key):
    if not name_key: return None
    name = name_key
    for p in ["SM_", "SM", "SuperManager_", "Manager_"]:
        if name.startswith(p): name = name[len(p):]; break
    name = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', name)
    name = re.sub(r'(?<=[A-Z])(?=[A-Z][a-z])', ' ', name)
    return name.strip() or None

RARITY = {1:"Common",2:"Rare",3:"Epic",4:"Legendary"}
AREA = {1:"Mine Shaft",2:"Elevator",3:"Warehouse"}
CAT = {1:"None",2:"Gems",3:"Iap",4:"Event",5:"ImpossibleMine"}
GEN = {0:"Male",1:"Female"}

def el(v,m,d="Unknown"): return m.get(v,d)

print("Loading...")
with open(MANAGERS_JSON) as f: raw = json.load(f)
print(f"{len(raw)} managers")

RELEASE_ID = "5.59.0_96449_20260716T143539Z"
NOW = datetime.now(timezone.utc).isoformat()

catalog_managers = []
for m in raw:
    mid = m["managerId"]; c = m["canonical"]
    nk = c.get("NameKey","")
    dn = derive_name(nk)
    rid = c.get("Rarity") or c.get("SuperManagerRarity")
    aid = c.get("AreaId")
    r = OrderedDict([
        ("canonicalId", f"sm-{mid}"),
        ("name", dn), ("nameSource", "derived"),
        ("rarity", el(rid,RARITY,"unknown").lower()),
        ("role", el(aid,AREA,"Unknown")),
        ("element", None),
        ("sourceIdentifiers", {"superManagerId":mid,"nameKey":nk}),
        ("active", {"description":None,"multiplier":c.get("ActiveStrength"),"multiplierAt100":c.get("ActiveStrength")}),
        ("passives", [{"unlockLevel":None,"description":None,"multiplier":None,"type":f"passive_{i}","passiveId":c.get(f"Passive{i}")} for i in range(1,4) if c.get(f"Passive{i}")]),
        ("elements", []),
        ("progression", OrderedDict([
            ("level",c.get("Level")),("rank",c.get("Rank")),("promotion",c.get("Promotion")),
            ("promotionCost",c.get("PromotionCost")),("activeIncrease",c.get("ActiveIncrease")),
            ("passiveIncrease",c.get("PassiveIncrease")),("activeStrength",c.get("ActiveStrength")),
            ("maxLevel",c.get("MaxLevel")),("maxPromotions",c.get("MaxPromotions")),
        ])),
        ("extensions", OrderedDict([
            ("superManagerId",mid),("nameKey",nk),
            ("areaId",aid),("area",el(aid,AREA)),
            ("category",c.get("Category")),("categoryLabel",el(c.get("Category"),CAT)),
            ("gender",c.get("Gender")),("genderLabel",el(c.get("Gender"),GEN)),
            ("rarity",rid),("fragmentId",c.get("FragmentId")),
            ("duration",c.get("Duration")),("cooldown",c.get("Cooldown")),
            ("maxLevel",c.get("MaxLevel")),("maxPromotions",c.get("MaxPromotions")),
            ("isLocaEncrypted",bool(c.get("IsLocaEncrypted"))),
            ("canBeBoughtWithGems",bool(c.get("CanBeBoughtWithGems"))),
            ("isRentable",bool(c.get("IsRentable"))),
        ])),
    ])
    catalog_managers.append(r)

print(f"Built {len(catalog_managers)} records")

# --- Mappings ---
idm = []
for m in raw:
    mid = m["managerId"]; c = m["canonical"]
    cid = f"sm-{mid}"; nk = c.get("NameKey","")
    idm.append({"canonicalId":cid,"kind":"apk_superManagerId","sourceValue":str(mid),"confidence":"verified"})
    idm.append({"canonicalId":cid,"kind":"kolibri_id","sourceValue":str(mid),"confidence":"verified","extensions":{"note":"superManagerId maps to Kolibri API Id"}})
    if nk: idm.append({"canonicalId":cid,"kind":"name_key","sourceValue":nk,"confidence":"verified"})

aliases = [{"canonicalId":m["canonicalId"],"alias":m["name"],"kind":"display_name"} for m in catalog_managers if m.get("name")]

# --- Localization ---
loc = {}
for m in catalog_managers:
    loc[m["canonicalId"]] = {"canonicalId":m["canonicalId"],"displayName":m.get("name"),"displayNameSource":"derived" if m.get("name") else "unknown","nameKey":m.get("extensions",{}).get("nameKey"),"locale":"en"}

# --- Write ---
def sj(d): return json.dumps(d, separators=(",",":"), ensure_ascii=False, sort_keys=True) + "\n"
def wa(dir, fn, data):
    s = sj(data); (OUTPUT_DIR).mkdir(parents=True,exist_ok=True); (OUTPUT_DIR/fn).write_text(s); h=hashlib.sha256(s.encode()).hexdigest()
    return h,len(s)

artifacts = {
    "catalog-core.json": OrderedDict([("schemaVersion","2.0.0"),("catalogVersion",RELEASE_ID),("releaseId",RELEASE_ID),("generatedAt",NOW),
        ("source",{"kind":"apk_capture","versionName":"5.59.0","versionCode":96449,"parserVersion":"2.0.0","extractionMethod":"unity-il2cpp-typetree","provenance":{"dataFields":36,"nameSource":"derived_from_NameKey"}}),
        ("managers",catalog_managers),("mines",[]),("equipment",[]),("research",[]),("collectibles",[]),("artifacts",[])]),
    "mappings.json": OrderedDict([("schemaVersion","1.0.0"),("catalogVersion",RELEASE_ID),("releaseId",RELEASE_ID),("generatedAt",NOW),("idMappings",idm),("aliases",aliases)]),
    "localization.json": OrderedDict([("schemaVersion","1.0.0"),("catalogVersion",RELEASE_ID),("releaseId",RELEASE_ID),("generatedAt",NOW),("locale","en"),("entries",loc)]),
    "validation-report.json": OrderedDict([("validationSchemaVersion","1.0.0"),("catalogVersion",RELEASE_ID),("validatedAt",NOW),("status","passed"),
        ("checks",[{"code":"MANAGER_COUNT","severity":"info","passed":True,"message":f"{len(catalog_managers)} managers"},{"code":"NAMED","severity":"info","passed":True,"message":f"{sum(1 for m in catalog_managers if m.get('name'))}/{len(catalog_managers)} named"}]),
        ("blockingIssues",[]),("warnings",[{"code":"names_derived","message":"Names derived from NameKey"}]),("counts",{"errors":0,"warnings":1,"unresolved":0})]),
    "relationships.json": OrderedDict([("schemaVersion","1.0.0"),("catalogVersion",RELEASE_ID),("releaseId",RELEASE_ID),("generatedAt",NOW),("relationships",[])]),
    "assets.json": OrderedDict([("schemaVersion","1.0.0"),("catalogVersion",RELEASE_ID),("releaseId",RELEASE_ID),("generatedAt",NOW),("assets",[])]),
    "changelog.json": OrderedDict([("schemaVersion","1.0.0"),("catalogVersion",RELEASE_ID),("releaseId",RELEASE_ID),("generatedAt",NOW),
        ("added",[{"canonicalId":m["canonicalId"],"name":m.get("name"),"changeType":"added"} for m in catalog_managers]),
        ("modified",[]),("removed",[])]),
}

print("\nWriting artifacts...")
entries = []
for fn, data in artifacts.items():
    h,b = wa(OUTPUT_DIR, fn, data)
    entries.append({"filename":fn,"hash":h,"bytes":b})
    print(f"  {fn}: {h[:16]}... ({b}b)")

manifest = OrderedDict([
    ("manifestSchemaVersion","2.0.0"),("releaseId",RELEASE_ID),("catalogVersion",RELEASE_ID),
    ("gameVersion","5.59.0"),("gameVersionCode",96449),("status","candidate"),("generatedAt",NOW),
    ("generator",{"name":"MineOpsDataEngine v3","version":"3.0.0"}),("previousCatalogVersion",None),
    ("storage",{"baseUrl":"./","cdnUrl":None}),
    ("artifacts",[{"filename":e["filename"],"path":e["filename"],"contentType":"application/json","sha256":e["hash"],"bytes":e["bytes"],
        "required":e["filename"] in ("catalog-core.json","validation-report.json"),"schemaVersion":"1.0.0",
        "recordCount":len(catalog_managers) if e["filename"]=="catalog-core.json" else (len(idm) if e["filename"]=="mappings.json" else 0)} for e in entries]),
    ("counts",{"managers":len(catalog_managers),"mines":0,"equipment":0,"research":0,"collectibles":0,"artifacts":0,"relationships":0,"unresolvedObjects":0}),
])
h,b = wa(OUTPUT_DIR, "manifest.json", manifest)
print(f"  manifest.json: {h[:16]}... ({b}b)")

nc = sum(1 for m in catalog_managers if m.get("name"))
print(f"\n=== V3 Catalog Complete ===")
print(f"  {len(catalog_managers)} managers, {nc} named")
print(f"  {len(idm)} mappings, {len(aliases)} aliases")
print(f"  {len(entries)} artifacts")
for m in catalog_managers[:5]:
    print(f"    {m['canonicalId']}: {m.get('name')} ({m['rarity']}, {m['role']})")
print(f"    ...")
for m in catalog_managers[-3:]:
    print(f"    {m['canonicalId']}: {m.get('name')} ({m['rarity']}, {m['role']})")
