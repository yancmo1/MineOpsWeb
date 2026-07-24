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
        print("count=%d o=%d" % (count, o))
        for m in range(count):
            print("material %d at o=%d:" % (m, o))
            mid = struct.unpack("<i", raw[o:o+4])[0]; o += 4
            typ = struct.unpack("<i", raw[o:o+4])[0]; o += 4
            slen = struct.unpack("<i", raw[o:o+4])[0]; o += 4
            txt = raw[o:o+slen].decode(); o += slen
            while raw[o] == 0: o += 1
            print("  id=%d type=%d name=%s" % (mid, typ, txt))
            if o < len(raw) - 4:
                slen2 = struct.unpack("<i", raw[o:o+4])[0]
                if 1 <= slen2 <= 100:
                    o += 4
                    tt = raw[o:o+slen2].decode(); o += slen2
                    while raw[o] == 0: o += 1
                    print("  tooltip=%s" % tt)
                else:
                    print("  no tooltip (next int=%d)" % slen2)
        break
