# Frontend-Plugins: implementierter Stand

Das Dashboard unter `/dashboard` zeigt dieselbe Invite-Action als Button und als automatisch ergänzten Dropdown-Eintrag. Die Einladung ist ausdrücklich lokal simuliert: keine E-Mail, keine Datenbankänderung. `error@example.com` demonstriert einen wiederholbaren Fehler.

## Wo ändern?

- `apps/web/foundation.config.ts`: Plugin-Ordner, Aktivierung und verfügbare Gruppen.
- `apps/web/src/plugins/users/actions/invite.form-action.ts`: Gruppe, Felder und Absenden.
- `apps/web/src/plugins/users/services/users.service.ts`: typisierter Demo-Service; hier kann später die bestehende, autorisierte API angebunden werden.
- `apps/web/src/plugins/users/locales`: Texte, mit App- und Sprach-Fallback.
- `apps/web/src/components/foundation/ui.tsx`: einmalige Zuordnung der vorhandenen Designsystem-Komponenten.

Der Formulardialog, Fehler-/Pending-Zustand, Registrierung und Cleanup liegen in `packages/core`. Die Dateierkennung und Typgenerierung liegen in `packages/next`. Actions bleiben in `packages/core/src/actions`; Settings bleiben unabhängig in `packages/app-preferences`. Die ursprünglichen Pseudocode-Dateien sind Entwürfe; maßgeblich sind jetzt die Paket-READMEs und die kompilierten APIs.

## Kleines Beispiel

```ts
// plugins/users/actions/invite.form-action.ts
import { defineFormAction } from '@bitakit/core';

export default defineFormAction({
  groups: ['userManagement.dropdownMenu'],
  requires: ['users'],
  fields: {
    email: { type: 'email', required: true },
  },
  submit: (values, { services }) => services.users.invite(values),
});
```

Die Datei ergibt `users.invite`. Der Button und das Menü verwenden dieselbe Action. Eine separate Setup-Datei wird dafür nicht benötigt.

```json
{
  "users": {
    "invite": {
      "title": "Benutzer einladen",
      "fields": { "email": "E-Mail-Adresse" },
      "success": "Einladung erstellt.",
      "failure": "Die Einladung konnte nicht erstellt werden."
    }
  }
}
```

Diese Texte werden automatisch zugeordnet. Fehlt eine Meldung, greift der allgemeine App-Text. Plugin- und App-Kataloge behalten ihren vorhandenen Fallback. Das echte Demo-Beispiel ergänzt ausdrücklich den Hinweis, dass keine Einladung versendet wird.

## Nur bei Bedarf überschreiben

```ts
export default defineFormAction({
  id: 'users.invite', // bleibt auch nach Verschieben der Datei stabil
  title: 'Person einladen',
  groups: ['userManagement.dropdownMenu'],
  requires: ['users'],
  fields: {
    email: { type: 'email', label: 'E-Mail', required: true },
  },
  submit: (values, { services }) => services.users.invite(values),
  success: ({ result, input }) => ({
    message: `Demo-Einladung ${result.invitationId} für ${input.email} erstellt.`,
  }),
  failure: ({ error }) => (error instanceof TypeError ? 'Bitte die Eingabe prüfen.' : undefined), // Standardmeldung
});
```

```ts
// Einzelne Optionen:
success: false,          // keine Erfolgsmeldung; Dialog schließt trotzdem
failure: false,          // keine Fehlermeldung; Dialog bleibt offen
closeOnSuccess: false,  // Dialog nach Erfolg offen lassen
conventions: false,     // ID und Titel ausdrücklich angeben
```

`conventions: false` ist auch zentral in `foundation.config.ts` möglich. Pro Action kann man es überschreiben. Die manuelle Registrierung über `setup` und `getGroup().attach()` bleibt verfügbar. Gruppen werden beim ersten Auftreten automatisch angelegt. Eine zentrale Liste ist optional; doppelte Action-IDs und ungültige Gruppennamen führen zu einem klaren Fehler. Erfolgsfunktionen erhalten den typisierten Rückgabewert, Fehlerfunktionen den ursprünglichen Fehler als `unknown`. Das Öffnen eines Dialogs löst keine Erfolgsmeldung aus.

## Verwendung und Grenzen

Actions verwenden nur `title` und `description` als gemeinsame Metadaten. Ist ein Wert in der aktuellen Übersetzung vorhanden, wird er aufgelöst; sonst erscheint er unverändert. Button, Menü, Dialogtitel und Absenden-Button verwenden denselben Action-Titel. Formularfelder behalten ihre eigenen fachlichen Beschriftungen über `label` oder die automatische Feldkonvention.

Optional ergänzt `dependsOn: ['users.manage']` eine Abhängigkeit von einer anderen Action in derselben Liste. Fehlt diese oder ist sie deaktiviert, wird auch die abhängige Action deaktiviert. Eigene Aktivierungsbedingungen bleiben erhalten. Mehrstufige Abhängigkeiten werden berücksichtigt; Zyklen bleiben deaktiviert, bis sie aufgelöst sind. Abhängigkeiten führen keine andere Action aus.

Die App behält genau einen Root-ActionProvider. Der FoundationProvider nutzt dessen Liste, statt sie zu ersetzen. Einfache React-Consumer können die Plugin-Konfiguration ausdrücklich übergeben und brauchen keinen Next-Adapter. Die Beispiel-App verwendet Next-Dateierkennung und next-intl. Ein TanStack-Adapter wird nicht ohne einen entsprechenden Consumer vorgetäuscht.

Der aktuelle Scanner unterstützt Actions, Services, Setup und Locales mit konfigurierbaren Pfaden. Komponenten bleiben normale React-Exporte. Settings werden weiterhin über den bestehenden SettingsCatalog integriert; kein zweiter Settings-Plugin-Loader. Asset-Publishing, automatische Seitenerzeugung, Backend-Plugins und dynamische Installation fremder Pakete bleiben spätere, separate Schritte.

## Prüfen

```sh
npm test
npm run check
npm run test:e2e --workspace @bitakit/web -- plugins.spec.ts
```

Typechecking erzeugt die Schemas und Plugin-Typen zuerst. Alle Tests arbeiten mit lokalen Demo-Beiträgen; E-Mail-Versand ist nicht Teil der Prüfung.

## App-Actions: Datei schreiben, UI anbinden

```ts
// foundation.config.ts — unabhängig vom verwendeten React-Framework
import { defineFoundation } from '@bitakit/core/discovery';
export default defineFoundation({ actions: { directory: './src/actions' } });
```

```ts
// src/actions/account/help.action.ts
import { defineURLAction } from '@bitakit/core';
export default defineURLAction({
  title: 'Hilfe',
  description: 'Hilfe öffnen',
  groups: ['account.menu', 'navigation.main'],
  href: '/help',
});
// Automatische ID: account.help. Optional explizit mit id überschreiben.
```

```tsx
<ActionButton action="account.help" />
// Oder alle Actions einer Gruppe:
<ActionMenu group="account.menu" label="Konto" />
```

Dateien mit `.action.ts`, `.form-action.ts` oder `.dialog-action.ts` (auch `.tsx`) exportieren genau eine Action als Default. Hilfsdateien werden nicht registriert. Titel, Beschreibung, Icon und Gruppen sind optional. Es braucht weder ein App-Plugin-Manifest noch eine manuelle Liste aller Actions. `actions: false` schaltet die automatische App-Erkennung aus.

Der Scanner und `watchFoundation` liegen im frameworkunabhängigen Einstieg `@bitakit/core/discovery`. Im Entwicklungsbetrieb wird die Importliste bei neuen, umbenannten oder gelöschten Dateien aktualisiert. Der Bundler lädt Änderungen neu; ein manueller Build ist nicht erforderlich. Bei Codeänderungen darf der Entwicklungs-Reload offene Dialoge zurücksetzen; ein normaler Sprachwechsel erhält den Zustand. Produktionsänderungen brauchen Build und Deployment. Für andere Bundler wird derselbe Scanner vor dem Build und sein Watcher während der Entwicklung angeschlossen; fertige Adapter gibt es derzeit nur für Next.js.

Bestehende Action-Klassen werden direkt als Default-Export erkannt und erst beim Aktivieren instanziiert. Eine separate Factory-Definition oder Wrapper-Datei ist nicht nötig. Für injizierte Services kann die Datei stattdessen eine Funktion exportieren, die eine Action zurückgibt; ihr `ActionEnvironment` enthält typisierte Services und den aktuellen Übersetzer. Metadaten stehen einmal auf der Action. Host-Services bleiben im Eigentum der App; die Foundation beendet nur selbst erzeugte Plugin-Services. Anmeldung, Settings und Organisationen behalten ihre vorhandene Implementierung.

## Einheitliche Formatierung

Prettier ist als feste Entwicklungsabhängigkeit eingerichtet. `npm run format` formatiert das Projekt; `npm run format:check` prüft den Stil. `.editorconfig` vereinheitlicht Einrückung und Zeilenenden. Generierte Dateien und gemischte Pseudocode-Skizzen werden ausgenommen. In WebStorm kann der lokale Prettier zusätzlich unter „Languages & Frameworks → JavaScript → Prettier“ beim Speichern aktiviert werden.

## Einheitliche Auswahl und Reihenfolge

Dateierkennung und Laufzeit sind getrennt: Der generische Generator erzeugt Imports; der Provider verwendet diese Konfiguration. Neue Dateien werden im Entwicklungsmodus über den Watcher erkannt. Für Produktion braucht es einen neuen Build.

Für `actions`, `plugins`, `interceptors` und `providers` am FoundationProvider gilt: keine Angabe übernimmt die generierte Auswahl, ein Array ersetzt sie und `[]` wählt nichts aus. Eine explizite Action-Liste ersetzt auch deklarative Plugin-Actions; Plugin-Services und Setup bleiben aktiv. Imperative Registrierungen sind weiterhin möglich und werden nicht heimlich entfernt.

```ts
// foundation.config.ts
export default defineFoundation({
  actions: {
    directory: './src/actions',
    overrides: { 'users.invite': { enabled: false } },
  },
  interceptors: { enabled: ['confirmation', 'audit'] },
  providers: { enabled: ['theme', 'widgets'] },
  plugins: { directory: './src/plugins', autoEnable: true },
});
```

Interceptor- und Provider-Dateien werden gefunden, aber erst durch die geordnete Auswahl aktiviert. Bei Providern steht der äußere Wrapper zuerst. Deklarierte Abhängigkeiten müssen vorher stehen; falsche Reihenfolgen und doppelte IDs ergeben klare Fehler. Die Beispiele oben verwenden illustrative Namen, die entsprechenden Dateien müssen existieren. Die Beispiel-App aktiviert derzeit ihren vorhandenen Organisations-Interceptor.

Die gemeinsame ActionList bleibt erhalten. Die Foundation entfernt beim Wechsel ihrer Konfiguration nur ihre eigenen Registrierungen. Host-Services und externe Registrierungen behalten ihre Besitzer. Arrays und Service-Objekte im React-Code stabil halten, damit normale Render-Vorgänge keine Neuinitialisierung auslösen.

## Plugin-eigene Ansichten und Settings

Ein Plugin darf seine Seitenkomponenten selbst enthalten. `views/**/*.view.tsx`
exportiert `defineView({ slot: 'dashboard.content', component: MyWidget })`.
Der Host setzt einmal `<PluginSlot name="dashboard.content" />` in sein bestehendes
Layout. Das Plugin ersetzt weder Dashboard noch Router. Ansichten erscheinen nach
dem Setup; das Entfernen des Plugins entfernt auch die Komponenten.

`setup({ services })` kann über den bestehenden Settings-Service eine Seite unter
einer vorhandenen Sektion registrieren und deren Entfernen-Funktion zurückgeben.
Das Demo-Plugin zeigt dies unter `src/plugins/demo`: ein Widget, eine Settings-Seite,
eine lokale Einstellung und Actions für Dashboard- und User-Menülinks. Die Einstellung
ist absichtlich nur im Speicher, ohne Datenbank oder zusätzliche Speicherung.

With `kinds: settingsDiscovery()` in `foundation.config.ts` and `appPreferencesPlugin` installed, a plugin
root may instead contain `settings/` (preference definitions), `sections/` (settings sections) and
`renderers/` (renderer descriptors). Discovery only emits imports; the Settings installers register
the values for that plugin and remove them with it. Stored values are never deleted on removal.
See `packages/app-preferences/README.md`.

```ts
// foundation.config.ts — false entfernt alle Beiträge dieses Plugins.
plugins: {
  directory: './src/plugins',
  autoEnable: true,
  overrides: { demo: { enabled: true } },
}
```

Alternativ ersetzt die explizite `plugins`-Liste am Provider die erkannten Plugins;
eine leere Liste aktiviert keine Plugins. Einzelne Actions lassen sich weiterhin
über `actions.overrides` steuern. Es gibt dafür keinen zweiten parallelen Schalter.

Die Dashboard-Browsertests benötigen eine angemeldete Testsitzung über
`PLUGIN_TEST_STORAGE_STATE` (Pfad zu einer lokalen Playwright-Storage-State-Datei).
Ohne diese Angabe werden sie übersprungen; die App enthält dafür weder eine
öffentliche Ersatzseite noch eine Umgehung der Anmeldung. Sitzungsdateien niemals einchecken.

## Plugin-Seiten mit eigener URL

Ein Plugin exportiert Seiten aus `pages/**/*.page.tsx`:

```tsx
import { definePage } from '@bitakit/core';
import { Overview } from '../components/overview';
export default definePage({ path: '/example/overview', component: Overview });
```

Die Discovery übernimmt diese Dateien automatisch; `entries.pages` kann den Standardpfad
ersetzen. Der Host bindet seinen Router einmal an `PluginPage` an:

```tsx
<PluginPage pathname={pathname} fallback={<p>Seite nicht verfügbar.</p>} />
```

Die Foundation kennt keinen bestimmten Router. Die Content-Demo nutzt eine gemeinsame
Catch-all-Route und behält ihren Workspace-Rahmen. Vorerst werden ausschließlich exakte,
kanonische Pfade aus Buchstaben, Zahlen, Bindestrichen und Unterstrichen unterstützt,
auch verschachtelt. Doppelte oder ungültige Pfade führen vor dem Mounten zu einem Fehler.
Dynamische Parameter sind noch nicht Teil dieses Vertrags. Host-Routen haben weiterhin
Vorrang; die App muss ihren freigegebenen URL-Bereich selbst festlegen.

Entfernte/deaktivierte Plugins liefern keine Seiten mehr. Die Fallback-Anzeige ist eine
Client-Ansicht, kein garantierter HTTP-404-Status. Eine URL-Action bleibt davon unabhängig:
Sie registriert einen Link, keine Seite.

Die Content-Demo rendert die aktuellen Actions ihrer beiden öffentlichen Menügruppen
`navigation` und `navigation2`. Andere Gruppen bleiben unplatziert, bis eine Oberfläche
sie ausdrücklich bindet. Die vom Nutzer kopierte Action `contents2.action.ts` bleibt
unverändert; ihr Link ist sichtbar, für `/contents2` existiert noch keine Seiten-Definition.

## Typisierte Action-IDs

Die Discovery erzeugt neben den Service-Typen eine `ActionMap`: Jede erkannte Definition trägt
ihre wirksame ID (`replaces`, sonst explizite `id`, sonst Dateipfad) mit Eingabe- und Ergebnistyp
ein. `useAction('users.invite')`, `list.execute(...)` und `ActionButton` vervollständigen bekannte
IDs und typisieren `input` sowie das Ergebnis `value`. Unbekannte IDs bleiben erlaubt und untypisiert;
`ActionMapOptions` mit `{ strict: true }` erweitern, um sie abzulehnen. Klassen- und
Funktions-Exports legen ihre ID erst beim Erzeugen fest und erscheinen deshalb nicht automatisch;
bei Bedarf `ActionMap` manuell erweitern. Typen ersetzen keine Laufzeitvalidierung.

```ts
export default defineAction<boolean>({
  execute: ({ input, services }) => services.demoPreferences.setEnabled(input),
});
// useAction('demo.enabled')?.execute(true) ist typisiert; execute('ja') ist ein Typfehler.
```

Klassen-Actions erhalten den Aufrufkontext als zweiten Parameter (`execute(input, context)`) und
dürfen `success`/`failure` als Felder deklarieren; ohne diese bleibt der Fehler roh und es gibt keine
Erfolgsmeldung. Die Formular-Registrierung `<id>.submit` ist `internal`: ausführbar, aber nicht in
`useActions()` oder Gruppenansichten sichtbar.

## Gezielte App-Overrides

Eine automatisch erkannte App-Action kann eine Plugin-Action ausdrücklich ersetzen:

```ts
// src/actions/custom-invite.action.ts
export default defineFormAction({
  replaces: 'users.invite',
  fields: { email: { type: 'email', required: true } },
  submit: ({ email }, { services }) => services.users.invite(email),
});
```

Der Zielname bleibt die öffentliche Action-ID. Titel, Beschreibung, Icon,
Reihenfolge und Gruppen werden übernommen, soweit die App sie nicht angibt.
`groups: []` entfernt die bisherigen Platzierungen ausdrücklich. Die Ausführungslogik,
Validierung, benötigten Services und Guards definiert die Ersatz-Action selbst;
Berechtigungsprüfungen auf dem Server bleiben unverzichtbar.

Nur App-Actions dürfen ersetzen. Fehlende Ziele, doppelte Ersetzungen und doppelte
Plugin-IDs melden Fehler. Das Ziel muss vor der Instanziierung eine bekannte ID haben
(Dateierkennung oder explizite Definition); eine erst im Konstruktor gesetzte Klassen-ID
reicht nicht. Die Ersetzung wird vor der Registrierung ausgewählt, kein temporäres
Registrieren und anschließendes Überschreiben. Entfernt man den Override, gilt wieder
die Plugin-Definition. Die vollständige `actions`-Liste am Provider ersetzt weiterhin
alle Actions und ist keine Liste zusätzlicher Overrides.

Im Content-Beispiel hat eine explizite App-Route Vorrang vor der generischen Catch-all-
Route. Ein Plugin kann keine explizite Host-Route überschreiben. Zwei Plugin-Seiten
mit gleichem Pfad bleiben ein Fehler. Andere Routeradapter müssen diese Priorität
entsprechend umsetzen; TanStack wurde dafür noch nicht implementiert oder getestet.
