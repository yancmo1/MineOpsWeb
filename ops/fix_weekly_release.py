"""Fix weekly script to pass release-id to extract-managers."""
import sys

path = sys.argv[1]
with open(path) as f:
    content = f.read()

old = (
    'echo "[$(date -Is)] extracting managers (cross-bundle, 118 expected)"\n'
    'MINEOPS_DATA_ROOT="$HOME/mineops-data" mineops-data-engine extract-managers 2>&1 || echo "extract-managers: non-fatal error"\n'
)

new = (
    'echo "[$(date -Is)] extracting managers (cross-bundle, 118 expected)"\n'
    'LATEST_RELEASE=$(ls -t "$HOME/mineops-data/releases/" | head -1)\n'
    'if [ -n "$LATEST_RELEASE" ]; then\n'
    '  MINEOPS_DATA_ROOT="$HOME/mineops-data" mineops-data-engine extract-managers \\\n'
    '    --release-id "$LATEST_RELEASE" 2>&1 || echo "extract-managers: non-fatal error"\n'
    'fi\n'
)

content = content.replace(old, new)

with open(path, "w") as f:
    f.write(content)

print("Fixed weekly script: extract-managers now uses LATEST_RELEASE")
