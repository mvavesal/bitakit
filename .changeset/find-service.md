---
'@bitakit/core': patch
---

`findService(services, contract)` reads a contract that may have no provider: it returns `undefined` when no active plugin provides it (the plugin is absent or switched off) instead of throwing like `getService`. A provider that is declared but not created yet is still an error. Exported from `@bitakit/core` and `@bitakit/core/server`.
