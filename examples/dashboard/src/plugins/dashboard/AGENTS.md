# Dashboard

Owns the `/dashboard` page and two slots; it shows no data of its own.

## Public contracts

- Slot `dashboard.widgets` (components): cards on the page, sorted by each file's `order` export.
- Slot `dashboard.toolbar` (Actions): buttons beside the title.
- Action `dashboard.open` (navigation).

## Checks

`/dashboard` shows the Revenue, Orders and Low stock cards from three other plugins and their
"Record a sample order" button. Remove the sales or inventory folder and its card disappears.
