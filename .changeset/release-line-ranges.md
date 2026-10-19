---
'@bitakit/create-app': patch
---

New apps and plugin packages depend on the release line (`^0.2.0`) for every `@bitakit/*` package
instead of the generator's own version, so the generator can be released without the other
packages.
