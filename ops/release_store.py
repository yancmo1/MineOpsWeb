"""Repo-owned UbuntuMac release selection helpers.

This file mirrors the data-engine module deployed at
``~/mineops-engine/src/mineops_data_engine/release_store.py``.  Keeping the
operational source here makes the duplicate-selection fix reproducible even
though the staged UbuntuMac engine directory is not currently a Git worktree.
"""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path


def releases_root(data_root: Path) -> Path:
    return data_root / "releases"


def list_release_ids(data_root: Path) -> list[str]:
    root = releases_root(data_root)
    if not root.exists():
        return []
    return sorted(path.name for path in root.iterdir() if path.is_dir())


def release_dir(data_root: Path, release_id: str) -> Path:
    return releases_root(data_root) / release_id


def load_release_json(data_root: Path, release_id: str) -> dict:
    path = release_dir(data_root, release_id) / "release.json"
    if not path.exists():
        raise FileNotFoundError(f"Missing release.json for {release_id}")
    return json.loads(path.read_text(encoding="utf-8"))


def verify_release_structure(data_root: Path, release_id: str) -> list[str]:
    """Return every missing raw-capture prerequisite for a release."""

    base = release_dir(data_root, release_id)
    required = [
        base / "release.json",
        base / "apk" / "APK_PATHS.json",
        base / "apk" / "APK_SET.json",
        base / "apk" / "SHA256SUMS",
        base / "manifests" / "package-dumpsys.txt",
    ]
    return [str(path) for path in required if not path.is_file()]


def is_complete_release(data_root: Path, release_id: str, payload: dict | None = None) -> bool:
    """Return whether a release can safely serve as an unchanged APK match.

    Metadata-only test directories must never shadow a complete capture.  In
    addition to the structural manifest files, every APK named in ``apkHashes``
    must exist and contain bytes.
    """

    if verify_release_structure(data_root, release_id):
        return False

    try:
        release_payload = payload or load_release_json(data_root, release_id)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return False

    apk_hashes = release_payload.get("apkHashes")
    if not isinstance(apk_hashes, dict) or not apk_hashes:
        return False

    apk_root = release_dir(data_root, release_id) / "apk"
    apk_root_resolved = apk_root.resolve()
    for name, digest in apk_hashes.items():
        if (
            not isinstance(name, str)
            or not name
            or name != Path(name).name
            or "\\" in name
            or not isinstance(digest, str)
            or len(digest) != 64
            or any(char not in "0123456789abcdef" for char in digest)
        ):
            return False
        apk_path = apk_root / name
        try:
            if apk_path.is_symlink() or apk_path.resolve().parent != apk_root_resolved or not apk_path.is_file() or apk_path.stat().st_size <= 0:
                return False
            actual = hashlib.sha256()
            with apk_path.open("rb") as handle:
                for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                    actual.update(chunk)
        except OSError:
            return False
        if actual.hexdigest() != digest:
            return False
    return True


def find_matching_release(
    data_root: Path,
    version_code: int,
    apk_hashes: dict[str, str],
) -> str | None:
    """Find the newest structurally complete release with identical APKs."""

    for rel_id in reversed(list_release_ids(data_root)):
        try:
            payload = load_release_json(data_root, rel_id)
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            continue
        if not is_complete_release(data_root, rel_id, payload):
            continue
        if int(payload.get("versionCode", -1)) != int(version_code):
            continue
        if payload.get("apkHashes", {}) == apk_hashes:
            return rel_id
    return None


def create_reprocess_revision(data_root: Path, release_id: str) -> Path:
    rel_dir = release_dir(data_root, release_id)
    if not rel_dir.exists():
        raise FileNotFoundError(f"Release not found: {release_id}")

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    revision_dir = rel_dir / "revisions" / timestamp
    revision_dir.mkdir(parents=True, exist_ok=False)
    payload = {
        "sourceReleaseId": release_id,
        "revisionId": f"{release_id}.rev.{timestamp}",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "status": "reprocess_scaffolded",
    }
    (revision_dir / "reprocess.json").write_text(
        json.dumps(payload, indent=2) + "\n",
        encoding="utf-8",
    )
    return revision_dir
