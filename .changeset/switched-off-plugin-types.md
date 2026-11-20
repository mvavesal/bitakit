---
'@bitakit/discovery': patch
---

A disabled plugin keeps its typed names. The generated files reference its services, server services, actions, events, settings, configs, slots and (beside enabled ones) permissions only through type-only `typeof import(…)` entries, so its own files and optional references from other plugins still compile while nothing of it is imported, checked or run. A name an enabled module also claims stays the enabled module's (`Omit` over the switched-off entries). Its slot definitions declare no slot, its server Actions stay unchecked and untyped, and the integration kinds' type maps keep only enabled plugins.
