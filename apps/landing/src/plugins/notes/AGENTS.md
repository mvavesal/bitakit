# Notes playground plugin

Owns `/notes` and `notes.open`, placed in the `features` navigation slot. This is a read-only
collection of project notes from `data/notes.json`, rendered with standard Item components.
Sample note content stays as authored; the surrounding UI has English/German translations.

Keep React under `ui/` and follow `../../../AGENTS.md`. No persistence, editor or service is
needed for this view. Verify the page and disable/enable behavior with
`npm run typecheck --workspace @bitakit/landing` and the demo.
