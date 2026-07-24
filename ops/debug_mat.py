import UnityPy, struct
env = UnityPy.load("/home/yancmo/mineops-data/releases/5.59.0_96449_20260716T143539Z/extracted/base.apk/assets/Addressables/Android/configfiles_assets_all_42ed63002177b06e8d48293f4b7887aa_Android.bundle")
sf = env.assets[0]
for k, pptr in env.container.items():
    if "EquipmentMaterialConfig.asset" in k:
        raw = sf.objects.get(pptr.path_id).get_raw_data()
        o = 28
        slen = struct.unpack("<i", raw[o:o+4])[0]; o += 4
        name = raw[o:o+slen].decode(); o += slen
        while raw[o] == 0: o += 1
        slen = struct.unpack("<i", raw[o:o+4])[0]; o += 4
        s = raw[o:o+slen].decode(); o += slen
        while raw[o] == 0: o += 1
        slen = struct.unpack("<i", raw[o:o+4])[0]; o += 4
        s2 = raw[o:o+slen].decode(); o += slen
        while raw[o] == 0: o += 1
        print("classpath(%d) assetpath(%d) o=%d" % (len(s), len(s2), o))
        for i in range(10):
            val = struct.unpack("<i", raw[o+i*4:o+i*4+4])[0]
            print("  int %d: %d (0x%x)" % (i, val, val))
        break
