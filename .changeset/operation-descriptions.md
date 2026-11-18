---
'@bitakit/core': patch
'@bitakit/discovery': patch
---

Server Actions take `type: 'query' | 'mutation'` (default mutation), and `server.operations()` describes each operation's `type` and, where the schema implements Standard JSON Schema (zod 4), its `input` and `output` as JSON Schema (draft 2020-12) – the descriptions transport adapters and OpenAPI documents are built from.
