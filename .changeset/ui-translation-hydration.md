---
'@bitakit/ui': patch
---

`useTranslation()` renders every text's fallback during hydration, as the server does, and
translates right after. A route that hydrates after the runtime already translated (a Settings
page loaded in German, for example) no longer reports a hydration mismatch.
