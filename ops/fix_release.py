"""Fix the CLI default release selection."""
import sys

cli_path = sys.argv[1]
with open(cli_path) as f:
    content = f.read()

old = (
    '        rels = list_release_ids(data_root)\n'
    '        if not rels:\n'
    '            print("No releases found")\n'
    '            return 1\n'
    '        rel_dir = data_root / "releases" / rels[-1]\n'
)
new = (
    '        rels = list_release_ids(data_root)\n'
    '        if not rels:\n'
    '            print("No releases found")\n'
    '            return 1\n'
    '        # Pick the newest with timestamp suffix\n'
    '        candidates = [r for r in rels if r.count("_") >= 2]\n'
    '        rel_dir = data_root / "releases" / (candidates[-1] if candidates else rels[-1])\n'
)
content = content.replace(old, new)

with open(cli_path, "w") as f:
    f.write(content)
print("Fixed release selection")
