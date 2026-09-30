# Entwurf: Plugins mit Dateikonventionen

Diskussionsgrundlage und Pseudocode, keine implementierte API. Die hier verwendeten `define*`-Funktionen und Build-Befehle sind Vorschläge. Bestehende ActionList und SettingsCatalog bleiben die zuständigen Registrierungen. Dieser Entwurf führt keinen zusätzlichen Settings-Plugin-Loader ein.

## Standardstruktur

```text
plugins/tasks/
  package.json
  foundation.config.ts
  actions/index.ts
  settings/client.ts
  settings/server.ts
  components/index.ts
  client/index.ts
  server/index.ts
  locales/de.json
  locales/en.json
```

Ordner sind optional. Nur benannte Einstiegspunkte werden berücksichtigt; weitere Dateien sind interne Implementierung. Eine Komponente wird durch ihre Datei nicht automatisch zu einer Route oder einem Menüeintrag. Konfiguration bleibt als versionierte Datei im Repository und enthält keine Geheimnisse.

## Umfang der möglichen Beiträge

Pflicht sind die Paketidentität, die Kompatibilitätsangabe und mindestens ein nutzbarer Beitrag. Alle untenstehenden Ordner sind optional. Ein kleines UI-Plugin braucht weder Datenbank noch Backend. Für die erste Umsetzung reichen Actions, Settings, Komponenten, Locales und getrennte Client-/Server-Einstiegspunkte; weitere Kategorien erst einführen, wenn ein konkretes Plugin sie benötigt.

| Standardpfad                         | Zweck und Grenze                                                                                                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actions/index.ts`                   | Action-Beiträge an die eine Root-ActionList; keine eigene Registry.                                                                                                  |
| `settings/client.ts`                 | Seiten und Felder im bestehenden SettingsCatalog.                                                                                                                    |
| `settings/server.ts`                 | Validierte Definitionen, Scope und Persistenzberechtigung; keine Geheimnisse in Client-Metadaten.                                                                    |
| `components/index.ts`                | Öffentliche UI-Komponenten; interne Komponenten bleiben private Dateien.                                                                                             |
| `locales/de.json`, `locales/en.json` | Übersetzungen unter Plugin-Namespace, passende Schlüssel und definierter Fallback; keine automatische Übersetzung von Nutzerdaten.                                   |
| `assets/`                            | Öffentliche statische Bilder, Fonts und Vorlagen. Nur ausdrücklich veröffentlichte Dateien kopieren; stabile Plugin-Pfade, Größenbudget und Cache-Hashes beim Build. |
| `resources/index.ts`                 | Optionale fachliche Ressourcen wie Aufgaben: Validierung und verfügbare Operationen. Kein automatischer Datenbankzugriff oder generisches CRUD für jedes Modell.     |
| `contracts/index.ts`                 | Browsergeeignete Eingabe-/Ausgabeschemas und Typen, gemeinsam mit dem Server verwendbar; keine Datenbank- oder Auth-Implementierungen.                               |
| `client/index.ts`                    | Explizite UI-Slots, optionale Provider und Browser-Lebenszyklus.                                                                                                     |
| `server/index.ts`                    | Explizite Routen und Server-Lebenszyklus, auch ohne Frontend nutzbar.                                                                                                |
| `navigation/index.ts`                | Menü- und Seiteneinstiegspunkte, über Host-Router eingebunden; keine automatische Route für jede Komponente.                                                         |
| `server/services/index.ts`           | Fachliche Services und ausdrücklich exportierte Fähigkeiten für andere Plugins; keine Importe aus deren internen Dateien.                                            |
| `server/permissions.ts`              | Benannte Berechtigungen mit serverseitiger Durchsetzung; Zuordnung zu Rollen durch den Host, keine automatische Rechtevergabe.                                       |
| `server/data/index.ts`               | Modell-/Schema-Beiträge für den festgelegten Backend-Stack; Host erzeugt und validiert das Gesamtschema.                                                             |
| `server/migrations/`                 | Versionierte Datenmigrationen über ein gemeinsames Deployment-Verfahren, niemals automatisch bei einem Seitenaufruf.                                                 |
| `server/events/index.ts`             | Typisierte Ereignisse und Listener, mit explizitem Cleanup und definiertem Fehlerverhalten.                                                                          |
| `server/jobs/index.ts`               | Optionale Hintergrundjobs über einen Host-Scheduler; Wiederholbarkeit, Retry und Mandantenkontext ausdrücklich festlegen.                                            |
| `tests/`                             | Beitrags-, Integrations- und Mandantentrennungstests; kein Runtime-Einstiegspunkt.                                                                                   |
| `README.md`                          | Installation, benötigte Host-Fähigkeiten und Konfiguration für Anwender.                                                                                             |

`assets` meint öffentlich auslieferbare Dateien; `resources` meint fachliche Daten und Operationen. Private Uploads, Zugangsdaten oder mandanteneigene Dokumente gehören nicht in öffentliche Assets. Weitere Kategorien wie E-Mail-Vorlagen oder Webhooks können später über konkrete Server-Beiträge ergänzt werden; sie sind keine Voraussetzung für jedes Plugin.

Die zusätzlichen Pfade sind eine mögliche Konvention, keine verpflichtende Ordnerhierarchie. Für jede später unterstützte Kategorie gilt derselbe Mechanismus: Standardpfad oder expliziter Override in `entries`. Es gibt keine rekursive Registrierung beliebiger Dateien.

## Konfiguration im Pseudocode

```ts
// foundation.config.ts — Pseudocode; reine Build-Metadaten
export default defineFoundationPlugin({
  id: 'tasks',
  version: '1.0.0',
  foundation: '^1.0.0', // Beispiel für eine spätere kompatible Version
  dependencies: [], // andere benötigte Plugin-IDs samt Versionsbereich
  // Ohne entries gelten die Standard-Einstiegspunkte oben.
});

// Alternative: frei gewählte Ordner UND Dateinamen
export default defineFoundationPlugin({
  id: 'tasks',
  version: '1.0.0',
  foundation: '^1.0.0',
  entries: {
    actions: './features/task-actions.ts',
    settingsClient: './preferences/screens.ts',
    settingsServer: './preferences/storage.ts',
    components: './ui/public.ts',
    client: './browser/setup.ts',
    server: './backend/setup.ts',
    locales: { de: './translations/de.json', en: './translations/en.json' },
  },
});
```

Fehlender Standard-Einstiegspunkt bedeutet: kein entsprechender Beitrag. Ein ausdrücklich konfigurierter, aber fehlender Pfad ist dagegen ein Build-Fehler. `false` deaktiviert einen Einstiegspunkt ausdrücklich. Pfade müssen innerhalb des Plugin-Pakets liegen.

## Beiträge an vorhandene Schnittstellen

```ts
// actions/index.ts — Pseudocode
export function registerActions({ actionList, services, translate }) {
  const registration = actionList.register(new CreateTaskAction(services), {
    id: 'tasks.create', // im gesamten Root-ActionList eindeutig
    title: translate('tasks.create'),
    groups: ['tasks.toolbar'],
  });

  return {
    updateTranslations(t) {
      registration.update({ title: t('tasks.create') });
    },
    dispose() {
      registration.unregister(); // tatsächliche Handle-API bei Umsetzung abgleichen
    },
  };
}

// settings/client.ts — Pseudocode
export const sections = [
  defineSettingsContribution({
    parentSection: 'workspace', // muss im Host-Katalog existieren
    id: 'tasks.preferences',
    component: TaskPreferences,
  }),
];

// settings/server.ts — Pseudocode
export const definitions = [
  defineSetting({
    key: 'tasks.defaultView',
    schema: enumSchema(['list', 'board']),
    defaultValue: 'list',
    scope: 'user',
  }),
];

// components/index.ts — explizite öffentliche Exporte
export { TaskList } from './task-list';
export { TaskSummary } from './task-summary';

// client/index.ts — Pseudocode; Browsercode
export default defineClientContribution({
  slots: [{ slot: 'project.overview', component: TaskSummary }],
});

// server/index.ts — Pseudocode; ausschließlich Servercode
export default defineServerContribution({
  routes: [
    {
      method: 'GET',
      path: '/tasks', // Host bindet unter /api/plugins/tasks ein
      async handle(ctx) {
        const membership = await ctx.requireActiveMembership();
        return ctx.services.tasks.listForOrganization(membership.organizationId);
      },
    },
  ],
});
```

Die Serverregistrierung der Setting-Definitionen ist Voraussetzung für Persistenz. UI-Registrierung allein erteilt weder Speicher- noch Datenzugriffsrechte. Der Host prüft Sitzung, aktive Mitgliedschaft und Berechtigungen; die Datenzugriffsschicht muss zusätzlich Mandantengrenzen durchsetzen. Bestehende Auth-Tabellen werden nicht über generische Plugin-CRUD-Routen veröffentlicht.

## Installation im Produkt und Build

```ts
// foundation.config.ts des konsumierenden Produkts — Pseudocode
export default defineFoundation({
  plugins: [{ package: '@example/tasks', enabled: true }],
});

// Build-Ablauf — Pseudocode
const plugins = resolveExplicitlyInstalledPlugins(productConfig);
validateIdsVersionsDependenciesAndEntryPaths(plugins);
rejectDependencyCyclesAndDuplicateContributionIds(plugins);

emitClientComposition(plugins); // Actions, Settings-UI, Slots, Übersetzungen
emitServerComposition(plugins); // Routen, Settings-Definitionen, Services
verifyNoServerImportsInClientGraph();
```

Die generierte Komposition verwendet die bestehenden Registrierungswege. Im aktuellen Projekt bleiben `src/actions/register.ts` und `settings/standard-settings.ts` die Integrationspunkte. Ein Plugin wird pro Host-Lebenszyklus einmal registriert; Cleanup verwendet die ursprünglichen Handles. Sprachwechsel aktualisieren Präsentation, ohne Actions oder laufenden Zustand neu zu erzeugen. Übersetzungen sind nach Plugin-ID namensräumlich getrennt.

Der Produktionsserver durchsucht keine Ordner pro Anfrage. Die Anwendung importiert statisch erzeugte Einstiegspunkte. Veröffentlichte npm-Pakete benötigen getrennte Client-/Server-Exports und ausgelieferte kompilierte Dateien; die Quellordner allein sind kein Installationsformat.

## Verwaltung und Grenzen der ersten Version

- Installation, Aktivierung und Abhängigkeiten werden zunächst in der Produktkonfiguration verwaltet und beim Build geprüft. Deaktivierung wird mit einem neuen Build wirksam.
- Eine spätere Verwaltungsoberfläche kann installierte Plugins, Versionen, Abhängigkeiten und Einstellungen anzeigen. Dynamisches Nachladen oder Hot-Uninstall ist ein gesondertes Design.
- Plugins sind vertrauenswürdiger Anwendungscode, keine Sandbox für fremden Code. Zugriffskontrollen für Endnutzer bleiben trotzdem erforderlich.
- Datenbankänderungen brauchen explizite, versionierte Migrationen. Importieren oder Deaktivieren eines Plugins führt keine destruktive Migration aus und löscht keine Daten.
- Optionale Providers werden vom Host kontrolliert zusammengesetzt. Es gibt weiterhin nur eine Root-ActionList und eine autoritative AppPreferences-Instanz.

## Ressourcen und Host-Fähigkeiten im Pseudocode

```ts
// resources/index.ts — Beschreibung, keine automatisch offene API
export const tasks = defineResource({
  id: 'tasks.task',
  input: createTaskSchema, // aus contracts/index.ts
  output: taskSchema,
  operations: {
    list: { permission: 'tasks.read' },
    create: { permission: 'tasks.create' },
  },
});

// server/index.ts — tatsächliche Implementierung und Autorisierung
export default defineServerContribution({
  requires: ['identity', 'organizations', 'database'],
  resources: [
    {
      definition: tasks,
      handlers: {
        async create(ctx, rawInput) {
          const member = await ctx.requireActiveMembership();
          await ctx.requirePermission(member, 'tasks.create');
          const input = createTaskSchema.parse(rawInput);
          const result = await ctx.services.tasks.create({
            organizationId: member.organizationId, // niemals vom Client übernehmen
            actorId: member.userId,
            title: input.title,
          });
          return taskSchema.parse(result); // explizite öffentliche Ausgabe
        },
        // list erzwingt dieselbe Mitgliedschaft und mandantengefilterte Abfrage.
      },
    },
  ],
});
```

Ein Plugin deklariert benötigte Host-Fähigkeiten und Plugin-Abhängigkeiten getrennt. Fehlende Pflichtfähigkeiten verhindern den Start mit einer konkreten Fehlermeldung. Zugangsdaten werden über serverseitige, validierte Host-Konfiguration injiziert; Settings-UI und Paketmanifest enthalten keine Secret-Werte.

Initialisierung folgt der geprüften Abhängigkeitsreihenfolge, Cleanup erfolgt umgekehrt. Scheitert eine Registrierung, werden bereits installierte Beiträge dieser Initialisierung zurückgenommen. Persistierte Daten werden dabei nicht gelöscht. Beiträge für dieselbe Route, dieselbe Action-ID oder denselben Setting-Schlüssel verursachen einen Fehler statt stiller Überschreibung. Logs enthalten Plugin-ID und Vorgang, aber keine Zugangsdaten oder ungefilterten personenbezogenen Inhalte.

## Nächster Entwurfsschritt

Ein kleines Tasks-Beispiel in einem zweiten konsumierenden Projekt ausprobieren: eine Action, eine Einstellung, eine UI-Komponente und eine mandantengebundene Backend-Funktion. Sowohl Standardpfade als auch abweichende Dateinamen demonstrieren. Erst danach die öffentliche API festlegen. Prüfkriterien: keine kopierte Foundation-Implementierung, keine Serverimporte im Browser, stabile Registrierung beim Sprachwechsel, vollständiger Cleanup und abgewiesene mandantenfremde Zugriffe.
