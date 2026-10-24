---
'@bitakit/ui': patch
---

`PluginSlot` takes `fallback`, rendered while no contribution is placed and instead of a failing
occupant of a single slot, and passes `children` to its contributions so layouts can wrap pages.
For single slots, `useSlot` keeps the candidate `selectSingle` picks, reports `ambiguous` or
`choice-unavailable` with `diagnostics.candidates`, logs a tie once, and renders the selected file
contribution before the runtime has started (after payload validation) so the default does not
flash. Entries carry their contribution key as `entryKey`; `SlotProps` includes `children`.
