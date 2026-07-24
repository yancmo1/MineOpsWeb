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
        count = struct.unpack("<i", raw[o:o+4])[0]; o += 4
        start_o = o
        for m in range(15):
            mid = struct.unpack("<i", raw[o:o+4])[0]; o += 4
            typ = struct.unpack("<i", raw[o:o+4])[0]; o += 4
            s1 = o
            while raw[o] != 0: o += 1
            ntxt = raw[s1:o].decode(); o += 1
            while raw[o] == 0: o += 1
            ttlen = struct.unpack("<i", raw[o:o+4])[0]; o += 4
            tt = raw[o:o+ttlen].decode(); o += ttlen
            null_count = 0
            while raw[o] == 0:
                null_count += 1
                o += 1
            print("entry %d: offset=%d id=%d name=%s tooltip_len=%d tooltip=%s nulls_after=%d" % (m, start_o + (o - start_o) - ttlen - 4 - null_count, mid, ntxt, ttlen, tt, null_count))
        break
