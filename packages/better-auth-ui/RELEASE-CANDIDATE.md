# Geprüfter Kandidat: offizieller Stand 1.7.15

Status: **Entscheidung ausstehend**, kein bestätigter dauerhafter Downgrade.
Der aktuelle lokale Preview-Kandidat verwendet HeroUI, Core, React und Locales
von Better Auth UI in Version 1.7.15. Die Beschreibung von 1.7.26 in README und
Katalog bezeichnet weiterhin den bisher gewählten Zielstand.

## Grund

In 1.7.16 bis einschließlich npm-latest 1.7.26 kann OrganizationMembers während
paralleler API-Abfragen vier Spalten (einschließlich Auswahl) und nur drei
Skeleton-Zellen rendern. React Aria bricht dann die ganze Seite ab. Realer
Owner-Zugang reproduziert das; schnelle Memory-Adapter-Tests allein nicht.
OrganizationProps, OrganizationPeopleProps und OrganizationPluginOptions bieten
keinen öffentlichen Skeleton-/Selection-Override. Ein nur initiales Prefetch
würde weitere Organisationswechsel/Invalidierungen nicht zuverlässig reparieren.
Es wurden keine npm-Quelldateien verändert und keine Rechte entfernt.

## Unterschiede zu 1.7.26

- Neuere Tabellenfunktionen fehlen: Mehrfachauswahl/-aktionen, Spaltenauswahl und
  die neuere vereinheitlichte Tabellenzustands-/Pagination-Implementierung.
  Betroffen sind unter anderem Organisationstabellen, Admin, API-Schlüssel,
  OAuth-Clients und Aktivitätslisten. Vorhandene ältere Such-/Rollen-/Statusfilter
  und Einzelaktionen sind davon zu unterscheiden.
- Die spätere vereinheitlichte erneute Authentifizierung
  (ReauthenticationAction/Notice) fehlt. 1.7.15 verwendet ältere FreshSession-
  Abläufe. Diese Anpassung kann bei sensiblen Aktionen relevant sein; kein
  Versprechen vollständiger Verhaltensgleichheit.
- Die spätere TanStack-Form-Umstellung und ihre Validierungs-/Fehlerbehandlung
  fehlen. AdditionalField-/Custom-Renderer-Props sind nicht identisch:
  value/onChange/onBlur/isInvalid/errors wurden später ergänzt.
- Die öffentlichen Paket-Einstiegspunkte sowie die bestehenden Komponenten-Namen
  des Foundation-Katalogs bleiben erhalten. Organization, OrganizationPeople,
  OrganizationMembers und OrganizationInvitations haben dieselben öffentlichen
  Haupt-Props; einzelne Zeilenkomponenten haben in26 zusätzliche Auswahl-/Sichtbarkeitsprops.
- Server, Owner-Rolle, Mitgliedschaftsprüfungen, npm-Originalkomponenten und
  zentrale externe Theme-Brücke bleiben erhalten. Keine neue Fach-UI.

## Bisherige Evidenz

- Reale Anmeldung mit dediziertem Testkonto: Organisationsprofil und Mitglieder
  sichtbar; drei echte Navigationen plus drei Neuladungen ohne pageerror.
- Package-Build und drei Integrationstests erfolgreich.
- Vier Browserabläufe erfolgreich: Konto/Organisation/Einladungen, Reset/Login,
  Multi-Session-Wechsel und Theme. Diese verwenden einen echten isolierten
  Better-Auth-Handler; keine externen Einladungsmails.
- Ergänzter Browsertest: Rolle eines normalen Mitglieds auf Administrator erweitern,
  speichern und anschließend dieses Mitglied entfernen; sichtbare Tabelle und
  tatsächlicher Member-Datensatz bestätigen beide Aktionen.
- Alle21 öffentlichen Entry-Dateien des HeroUI-Pakets sind im Quellvergleich
  zwischen15 und26 identisch; dies beweist Exportnamen, nicht gleiche Props/Verhalten.
- Host-Typprüfung mit dazu passender Locales-Version erfolgreich.

Ein dauerhafter Pin erfordert die bestätigte Entscheidung über diese Unterschiede.
