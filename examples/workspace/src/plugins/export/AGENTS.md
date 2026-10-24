# Export

Downloads the notes as Markdown from a button in the notes toolbar.

## Public contracts

`export.markdown` sits in `notes.toolbar`, requires `notes.list`, is disabled while there are
no notes and downloads `notes.md`, then shows "Exported N notes".

## Constraints and checks

Runs in the browser only (it creates a download link). On `/notes`, add a note and press
"Export as Markdown".
