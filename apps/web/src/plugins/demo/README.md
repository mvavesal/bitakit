# Demo-Plugin ohne Datenbank

Das Plugin bringt seine Komponenten selbst mit. Die App stellt nur den allgemeinen
Dashboard-Slot und den bestehenden Settings-Rahmen bereit.

- `views/dashboard.view.tsx`: Beitrag zum Slot `dashboard.content`.
- `components/`: Dashboard-Karte und eigene Settings-Seite.
- `setup.ts`: registriert die Seite im Settings-Katalog unter „Plugins“;
  die Foundation übernimmt das Aufräumen.
- `actions/`: Begrüßung, lokaler Schalter, Dashboard-Link und Settings-Link im User-Menü.
- `services/preferences.service.ts`: lokale Einstellung ohne Datenbank; wird beim Neuladen zurückgesetzt.
- `locales/`: deutsche und englische Texte.

In `apps/web/foundation.config.ts` aktiviert `plugins.overrides.demo.enabled` das
Plugin. Mit `false` verschwinden Karte, Settings-Seite und sämtliche Menübeiträge.
Das Entfernen des Plugin-Ordners entfernt dieselben automatisch erkannten Beiträge.
Eine explizite Plugin-Liste am FoundationProvider ersetzt weiterhin die Automatik;
`plugins={[]}` aktiviert keine Plugins.
