---
'@bitakit/app-preferences': patch
---

Add an All plugins / Enabled / Disabled status filter beside Tags. Combine it with existing
search and tag filters, preserve it in detail/back URLs, and derive results directly from
runtime inventory so plugin toggles update the filtered list immediately.

Use the standard Empty component with a search icon and localized guidance when no plugins
match the selected search and filters.
