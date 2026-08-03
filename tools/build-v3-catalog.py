#!/usr/bin/env python3
"""Build a release-scoped, lossless strategy candidate (never the active v3 dir)."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
for module_dir in (ROOT / "ops", ROOT / "src" / "mineops_data_engine"):
    if module_dir.is_dir():
        sys.path.insert(0, str(module_dir))

from strategy_package import main

if __name__ == "__main__":
    main()
