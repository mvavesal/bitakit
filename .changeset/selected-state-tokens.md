---
'@bitakit/ui': patch
'@bitakit/shell': patch
---

Add `--selected` and `--selected-border` theme tokens for one selected state (the muted surface with a primary-tinted edge by default); `FieldLabel` choice cards use them, and select triggers get the same round corners as text inputs. Shell's theme defaults and bundled themes define both tokens.
