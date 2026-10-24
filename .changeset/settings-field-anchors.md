---
'@bitakit/app-preferences': minor
---

Every setting has a stable anchor, `setting-<key>` (`settingAnchor(key)`), and `settingHref(basePath, section, key)` builds a link to it, such as `/settings/shell#setting-shell.theme`. Opening such a link, or changing the hash to one, scrolls the field to the middle of the page, focuses its control and highlights it briefly. `sectionHref` is exported too.
