---
'@bitakit/core': patch
---

A `policy: 'single'` slot is now a replaceable part: several plugins may attach a candidate (the
same contributor and key twice is still a conflict) and outlets render one. `selectSingle`
decides: the app's `choose` entry (`BitaKitRuntimeConfig.choose`, from `bitakit.config.ts`), then
the app's own contribution, then the only candidate; a tie selects none. `candidateNames` gives
the names a choice accepts. Layout families are single slots `layout.<family>`: `pluginLayout`
now takes `(module, family, variant, source)` and returns the slot candidate, `layoutSlots`
declares families, and pages may name any declared family (the error names the files to add).
