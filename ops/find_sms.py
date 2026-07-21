"""Scan all bundles for manager data configs above ID 10082."""
import sys, re
from pathlib import Path
import UnityPy

rel = Path(sys.argv[1])
bundle_dir = rel / "extracted/base.apk/assets/Addressables/Android"

# Check what's in sprite bundle 10083
print("=== supermanager-10083 bundle contents ===")
bp = list(bundle_dir.glob("supermanager-10083_*.bundle"))[0]
env = UnityPy.load(str(bp))
for key, pptr in env.container.items():
    try:
        tn = pptr.type.name
    except:
        continue
    tname = tn
    name = key.split("/")[-1]
    if tname == "MonoBehaviour":
        data = pptr.read()
        if hasattr(data, "Params") and isinstance(data.Params, list):
            entries = []
            for p in data.Params:
                entry = {}
                for attr in dir(p):
                    if attr.startswith("_") or attr in ("assets_file","get_type","object_reader","save","set_object_reader"):
                        continue
                    val = getattr(p, attr)
                    if isinstance(val, (str,int,float,bool,type(None))):
                        entry[attr] = val
                entries.append(entry)
            print("  %s: %d params" % (name, len(entries)))
            if entries:
                print("    First: %s" % str(entries[0])[:300])
    if tname == "TextAsset":
        data = pptr.read()
        txt = getattr(data, "m_Script", "")
        print("  %s: %s (%db)" % (data.m_Name if hasattr(data, "m_Name") else "?", name, len(txt)))

# Scan all bundles for SuperManagers.asset above ID 10082
print("\n=== All SuperManagers.asset across all bundles (IDs > 10082) ===")
found = set()
for bp in sorted(bundle_dir.glob("*.bundle")):
    try:
        env = UnityPy.load(str(bp))
    except:
        continue
    for key in env.container:
        m = re.search(r"/(\d{5})_SuperManagers\.asset$", key)
        if m:
            mid = int(m.group(1))
            if mid > 10082 and mid not in found:
                found.add(mid)
                print("  ID=%d in %s" % (mid, bp.name))

print("\nTotal Manager IDs (10083+): %d" % len(found))
print("IDs: %s" % sorted(found))
