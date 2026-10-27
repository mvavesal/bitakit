---
'@bitakit/ui': patch
---

`StandardActionMenu` closes after a navigation item routes: the link cancels its click for client-side routing, so Radix never saw a selection and the menu stayed open over the new page.
