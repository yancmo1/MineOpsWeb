# Emulator ingestion agent

Install the agent from `ingestion-agent` with `pip install .`. `mineops-ingest validate capture.json` validates a JSON capture and prints its source hash. `mineops-ingest upload capture.json --api https://mineops.example/api/v1` stages it on the API. `--dry-run` performs parsing and hashing only. The current foundation accepts direct file paths; folder watching, local outbox retry, redaction rules, compression, and scoped token authentication must be added before production use.
