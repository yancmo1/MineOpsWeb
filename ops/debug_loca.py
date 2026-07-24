import UnityPy, struct

env = UnityPy.load("/home/yancmo/mineops-data/releases/5.59.0_96449_20260716T143539Z/extracted/base.apk/assets/Addressables/Android/configfiles_assets_all_42ed63002177b06e8d48293f4b7887aa_Android.bundle")
sf = env.assets[0]

for k, pptr in env.container.items():
    if "EffectLocaConfig" in k:
        robj = sf.objects.get(pptr.path_id)
        raw = robj.get_raw_data()
        print("Total:", len(raw))
        o = 28
        slen = struct.unpack("<i", raw[o:o+4])[0]; o += 4
        name = raw[o:o+slen].decode(); o += slen + 1
        print("Name:", repr(name))
        print("After name: offset=%d, bytes=%s" % (o, raw[o:o+40].hex()))
        for i in range(0, min(40, len(raw)-o), 4):
            val = struct.unpack("<I", raw[o+i:o+i+4])[0]
            print("  offset %d: int=%d (0x%x)" % (o+i, val, val))
        break
