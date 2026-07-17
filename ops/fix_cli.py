"""Fix the CLI dispatch indentation after sed broke it."""
import sys

cli_path = sys.argv[1]
with open(cli_path) as f:
    lines = f.readlines()

# Find the problematic lines
for i, line in enumerate(lines):
    if 'if args.command == "extract-managers"' in line and i > 460:
        # Replace this and surrounding lines
        lines[i-2:i+3] = [
            '        if args.command == "doctor":\n',
            '            return cmd_doctor()\n',
            '        if args.command == "extract-managers":\n',
            '            return cmd_extract_managers(args.release_id, args.manager_id, args.output_dir)\n',
            '        logging.info("Command scaffolded but not yet implemented", extra={"run_id": "m1"})\n',
        ]
        break

with open(cli_path, "w") as f:
    f.writelines(lines)
print("Fixed CLI dispatch")
