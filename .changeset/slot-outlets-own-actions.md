---
'@bitakit/ui': patch
---

Slot outlets follow only the Actions their own entries reference. A component or data slot no
longer rebuilds its view, and re-renders every contribution, whenever any Action runs or a service
change refreshes Action presentation; an Actions slot renders again only when one of its own
Actions changes. `PluginSlot` memoizes each contribution on its component and payload.
