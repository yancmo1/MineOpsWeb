"""Update the weekly script to add M7 extraction + catalog generation."""
import sys

path = sys.argv[1]
with open(path) as f:
    content = f.read()

old = (
    'echo "[$(date -Is)] running process pipeline"\n'
    'mineops-data-engine process\n'
)

new = (
    'echo "[$(date -Is)] running process pipeline"\n'
    'mineops-data-engine process\n'
    '\n'
    'echo "[$(date -Is)] extracting managers (cross-bundle, 118 expected)"\n'
    'MINEOPS_DATA_ROOT="$HOME/mineops-data" mineops-data-engine extract-managers 2>&1 || echo "extract-managers: non-fatal error"\n'
    '\n'
    'echo "[$(date -Is)] generating v2 catalog"\n'
    'LATEST=$(ls -t "$HOME/mineops-data/releases/" | head -1)\n'
    'if [ -n "$LATEST" ]; then\n'
    '  .venv/bin/python3 scripts/generate_catalog.py \\\n'
    '    "$HOME/mineops-data/releases/$LATEST" 2>&1 || echo "generate-catalog: non-fatal error"\n'
    'fi\n'
)

if old in content:
    content = content.replace(old, new)
    with open(path, "w") as f:
        f.write(content)
    print("Updated weekly script")
else:
    print("ERROR: Could not find the target text in the script")
    # Debug: show what's there
    for line in content.split("\n"):
        if "process" in line:
            print("  FOUND: %s" % line)
