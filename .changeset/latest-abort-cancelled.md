---
'@bitakit/core': patch
---

A `latest` Action run that rejects because a newer run aborted its signal now ends as skipped
(`cancelled`) instead of failing, so typing into a search no longer shows "signal is aborted"
messages or leaves unhandled rejections. The same applies to runs aborted when their
registration is removed.
