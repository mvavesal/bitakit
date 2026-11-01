# File schedules example plugin

`server/plugin.ts` declares `file-schedules.source`, requiring the shared scheduler contract.
Its lifecycle owns source `host-file` at priority 10, using `BITAKIT_SCHEDULE_FILE` or the adjacent
YAML fixture. This is Node-only code, never browser discovery input. Changes to the YAML are
read at runtime; removing the override restores the reports default. Always register cleanup
before awaiting the initial load. This example adds no persistence, tenant policy or new adapter
registry. Verify through `examples/server/main.ts --once` and the file source tests.
