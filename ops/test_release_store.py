from __future__ import annotations

import importlib.util
import hashlib
import json
from pathlib import Path
import tempfile
import unittest


MODULE_PATH = Path(__file__).with_name("release_store.py")
SPEC = importlib.util.spec_from_file_location("mineops_release_store", MODULE_PATH)
assert SPEC and SPEC.loader
release_store = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release_store)


class ReleaseStoreSelectionTests(unittest.TestCase):
    def _write_release(self, root: Path, release_id: str, complete: bool) -> dict[str, str]:
        hashes = {"base.apk": hashlib.sha256(b"apk").hexdigest()}
        release = root / "releases" / release_id
        (release / "apk").mkdir(parents=True)
        (release / "release.json").write_text(
            json.dumps({"versionCode": 96449, "apkHashes": hashes}),
            encoding="utf-8",
        )
        if complete:
            (release / "apk" / "base.apk").write_bytes(b"apk")
            for name in ("APK_PATHS.json", "APK_SET.json", "SHA256SUMS"):
                (release / "apk" / name).write_text("{}\n", encoding="utf-8")
            (release / "manifests").mkdir()
            (release / "manifests" / "package-dumpsys.txt").write_text(
                "versionCode=96449\n",
                encoding="utf-8",
            )
        return hashes

    def test_incomplete_lexically_newer_release_cannot_shadow_complete_capture(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            hashes = self._write_release(root, "5.59.0_96449_20260716T143539Z", complete=True)
            self._write_release(root, "test_enriched_20260716-153648", complete=False)

            match = release_store.find_matching_release(root, 96449, hashes)

            self.assertEqual(match, "5.59.0_96449_20260716T143539Z")

    def test_metadata_only_release_is_not_complete(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self._write_release(root, "test_release", complete=False)

            self.assertFalse(release_store.is_complete_release(root, "test_release"))

    def test_nonempty_apk_with_stale_recorded_hash_is_not_complete(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self._write_release(root, "release", complete=True)
            (root / "releases" / "release" / "apk" / "base.apk").write_bytes(b"corrupt")

            self.assertFalse(release_store.is_complete_release(root, "release"))

    def test_apk_hash_path_must_be_a_safe_filename(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self._write_release(root, "release", complete=True)
            payload = release_store.load_release_json(root, "release")
            payload["apkHashes"] = {"../base.apk": hashlib.sha256(b"apk").hexdigest()}

            self.assertFalse(release_store.is_complete_release(root, "release", payload))


if __name__ == "__main__":
    unittest.main()
