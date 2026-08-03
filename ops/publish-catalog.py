#!/usr/bin/env python3
"""Retired direct-production catalog publisher.

The supported workflow validates an immutable package, records a bound human
review, and changes the publication pointer through the catalog publish route.
This compatibility entry point intentionally performs no network mutation.
"""

from __future__ import annotations

import sys


def main() -> int:
    print(
        "Direct catalog publication is retired. Use the reviewed, env-authenticated "
        "tools/validation/publish-release.mjs workflow after explicit production approval.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
