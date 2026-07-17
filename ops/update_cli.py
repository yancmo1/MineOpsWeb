#!/usr/bin/env python3
"""Update the engine CLI to add extract-managers command."""
cli_path = "/home/yancmo/mineops-engine/src/mineops_data_engine/cli.py"

with open(cli_path) as f:
    cli = f.read()

# Add import
import_stmt = "from .extraction_engine import ExtractionEngine"
new_import = (
    "from .extraction_engine import ExtractionEngine\n"
    "from .il2cpp_extractor import (\n"
    "    load_bundle, extract_manager, run_batch,\n"
    "    build_unresolved, build_evidence,\n"
    "    _serialize_manager, serialize_report,\n"
    ")"
)
cli = cli.replace(import_stmt, new_import)

# Add command function before build_parser
cmd_func = '''
def cmd_extract_managers(release_id, manager_id, output_dir):
    """Extract manager data from configfiles-supermanagers bundle."""
    from pathlib import Path
    import os, json
    data_root = Path(os.environ.get("MINEOPS_DATA_ROOT", ""))
    if not data_root.exists():
        print("MINEOPS_DATA_ROOT not set or invalid")
        return 1
    if release_id:
        rel_dir = data_root / "releases" / release_id
    else:
        from .release_store import list_release_ids
        rels = list_release_ids(data_root)
        if not rels:
            print("No releases found")
            return 1
        rel_dir = data_root / "releases" / rels[-1]
    out_path = Path(output_dir) if output_dir else (rel_dir / "exports" / "extracted_managers")
    out_path.mkdir(parents=True, exist_ok=True)
    if manager_id:
        env = load_bundle(rel_dir)
        mgr = extract_manager(env, manager_id)
        result = _serialize_manager(mgr)
        with open(out_path / "manager_%d.json" % manager_id, "w") as f:
            json.dump(result, f, indent=2, default=str)
        print("Extracted manager %d -> %s" % (manager_id, out_path / "manager_%d.json" % manager_id))
        return 0
    managers, report = run_batch(rel_dir)
    unresolved = build_unresolved(managers)
    evidence = build_evidence(managers)
    managers_out = [_serialize_manager(m) for m in managers]
    report_json = serialize_report(report, managers)
    with open(out_path / "managers.json", "w") as f:
        json.dump(managers_out, f, indent=2, default=str)
    with open(out_path / "extraction-report.json", "w") as f:
        json.dump(report_json, f, indent=2, default=str)
    with open(out_path / "unresolved-fields.json", "w") as f:
        json.dump(unresolved, f, indent=2, default=str)
    with open(out_path / "source-evidence.json", "w") as f:
        json.dump(evidence, f, indent=2, default=str)
    print("Batch: %d full, %d partial -> %s" % (
        report.extracted_count, report.partial_count, out_path))
    return 0

'''
old_build = "\ndef build_parser"
cli = cli.replace(old_build, cmd_func + old_build)

# Add parser - find "process" and add before it
old_parser = '    sub.add_parser("process")'
new_parser = '''
    extract_mgr = sub.add_parser("extract-managers")
    extract_mgr.add_argument("--release-id", dest="release_id", default=None)
    extract_mgr.add_argument("--manager-id", type=int, default=None)
    extract_mgr.add_argument("--output-dir", default=None)
'''
cli = cli.replace(old_parser, new_parser + "\n" + old_parser)

# Add dispatch
old_dispatch = '        "doctor": lambda args: cmd_doctor(),'
new_dispatch = (
    '        "extract-managers": lambda args: cmd_extract_managers(\n'
    '            args.release_id, args.manager_id, args.output_dir),\n'
    '        "doctor": lambda args: cmd_doctor(),'
)
cli = cli.replace(old_dispatch, new_dispatch)

with open(cli_path, "w") as f:
    f.write(cli)

print("CLI updated successfully")
print("New command:", "mineops-data-engine extract-managers --help")
