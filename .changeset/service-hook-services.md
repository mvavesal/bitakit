---
'@bitakit/core': patch
---

Service interceptor hooks receive `services`, as Action interceptors do, so an observer can record calls into its own service (for example a logger with `service: '*'`); skip the observer's own service to avoid recursion. A hook's `service` is now typed as `string`: with a glob or alias target it reports the actual service ID.

Observed service methods keep their own properties. Before, observing the translation service dropped `translate.has`, so every fallback text was looked up as a key and reported as missing.
