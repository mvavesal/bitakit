---
'@bitakit/core': patch
'@bitakit/discovery': patch
---

Server services may read `services` in their own factory without writing a return type. `ServerServices` is an interface over a lazily resolved namespace, and discovery writes the key of each one-service file itself (`DiscoveredServiceValue`), so the discovered map no longer waits for the file it describes.
