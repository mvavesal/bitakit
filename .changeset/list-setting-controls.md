---
'@bitakit/core': patch
'@bitakit/app-preferences': patch
---

Settings can hold lists. `control: 'list'` (inferred for a list default) edits short texts with add and remove; `control: 'checkboxes'` (inferred for a list default with `options`) chooses several of the options. Core validates each chosen value against the options and types it as a list of the option union.
