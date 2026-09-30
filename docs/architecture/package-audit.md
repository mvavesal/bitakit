> Implementation update: all eleven packages remain in use. Organization UI now lives in better-auth-ui; organizations is headless. Both app consumers and UI lifecycle tests have migrated. Better Auth UI re-exports use upstream, Shell has separate composition/service/rendering modules, and missing direct app dependencies are declared. Native replacement of custom organization behavior is not complete.

# Package-Audit und vorgeschlagene Struktur

Stand: 22. September 2026. Statische Prüfung der Package-Manifeste, öffentlichen Exports, Quellcode-Imports und Plugin-Komposition in beiden Apps. Keine Packages entfernt oder umstrukturiert. „Verwendet“ bedeutet hier: im Quellcode importiert beziehungsweise in der App-Komposition eingebunden; es bestätigt keine erfolgreiche Ausführung jedes externen Dienstes. Dies ist kein Versions-/Security-Audit von Drittanbieter-Abhängigkeiten.

## Ergebnis

Alle elf Packages unter `packages/` haben Verbraucher im Repository. Kein vollständiges Package ist derzeit ein belegbarer Löschkandidat. Ungenutzte optionale öffentliche Exports sind nicht automatisch veraltet.

| Package | Art | Belegbare Verwendung | Empfehlung |
| --- | --- | --- | --- |
| core | Infrastruktur | Beide Apps und Anbieter-Plugins | Behalten; gemeinsame Discovery und Modulprojektion weiter konsolidieren |
| settings | Eigenständige Bibliothek | Beide Apps, shell, organizations, better-auth-ui | Behalten; unabhängig von Config und optionalen Core-Actions halten |
| ui | Komponentenbibliothek | Beide Apps, shell, organizations, better-auth-ui | Behalten; öffentliche Komponenten direkt importierbar lassen |
| next | Framework-Adapter | next.config beider Apps; Router-Anbindung in web | Behalten; Dokumentation aktualisieren |
| next-intl | Übersetzungsadapter | web/src/providers/actions-provider.tsx | Behalten; nicht in Content-Demo benötigt, aber aktiv in web |
| email | Service-Vertrag | web/src/lib/auth/mail.ts, better-auth/email, nodemailer | Behalten; kleines Paket bewusst klein lassen |
| nodemailer | Server-Plugin | web/src/lib/auth/mail.ts | Behalten; SMTP-Transport bleibt serverseitig |
| better-auth | Anbieteradapter | Auth-Komposition beider Apps; Organisations- und Mailadapter | Behalten; Unterbereiche deutlicher organisieren |
| better-auth-ui | UI-Plugin und Upstream-Reexports | Content-Demo Auth- und Settings-Komposition | Behalten; Foundation-Adapter und Upstream-Exports trennen |
| organizations | Headless-Service plus optionales UI-Plugin | Beide Apps; better-auth-Adapter | Headless behalten; redundante UI durch Better Auth UI ersetzen |
| shell | UI-/Settings-Plugin | Content-Demo; gemeinsame Settings-Shell in web | Behalten; Plugin-Registrierung und Darstellung trennen |

Die Package-Verwendung ist nicht allein aus `package.json` abgeleitet. Konkrete Kompositionsstellen sind `apps/web/src/providers/actions-provider.tsx`, `apps/content-demo/src/components/providers.tsx`, `apps/content-demo/src/features/better-auth/plugin.tsx` und `apps/web/src/lib/auth/mail.ts`.

## Tatsächlich veraltet oder korrekturbedürftig

### Veraltete Next-Dokumentation

`packages/next/README.md` beschreibt hauptsächlich die alten Suffix-Dateien, bezeichnet `resolveContribution` als React-Package-API und behauptet weiterhin, deaktivierte Plugin-Services würden über Type-only-Imports in ServiceMap aufgenommen. Die neue Core-Discovery übernimmt die Erkennung und gibt Typen deaktivierter Module nicht mehr so aus. Die README muss an den Core-Leitfaden angeglichen werden. Das Package selbst ist aktiv.

### Veralteter Architekturtest

`packages/core/tests/auth-boundary.test.mjs` verlangt auch für die Content-Demo die Abwesenheit von Better Auth. Die Demo verwendet inzwischen ausdrücklich diese Integration. Die Unabhängigkeitsprüfung gehört weiterhin auf Core und Settings; die Demo sollte anhand ihrer tatsächlich vereinbarten optionalen Integration geprüft werden.

### Verwaistes Build-Artefakt

`packages/core/dist/feedback.js` hat keine entsprechende Datei mehr unter `src`. Der aktuelle Code und dessen Export befinden sich unter `src/actions/feedback.ts` beziehungsweise `dist/actions/feedback.js`. Es wurde keine Referenz auf das alte Root-Artefakt gefunden. Bei einer kontrollierten Bereinigung des Build-Ausgabeverzeichnisses entfernen; anschließend sauber bauen. Dies ist kein ungenutztes Package.

### Unterschiedliche Begriffe unter Better Auth UI

`packages/better-auth-ui/src/plugins/` enthält überwiegend Reexports von Upstream-Erweiterungen. Sie sind keine jeweils eigenständigen Foundation-Plugins. Beispiele wie Billing, SSO, Passkey und Magic Link haben derzeit keine direkten Verbraucher in den geprüften App-Quellen. Da sie öffentlich exportierte optionale Fähigkeiten sind, ist das kein ausreichender Löschgrund. Kein automatisches Aktivieren aller dieser Erweiterungen über die Foundation-Discovery.

### Große öffentliche Einstiegsmodule

- `organizations/src/react.tsx`: Plugin-Erstellung, Settings-Registrierung und Seitenkomponenten in einer Datei.
- `shell/src/index.tsx`: Plugin-Erstellung, Theme-Projektion, Hooks und AppShell-Darstellung in einer Datei.
- `better-auth-ui/src/index.tsx`: Upstream-Reexports, Seitenprojektion, Provider und Foundation-Plugin in einer Datei.

Diese Dateien sind aktiv, nicht veraltet. Ihre Verantwortlichkeiten sollten aufgeteilt werden; ihre öffentlichen Importpfade können dabei stabil bleiben.

### Deklarierte direkte Abhängigkeit fehlt

Beide Apps importieren `@bitakit/ui` direkt, deklarieren es aber derzeit nicht als direkte Dependency. Die lokale Installation funktioniert über andere Packages beziehungsweise Workspace-Hoisting. Die Manifeste sollten direkte Imports ausdrücklich abbilden.

## Strukturregeln

1. Nicht jedes Package zu einem Plugin umformen. Infrastruktur, Verträge, UI-Primitives und konkrete Plugins haben unterschiedliche Aufgaben.
2. `index.ts` beziehungsweise `react.ts` als kurze öffentliche Exportflächen verwenden. Implementierungen in benannte Module verschieben.
3. Beiträge unter actions/services/configs/interceptors organisieren, sofern sie tatsächlich Beiträge sind. Normale Hilfsfunktionen und Upstream-Reexports sind keine Discovery-Beiträge.
4. Keine leeren Ordner, Klassen oder Config-Dateien auf Vorrat erzeugen.
5. Plain-Data-Defaults dürfen in Config. Auth-Clients, React-Komponenten, Settings-Instanzen und Transport-Factories bleiben explizite Laufzeitabhängigkeiten. Nicht sämtliche Plugin-Optionen in den eingefrorenen Config-Service verschieben.
6. Bestehende Service-Keys, Plugin-IDs, Action-IDs und öffentliche Subpath-Exports beim internen Verschieben bewahren.
7. Die neue Discovery erkennt lokale Module; veröffentlichte Package-Quellen werden bislang nicht automatisch vom Host gescannt. Strukturänderungen allein ersetzen daher keine bestehende Plugin-Factory. Für künftige Package-Discovery einen Build-Adapter zur gemeinsamen Core-Discovery verwenden, keinen Package-eigenen Scanner.
8. Ein Plugin mit mehreren abhängigen Diensten braucht keine weitere Plugin-Ebene pro Dienst.

## Konkrete Zielstrukturen

Der neuere [Package-Strukturstandard](package-structure-standard.md) hat bei abweichenden Zielstrukturen Vorrang. Die folgenden Bäume sind Vorschläge. Nur vorhandene Verantwortlichkeiten verschieben; Exportpfade nach außen stabil halten.

### organizations — Headless-Ziel nach UI-Migration

Die bestätigte Zielstruktur steht in [Package-Strukturstandard](package-structure-standard.md). Native Better Auth UI ersetzt redundante Organisationsoberflächen; ausschließlich notwendige eigene UI gehört künftig zu better-auth-ui. Der bisherige Vorschlag, alle eigenen UI-Dateien in organizations neu zu sortieren, ist damit ersetzt.

```text
src/
├── index.ts
├── plugin.ts
├── contracts.ts
├── website.ts
├── demo.ts
└── services/
    └── organizations.ts
```

Dies ist ein Migrationsziel, kein bereits implementierter Stand. Bestehende UI-Exports erst nach Prüfung und Umstellung beider Apps entfernen. Headless-Service und geteilte Service-Keys bleiben erhalten, solange sie verwendet werden.

### shell — zweite Refactoring-Priorität

```text
src/
├── index.ts                        # Bestehende öffentliche Exports
├── plugin.tsx                      # shellPlugin und dessen Komposition
├── definitions.ts                  # Öffentlicher Settings-Definitions-Einstieg
├── settings.ts                     # Bestehender öffentlicher Subpath
├── services/
│   └── shell.ts                    # Service-Key und Settings-Zugriff
├── actions/
│   └── open-settings.ts
├── settings/
│   ├── definitions.ts
│   ├── sections.ts
│   ├── categories.ts
│   └── theme-projection.ts         # DOM-Projektion; keine zweite Theme-Autorität
├── hooks/
│   └── use-shell-layout.ts
└── components/
    ├── app-shell.tsx
    ├── settings-shell.tsx
    ├── settings-page.tsx
    ├── settings-link.tsx
    ├── plugin-overview.tsx         # Verständlicher als settings-overview.tsx
    ├── appearance-settings.tsx
    ├── layout-settings.tsx
    └── choice-cards.tsx
```

Die Settings-Definitionen sind keine Config-Snapshots: bestätigte Theme-/Layout-Werte bleiben bei AppPreferences.

### better-auth-ui — dritte Refactoring-Priorität

```text
src/
├── index.ts                        # Öffentliche Reexports, keine große Implementierung
├── plugin.tsx                      # betterAuthUIPlugin
├── options.ts                      # Öffentliche Adapter-Optionen
├── catalog.ts                      # Öffentlicher Katalog
├── plugins.ts                      # Kompatibler Upstream-Sammelexport
├── plugins/                        # Bestehende öffentliche Upstream-Subpaths
├── email.ts                        # Upstream-E-Mail-Komponenten
├── services/
│   └── configuration.ts            # Konfigurationsvertrag mit Runtime-Abhängigkeiten
├── providers/
│   └── auth.tsx
├── pages/
│   └── create-auth-pages.tsx       # Dynamische Projektion nativer Auth-Routen
├── settings/
│   └── account-sections.tsx
└── components/
    └── auth-page-layout.tsx
```

Keine Auth-Seite pro Upstream-Route von Hand anlegen: die vorhandene dynamische Projektion bleibt nötig. Die Upstream-Bibliothek wird weder kopiert noch durch eigene Formulare ersetzt. `plugins/*` kann wegen öffentlicher Imports zunächst seinen Namen behalten; die README muss dessen Bedeutung klar erklären.

### better-auth — kleine, gezielte Aufteilung

```text
src/
├── index.ts                        # Öffentliche Auth-Exports
├── plugin.ts                       # betterAuthPlugin
├── services/
│   └── auth.ts                     # Auth-Vertragsanbindung
├── organizations.ts                # Bestehender öffentlicher Subpath
├── organizations/
│   ├── backend.ts                  # Provider-Anbindung
│   └── session-backend.ts          # Bisher organization-session.ts
├── email.ts                        # Bestehender öffentlicher Server-Subpath
└── email/
    └── auth-mail.ts
```

Nur aufteilen, soweit tatsächlich mehrere Verantwortlichkeiten getrennt werden. Die nativen Better-Auth-Prüfungen bleiben unverändert.

### Kleine Packages bewusst klein halten

```text
email/src/
└── index.ts                        # Vertrag und Service-Key: aktuell ausreichend

next-intl/src/
└── index.ts                        # Ein kleiner React-Adapter: aktuell ausreichend

nodemailer/src/
├── index.ts                        # Öffentliche Exports
├── plugin.ts                       # Registrierung und Transport-Erstellung
├── service.ts                      # Bestehender Versandadapter
└── browser.ts                      # Server-only-Schutz beibehalten
```

SMTP-Secrets bleiben serverseitig. Der Browser-Einstieg ist eine Schutzmaßnahme und kein überflüssiges Duplikat.

### Infrastruktur-Packages

- **core:** vorhandene Grenzen `discovery/`, `src/actions/`, `src/contributions/`, Config-Service und Runtime erhalten. Eine zusammenhängende App-/Plugin-Modulprojektion vervollständigen. Nicht Core-eigene Infrastruktur als automatisch entdeckte Fachplugins registrieren.
- **settings:** vorhandene Trennung zwischen Headless-Modellen, React-Hooks, Controls und optionalen Action-Bindings erhalten. Keine Umbenennung aller Dateien allein wegen der neuen Discovery.
- **ui:** flache, direkt importierbare Komponenten beibehalten. Eine lange Registry-Komponente ist allein kein Grund für eine eigene Aufteilung oder Kopie.
- **next:** CLI, Next-Konfiguration und Router-Anbindung behalten. Der bestehende kleine `generate.mjs`-Reexport delegiert bereits an Core und ist kein doppelter Scanner. Neue Dateigrammatik und Typverhalten dokumentieren.

## Reihenfolge

1. Veraltete Dokumentation und Testannahmen korrigieren; direkte UI-Dependencies sauber deklarieren; verwaiste Build-Ausgabe kontrolliert bereinigen.
2. Gemeinsamen App-/Plugin-Modulvertrag im Core vervollständigen, bevor die App-Struktur migriert wird.
3. Organisations-UI gegen native Better Auth UI abgleichen und Verbraucher migrieren; organizations headless halten, shell intern aufteilen.
4. better-auth-ui in Adapter, Provider, Seitenprojektion, Settings und Reexports trennen.
5. Kleine Provider-Packages nur bei konkretem Nutzen aufteilen.
6. Anschließend den [Content-App-Refactoring-Plan](content-app-refactoring.md) umsetzen.

Kein Package wird allein deshalb entfernt, weil es nur in einer App oder nur serverseitig verwendet wird. Die genannten optionalen Exports benötigen vor einer Entfernung eine eigenständige API-Entscheidung.
