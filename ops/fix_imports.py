"""Add the il2cpp extractor import to the CLI."""
import sys

cli_path = sys.argv[1]
with open(cli_path) as f:
    lines = f.readlines()

# Find the import from .extraction and add after it
for i, line in enumerate(lines):
    if "from .extraction import" in line:
        import_line = (
            "from .il2cpp_extractor import (\n"
            "    load_bundle, extract_manager, run_batch,\n"
            "    build_unresolved, build_evidence,\n"
            "    _serialize_manager, serialize_report,\n"
            ")\n"
        )
        lines.insert(i + 1, import_line)
        break

with open(cli_path, "w") as f:
    f.writelines(lines)

print("Import added successfully")
