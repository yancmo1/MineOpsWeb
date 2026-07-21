"""Fix variable naming in weekly script after sed mangled it."""
import sys

path = sys.argv[1]
with open(path) as f:
    content = f.read()

# Fix the extract-managers section
old_extract = (
    'LATEST_RELEASE=$(ls -t "$HOME/mineops-data/releases/" | head -1)\n'
    'if [ -n "$LATEST_RELEASE_RELEASE" ]; then\n'
    '  MINEOPS_DATA_ROOT="$HOME/mineops-data" mineops-data-engine extract-managers \\\n'
    '    --release-id "$LATEST_RELEASE_RELEASE" 2>&1 || echo "extract-managers: non-fatal error"\n'
    'fi'
)
new_extract = (
    'LATEST_RELEASE=$(ls -t "$HOME/mineops-data/releases/" | head -1)\n'
    'if [ -n "$LATEST_RELEASE" ]; then\n'
    '  MINEOPS_DATA_ROOT="$HOME/mineops-data" mineops-data-engine extract-managers \\\n'
    '    --release-id "$LATEST_RELEASE" 2>&1 || echo "extract-managers: non-fatal error"\n'
    'fi'
)
content = content.replace(old_extract, new_extract)

# Fix the generate-catalog section
old_cat = (
    'LATEST=$(ls -t "$HOME/mineops-data/releases/" | head -1)\n'
    'if [ -n "$LATEST_RELEASE" ]; then\n'
    '  .venv/bin/python3 scripts/generate_catalog.py \\\n'
    '    "$HOME/mineops-data/releases/$LATEST_RELEASE" 2>&1 || echo "generate-catalog: non-fatal error"\n'
    'fi'
)
new_cat = (
    'LATEST=$(ls -t "$HOME/mineops-data/releases/" | head -1)\n'
    'if [ -n "$LATEST" ]; then\n'
    '  .venv/bin/python3 scripts/generate_catalog.py \\\n'
    '    "$HOME/mineops-data/releases/$LATEST" 2>&1 || echo "generate-catalog: non-fatal error"\n'
    'fi'
)
content = content.replace(old_cat, new_cat)

with open(path, "w") as f:
    f.write(content)
print("Variables fixed")
