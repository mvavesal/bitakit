# Dateibasierte Beiträge und Config

## Verbindlicher Stand

Core erkennt Actions, Services, Interceptors und Config über dieselbe Dateipfad-Normalisierung. Die Node-Discovery generiert statische Imports; sie führt Beitragscode nicht aus. App-/Plugin-Manifeste und die Build-Konfiguration werden dagegen geladen und müssen vertrauenswürdig sein.

```text
actions.refresh.ts             = actions/refresh.ts
services.logging.ts            = services/logging.ts
interceptors.log.ts            = interceptors/log.ts
configs.actions.refresh.ts     = configs/actions/refresh.ts
actions.documents.publish.ts   = actions/documents/publish.ts
                               = actions/documents.publish.ts
```

Der erste Abschnitt bezeichnet die Beitragsart. Weitere Punkte und Ordner sind gleichwertige Pfadsegmente. `index.ts` bezeichnet die Sammlung am Elternpfad, etwa `actions/index.ts` = `actions.ts`. Bestehende Suffixe wie `refresh.action.ts`, `invite.form-action.ts` und `logging.service.ts` bleiben Migrationsaliase; `index.action.ts` bleibt ausdrücklich eine Action namens `index`.

Nur TypeScript-/TSX-Dateien mit Default-Export werden importiert. Der TypeScript-Parser erkennt diese Exporte, ohne die Module auszuführen. Hilfsdateien ohne Default-Export sowie Pfadsegmente mit führendem `-` werden nicht registriert. `.d.ts` und `server`-Pfadsegmente sind ausgeschlossen. Diese Erkennung ersetzt keine Prüfung transitiver Imports durch das jeweilige Framework: Ein Client-Beitrag darf weiterhin keinen Server-Code importieren. Es gibt noch keine generische Server-Discovery.

Each immediate folder under `src/plugins` defines a local plugin; `plugin.config.ts` is optional and overrides the inferred folder ID. Explicit nested plugin manifests retain their own boundaries. Symlinks are rejected. `foundation.config.ts` can customize the plugin root and explicit directories. Public service names use the relative service path or explicit ID, while internal service keys retain their module namespace.

## Modul und IDs

```ts
// src/plugins/content/plugin.config.ts
export default { id: 'content' };
```

`actions.refresh.ts` erzeugt `content.refresh`; `services.logging.ts` erzeugt `content.logging`. Explizite Action-/Service-IDs bleiben vorrangig, insbesondere geteilte `serviceKey`-Verträge. Bei Services ohne explizite ID kann `defineService({ create })` verwendet werden. Manuelle Plugin-Registrierung benötigt weiterhin vollständige Service-Definitionen mit ID.

Auch die App verwendet dieselben Beiträge unter `src` (änderbar mit `directory`). Mit `src/plugin.config.ts` und `{ id: 'app' }` entstehen IDs wie `app.refresh`. Ohne App-Manifest bleiben bestehende App-IDs ohne Präfix erhalten; ihr Config-Modul heißt intern `@foundation/app`. Das optionale App-Manifest legt derzeit die Modul-ID fest; Host-Auswahl und Verzeichnisse werden weiterhin in `foundation.config.ts` konfiguriert.

Eine explizite Action-ID verändert nicht den entdeckten Config-Pfad. Bei manueller Registrierung ohne Discovery kann `configPath: ['refresh']` den lokalen Pfad vorgeben; andernfalls werden die Segmente der expliziten ID verwendet. Eine registrierte globale ID wird niemals zur nachträglichen Ermittlung eines Plugin-Präfixes zerlegt.

## Sammlung oder Einzeldateien

```ts
// actions.ts
export default {
  refresh: defineAction({ execute: () => 'refreshed' }),
  publish: defineAction({ execute: () => 'published' }),
};
```

Dies entspricht zwei Dateien `actions.refresh.ts` und `actions.publish.ts`. Verschachtelte Sammlungen sind erlaubt. Services verwenden Definitionen mit `create`, Interceptors `before` oder `create`. Ein direkt exportierter Interceptor-Handler wird als `before` normalisiert. Eine Action-Funktion bleibt entsprechend der bestehenden API eine Factory, die eine `Action`-Instanz zurückgibt; sie wird nicht als Execute-Handler interpretiert. Klassen bleiben `Action`-Unterklassen.

Die Define-Helfer bleiben sinnvoll für Callback-Typen und besondere Action-Funktionen. Ein einfaches Action-Objekt mit `execute` wird auch ohne Helper normalisiert. Nicht jede Beitragsart unterstützt jede Exportform; reine Config-Klassen und Decorators sind noch nicht implementiert.

Sammlungen und Einzeldateien dürfen unterschiedliche Einträge liefern. Doppelte logische Einträge sind Fehler, auch wenn die Schreibweisen verschieden sind. Fehler nennen die Quellen. Config-Teilbäume werden zusammengefügt; derselbe Blattwert oder ein Skalar anstelle eines Teilbaums darf nicht zweimal definiert werden. Absichtliche Overrides sind ein eigener Schritt.

## Konfiguration und Nutzung

```ts
// configs.ts
export default {
  pageSize: 20,
  actions: {
    refresh: { pageSize: 50 },
    publish: { pageSize: 5 },
  },
};
```

Alternativ enthalten `configs.actions.refresh.ts` und `configs.actions.publish.ts` die jeweiligen `{ pageSize }`-Objekte. `configs.ts` enthält dann nur den allgemeinen Wert. `configs.refresh.ts` ist ausdrücklich ein anderer Pfad: `refresh`, nicht `actions.refresh`.

```ts
// actions.refresh.ts
import { defineAction } from '@bitakit/core';
export default defineAction({
  execute({ config }) {
    return {
      shared: config.plugin.get('pageSize', 20),
      own: config.action.get('pageSize', 50),
    };
  },
});

// services.logging.ts
import { defineService } from '@bitakit/core';
export default defineService({
  create({ config }) {
    const pageSize = config.plugin.get('pageSize', 20);
    return { pageSize };
  },
});
```

Der Plugin-Scope zeigt auf die aufgelöste Modul-Konfiguration. Der Action-Scope zeigt auf `actions.<lokaler Action-Pfad>` desselben Baums. Es gibt keinen impliziten Fallback zum allgemeinen Plugin-Wert und keinen globalen „current action“-Zustand. Beide Scopes werden auch an Action-Factories und Klassen-Konstruktoren über `ActionEnvironment` übergeben. Dienste erhalten den Plugin-Scope bei `create`. Config wird vor dem Erzeugen der Services aufgelöst.

`get('actions.refresh')` kann einen kompletten Teilbaum liefern. Ein Segmentarray adressiert literal benannte Schlüssel. Standardmäßig ist ein unbekannter Zugriff `unknown`; ein Fallback liefert einen nutzbaren Typ, stellt aber keine Laufzeitvalidierung dar. Für eine ausdrücklich typisierte Sicht gibt es `ConfigScope<T>` beziehungsweise `runtime.configuration.plugin<T>(id)`.

Discovery erzeugt `ConfigMap`, `ServiceMap` und `ActionMap` auch für Sammlungen. `runtime.configuration.plugin('content')` erhält dadurch den entdeckten Config-Typ. Die automatische Runtime-Zuordnung typisiert jedoch nicht magisch den Parameter einer frei exportierten Funktion. Hier weiterhin Helfer oder Annotationen verwenden. Klassen-/Factory-Action-IDs werden wie bisher nicht automatisch in die `ActionMap` aufgenommen.

## Overrides und optionale Schemas

```ts
// foundation.config.ts (Build-Komposition)
export default {
  configOverrides: {
    content: { actions: { refresh: { pageSize: 100 } } },
  },
};
```

Dasselbe Feld ist bei manueller `FoundationConfig` verfügbar. Objekte werden rekursiv überschrieben, Arrays ersetzt und `undefined` übernimmt den Default. `null` ist ein ausdrücklicher Wert. Nur Config-Overrides, nicht doppelte Quelldefinitionen, verwenden diese Regel. Unbekannte Modulnamen in Overrides werden abgewiesen. Discovery und `resolveFoundationConfig` entfernen Overrides bekannter deaktivierter beziehungsweise abgewählter Plugins zusammen mit deren Beiträgen.

```ts
// configs.actions.refresh.ts
import { defineConfig } from '@bitakit/core';
import { z } from 'zod';

export default defineConfig({
  schema: z.object({ pageSize: z.number().int().positive().default(50) }),
});
```

Schema-Bibliotheken bleiben optional beim Verbraucher. Core akzeptiert einen synchronen `parse(unknown)`-Vertrag und ruft ihn auf den zusammengeführten Werten auf. Eine Root-Schema-Definition muss die vollständige Config besitzen; sie wird nicht zusätzlich mit Config-Dateien zusammengesetzt. Alternativ können einzelne Teilbäume eigene Schemas tragen. Ein Validierungsfehler verhindert Service-Erstellung und Action-Registrierung.

Config ist ein eingefrorener Snapshot pro Runtime, für Plain Objects, Arrays und primitive Werte. Keine Laufzeit-Schreib-API, keine automatische Service-Neuerstellung. Der React-Hook `usePluginConfig(moduleId, path[, fallback])` liest denselben Snapshot und erhält bei Austausch der Provider-Komposition einen neuen Stand; er verspricht keine Updates durch Mutation. Implizites `useConfig` ohne Modul-Kontext wird noch nicht angeboten. Bestätigte Benutzerpräferenzen gehören weiter zu `AppPreferences`.

## Interceptors

Plugin-Interceptors gelten standardmäßig nur für registrierte Actions ihres Plugins, einschließlich interner Formular-Submits. `scope: 'global'` erweitert dies ausdrücklich. Host-Interceptors bleiben aus Kompatibilitätsgründen standardmäßig global; `scope: 'plugin'` begrenzt sie auf das App-Modul. `before` bekommt den Config-Scope der ausgeführten Action. Factory-`create` bekommt den Scope des besitzenden Moduls.

`order` sortiert aufsteigend; Gleichstände behalten die Registrierungsreihenfolge. Fachlich notwendige Reihenfolgen ausdrücklich angeben. App-Discovery aktiviert ohne `interceptors.enabled` alle erkannten Interceptors; ein angegebenes Array wählt sie ausdrücklich aus, `[]` deaktiviert sie. Vorhandene Listen bleiben erhalten. React-Provider werden weiterhin über eine explizite `enabled`-Liste ausgewählt.

## Interne Erweiterungspunkte

- `discovery/entries.mjs`: eine Dateierfassung, ein Pfad-Normalisierer, Default-Export-Erkennung für alle Arten.
- `discovery/generate.mjs`: Komposition der Module und statische Imports/Typen.
- `src/discovered.ts`: Sammlungen auflösen und in vorhandene Verträge normalisieren.
- `src/config-service.ts`: Auflösung, optionale Schemas und unveränderliche Scopes.
- `src/contributions`: bestehende Action-Adapter; sie erhalten den zugeordneten Config-Kontext ausdrücklich.
- `src/runtime.ts`: Lebenszyklus und Integration, kein Dateiscanner.

Für weitere Arten den Kind-Katalog, Normalisierung und Generierung erweitern, nicht erneut Dateien durchsuchen. Ein öffentliches dynamisches Adapter-Plugin-API ist noch nicht implementiert. Pages und Views verwenden dieselbe Pfaderkennung, behalten aber ihre bisherigen Einzeldefinitionen; Sammeldateien sind dafür noch nicht vorgesehen.

Zurückgestellt: Decorators, YAML, Remote-Konfiguration, reaktive Config-Updates und automatische UI-Bindungen, Server-Discovery, sowie Co-Location wie `actions/publish/action.ts` plus `config.ts`. Unter der aktuellen Grammatik hätten diese Dateien gewöhnliche zusätzliche Pfadsegmente; sie sind keine Spezialkonvention.

## Prüfung und Migration

`npm test --workspace @bitakit/core` prüft Runtime, Typverträge, Isolation, Config und die gemeinsame Discovery. Die Tests im Next-Paket prüfen weiterhin Generator- und Watcher-Integration. Vor der Migration vorhandene Hilfsdateien mit Default-Export aus Beitragsordnern verschieben oder mit `-` ausschließen. Alte Suffix-Dateien und neue äquivalente Pfade dürfen nicht gleichzeitig denselben Beitrag definieren. Automatisch erzeugte IDs ändern sich nur bei einer Änderung des logischen Pfads.

## Root application lifecycle

The root application may declare dependencies and metadata in src/plugin.config.ts. Its discovered pages and views are rendered alongside plugin contributions. Root setup.ts participates in dependency ordering and reverse cleanup. The app is not listed as a removable plugin and does not require a nested plugins directory. Root page/view support is an optional runtime capability, not a recommendation to replace host routing. In Next.js, app-owned pages and layouts use src/app/**/page.tsx and layout.tsx. Only independent plugin pages use Discovery through the host catch-all; do not create root pages.*.tsx files for app routes.

## Direct configuration access

`app.config.documents.editor.pageSize` reads the existing immutable module snapshot.
A config file may export `defineConfig({ defaults: { pageSize: 20 } })` without a schema.
Schemas remain optional. Scoped callback access and runtime.configuration are unchanged.

## Mixed interceptor collections

`interceptors/` accepts Action and Service definitions in one default export, including named
object collections and arrays. `interceptors/actions/save.ts` and
`interceptors/actions.save.ts` have the same organizational path; it does not determine the kind.
Use defineActionInterceptor or defineServiceInterceptor to set that discriminator automatically.
The legacy defineInterceptor remains an Action definition. Service observers can select one method
or all methods; see the Core README for lifecycle and observation boundaries.

## Inline service names

`defineService({ exposeAs: 'clock', create: ... })` and
`provideService(clockKey, { exposeAs: 'clock', create: ... })` expose the same container
instance through `app.services.clock`. Omit `exposeAs` in ordinary discovered files:
Core uses the explicit service ID or relative file path. An explicit name changes only
the app facade, not the internal module-scoped key used by `requires` and factory contexts.

Generated hosts carry this name on each service definition instead of emitting a separate
`publicServices` map. Runtime name resolution and collision checks are shared with manual
composition. Existing public mappings and `discoverPublicServices` remain compatible.
Generated and manual plugin types infer inline names, including dotted namespaces.
