---
name: foundation-development
description: Entwickle oder prüfe SaaS-Foundation-Packages, Beispiel-Apps, Actions, Plugins und Integrationen in diesem Repository anhand der vereinbarten Architektur und der bisher gefundenen Integrationsfehler.
---

# Foundation-Entwicklung

Ziel: eine dünne Host-App und eigenständige Plugins. Gemeinsame Mechanismen gehören
in die Packages. Dieser Leitfaden ergänzt die Regeln der jeweiligen `AGENTS.md`.
Er gilt für dieses Foundation-Projekt, nicht pauschal für andere Anwendungen.

## Erst den Auftrag richtig einordnen

- Analyse, Zukunftsidee oder „ab nächstem Mal“ bedeutet nicht automatisch sofort umbauen.
- Bereits autorisierte Arbeit ausführen; nicht dieselbe Zustimmung mehrfach abfragen.
- In Sprachgesprächen kurz antworten. Auf Wunsch nach Code oder Links diese tatsächlich sichtbar ausgeben, nicht nur vorlesen oder ihre Anzeige behaupten.
- Änderungen, laufende Prüfungen und abgeschlossene Ergebnisse unterscheiden. Einen Erfolg nur nach tatsächlicher Prüfung melden.

## Actions: Erkennung ist nicht Darstellung und nicht Routing

Die Kette ist: Datei → Discovery → Registrierung → Gruppenplatzierung → reaktiver
Renderer → vorhandenes Navigationsziel. Bei fehlenden Einträgen jede Stufe prüfen.

- Action-Dateien nach bestehender Konvention erkennen; keine manuelle zentrale Liste einzelner Actions nachbauen.
- IDs aus Plugin und Pfad ableiten, soweit die bestehende API dies unterstützt; explizite IDs bleiben möglich. Doppelte IDs sind Fehler.
- Ein erweiterbares Menü rendert die aktuellen Mitglieder seiner Action-Gruppe über Package-Bindings. Keine fest kodierte Liste einzelner Action-IDs als Ersatz für eine Gruppenbindung.
- Eine neu benannte Gruppe wird nicht allein durch ihre Existenz an beliebiger Stelle sichtbar. Der Host muss festlegen, welche Gruppen an welcher Oberfläche erscheinen. Diese Regel transparent halten; nicht alle internen Gruppen ungeprüft veröffentlichen.
- Die Gruppenangabe des Nutzers nicht stillschweigend ändern, nur damit ein Test funktioniert.
- Eine URL-Action erzeugt keine Seite. Ein Hash springt zu einem Bereich; ein eigener Pfad benötigt eine Route oder eine tatsächlich implementierte generische Plugin-Seitenanbindung.
- Navigation als echte Links rendern. Sichtbarkeit, deaktivierter Zustand und aktuelle Texte aus dem Action-Snapshot beziehen. Metadaten nicht in der UI duplizieren.

**Konkreter Fehler, den es zu vermeiden gilt:** Eine automatisch erkannte zweite
Content-Action blieb unsichtbar, weil das Beispielmenü drei feste Action-IDs
renderte. Zusätzlich hatte die Kopie eine andere Gruppe und einen neuen Pfad.
Diese drei Ursachen getrennt erklären und beheben; Discovery allein beweist keine
vollständige automatische Menüintegration.

## Plugin-Eigentum und Aufräumen

- Fachkomponenten, Fachservices, Actions und Plugin-Texte gehören zum Plugin.
- Der Host stellt gemeinsame Slots, Routing-Rahmen, Designsystem und Konfiguration bereit; keine besondere App-Seite pro Plugin erforderlich machen, wenn die generische Anbindung das Ziel ist.
- Plugin-Einstellungen über den vorhandenen Settings-Katalog registrieren. Allgemein relevante Einstellungen können gezielt in eine passende Kategorie eingebunden werden: Die Content-Demo ordnet Layout und Farbschema unter Darstellung ein, die ältere Web-App weiterhin unter Mein Konto; das Shell-Plugin übernimmt die Host-Kategorie. Die Plugin-Detailseite verlinkt denselben Beitrag über pluginId, ohne zweite Registrierung.
- Untergruppen nur bei echtem Bedarf ergänzen. Kleine Plugins benötigen eine einfache Seite.
- Registrierung, Subscriptions und Cleanup durch die vorhandene Runtime verwalten. Keine wiederholten Connect/Sync/Unsubscribe-Blöcke pro Action, wenn eine gemeinsame Bindung sie abdecken kann.
- Beim Deaktivieren/Entfernen müssen Ansichten, Actions, Menülinks und Settings-Beiträge verschwinden. Keine hart kodierten Host-Links auf entfernte Beiträge übrig lassen.
- Ersetzte Demo-Seiten und veraltete Verweise beim Umbau mit entfernen. Tests auf den neuen Ablauf umstellen, nicht eine veraltete öffentliche Seite allein für Tests behalten.

## Verbindlich: Standardlösungen statt Eigenentwicklung

Vorhandene Standardkomponenten und etablierte Bibliotheken verwenden. Keine verfügbare Funktionalität selbst nachbauen. Wenn eine eigene Lösung, Erweiterung oder zusätzliche Validierungsregel nötig wäre, zuerst die konkrete Lücke und Alternativen erklären und ausdrückliche Nutzerzustimmung einholen. Nicht eigenmächtig implementieren. Normale Konfiguration und Anbindung vorhandener Bibliotheken bleibt erlaubt; Produktregeln nicht selbst erfinden. Diese Nutzerentscheidung gilt insbesondere für Formulare, Validierung, UI und Infrastruktur.

## Schlanke APIs und Paketgrenzen

- Normale Nutzung: definieren, erkennen lassen, binden. Zusätzliche Factory-/Wrapper-Dateien nicht für jede Action verlangen.
- Titel und Beschreibung einmal definieren; Button, Menü und Dialog verwenden diese Grundlage. Nicht zusätzlich label/titleKey/descriptionKey für denselben Zweck verlangen.
- Bestehende Übersetzungsauflösung und Settings-Autorität verwenden. Keine zweite Präferenz-, Session- oder Übersetzungsverwaltung einführen.
- Automatische Auswahl und explizite Listen folgen den bestehenden Regeln: ausgelassen übernimmt die Konfiguration, Array ersetzt den Bereich, leeres Array deaktiviert den Bereich. Interceptor-/Provider-Reihenfolgen und Abhängigkeiten beachten.
- Ein Plugin darf mehrere zusammengehörige Funktionen enthalten. Nicht behaupten, jede Funktion sei ein separates Plugin, wenn der Code sie bündelt.
- Packages stellen Infrastruktur bereit; fachlicher Plugin-Code ist weiterhin nötig. „Alles nutzt die Foundation“ bedeutet nicht „kein eigener Code“.
- Anbieter-Anbindungen sind normale Plugins und verwenden den vorhandenen Service-Mechanismus. Konkrete Anbieter bleiben optional. Eine Auth-Integration für Sitzung/Abmelden macht Organisationsverwaltung nicht automatisch anbieterunabhängig.

## UI von Anfang an

- Verbindlich: Immer vorhandene zentrale UI-Komponenten und die zentralen Theme-Vorgaben verwenden. Karten, Rahmen, Radius, Abstände und Typografie dürfen keine lokalen/custom Stilabweichungen erhalten. Eigene visuelle Anpassungen nur auf ausdrücklichen Nutzerauftrag; autorisierte Anpassungen möglichst zentral umsetzen. Wenn die zentralen Komponenten nicht ausreichen, keine selbst erfundene visuelle Sonderlösung stillschweigend hinzufügen, sondern die konkrete Lücke benennen. Die Wiederverwendung vorhandener Komponenten erfordert keine erneute Bestätigung.

- Für neue Oberflächen sofort die vereinbarten shadcn/Radix-Vega-Komponenten, vorhandenen Varianten, Theme-Tokens und Reicon-Icons verwenden.
- Keine schnell selbst gestylten Ersatzbuttons, Dialoge, Sidebar, Badges oder Tabellen liefern und erst nach Kritik auf das Designsystem wechseln.
- Custom-Rendering bedeutet Komposition vorhandener zentraler Komponenten, keine eigene visuelle Primitive oder zweite Designsprache. Fehlende Fähigkeiten konkret benennen und im autorisierten Umfang möglichst als kleine zentrale Erweiterung ergänzen; keine lokalen Border-/Shadow-/Radius-/Farb-Overrides als Ersatz.
- Filter, Tabellen und Statusanzeigen verwenden gemeinsame Muster und semantische Theme-Varianten. Status durch verständlichen Text und bei Bedarf zugängliche Icons/Badges vermitteln, niemals nur durch Farbe. Lade-, Leer-, Fehler- und Pending-Zustände gehören zur betroffenen Oberfläche; keine sachfremde Neugestaltung daraus ableiten.
- Externe UI über öffentliche Konfiguration, Theme-Schnittstellen und exportierte Bausteine integrieren. Upstream-Code zum Verständnis lesen, aber nicht kopieren, vendoren oder patchen. Nur notwendige eigene Integrationskomponenten ergänzen; Grenzen öffentlicher APIs benennen, statt mit privaten Imports oder fragilen DOM-Eingriffen zu umgehen.
- Bei folgenreichen Aktionen eine dem Risiko angemessene Bestätigung vor der Mutation vorsehen: Ziel und Konsequenz klar benennen, Abbruch ohne Mutation, Schutz vor Mehrfachausführung, verständliche Fehler und Aktualisierung nach Erfolg. Keine pauschalen Dialoge für jede harmlose Aktion. Nach asynchroner Bestätigung relevanten Kontext erneut prüfen; Server-Autorisierung bleibt verbindlich.
- UI-Konsistenz ist ein Abnahmekriterium: betroffene Oberflächen auf zentrale Komponenten-/Theme-Nutzung, Tastaturbedienung, schmale Ansichten und unterstützte Farbschemata prüfen. Einen erfolgreichen Build nicht als visuelle Prüfung darstellen.
- Die shadcn-Anleitung bei entsprechender Arbeit lesen; vorhandene angepasste Komponenten erhalten. Layout, Abstände, Zugänglichkeit und mobile Darstellung prüfen.
- Eine kleine Demo darf wenig Funktionen haben, aber keine nachlässige UI. Nicht benötigte Funktionen weglassen oder klar als nicht verbunden kennzeichnen.
- Responsive Verhalten ist für jede neue oder geänderte Oberfläche verpflichtend: Navigation, Filter, Tabs, Tabellen und Pagination auf schmalen, mittleren und großen Ansichten prüfen, einschließlich langer ungetrennter Inhalte und fehlender Bilder. Kein horizontaler Überlauf der gesamten Seite; notwendiges Tabellen-Scrolling im Tabellencontainer halten. Bestehende zentrale responsive Muster wiederverwenden.
- Bei ausdrücklich lokalen Beispielen Anmeldung, Einladungen und Tokens nicht als echt darstellen. Keine neuen Datenbankzugriffe nur für eine Demo einführen.

## Prüfung passend zum Auftrag

- Better-Auth-UI-Theme: destruktive HeroUI-Buttons in die zentrale Primary-Oberflächenanbindung einbeziehen (mit destruktiver Farbe); Karten-Trennlinien einheitlich auf die solide Foundation-Border abbilden. Kleine Buttons verwenden Vega-sm-Maße. Bei bündigen Listen-Karten mit bereits gepolsterten Zeilen und Footer darf kein zweites äußeres Padding bleiben; Trennlinien müssen bis an den Kartenrand reichen. Abstände und Linienbreite ausdrücklich mitprüfen, nicht nur Farbe und Radius. Light/Dark und schmale Ansichten prüfen, ohne echte Sitzungen abzumelden. Inline-Tailwind-Tokens sind nicht zwingend Laufzeit-CSS-Variablen; Radius-Prüfungen gegen den definierten Ausdruck durchführen.

- Content-Demo konfiguriert Better Auth UI mit `multipleAccountsPerProvider: false`: Ist Google bereits verknüpft, keine zweite Google-Verknüpfungszeile anbieten. Das ist eine UI-Vorgabe, keine zusätzliche serverseitige Kontenbegrenzung; bestehende Verknüpfungen werden nicht gelöscht.

- Das Better-Auth-UI-Plugin registriert bei aktiviertem `accountSettings` „Profil“ und „Sicherheit“ als eigene Katalogseite `/settings/security` unter Mein Konto und komponiert die öffentlichen Bausteine `ChangeEmail`, `ChangePassword`, `LinkedAccounts` und `ActiveSessions` im gemeinsamen Rahmen. API-Schlüssel gehören auf Nutzerwunsch nicht auf diese Seite; die API-Key-Funktion und der separate Komponentenkatalog bleiben bestehen. Ohne echte Sitzung nur den Anmeldeeinstieg anbieten. Profil und Sicherheit dürfen nicht über interne Better-Auth-Tabs zum Demorahmen wechseln.

- Das echte Kontomenü der Content-App öffnet `/settings/profile` im gemeinsamen SettingsShell. Dazu die öffentliche UserButton-Konfiguration `hideSettings`/`links` verwenden. Der Eintrag heißt „Profil“ unter „Mein Konto“. Die plugin-eigene Profilseite komponiert bei echter Sitzung ausschließlich die öffentliche `UserProfile`-Komponente; der lokale Demo-Einstieg behält sein Demo-Profil. E-Mail ändern gehört auf die Sicherheitsseite, Kontenwechsel und Abmelden bleiben im echten Kontomenü über das Multi-Session-Plugin. Keine zusätzliche Kontenverwaltungskarte auf der Profilseite. In der installierten HeroUI-Version ignoriert `Settings` das dokumentierte `hideNav` und rendert weiterhin Tabs zu Demo-Routen. Deshalb für eingebettete Inhalte die öffentlichen Fachkomponenten statt versteckender CSS-Eingriffe oder Upstream-Patches verwenden. Den Better-Auth-Komponentenkatalog nicht als regulären Einstellungen-Einstieg verwenden.

- Bei getrenntem UI- und Auth-Origin muss das Better-Auth-UI-Weiterleitungsziel eine absolute URL zum UI-Origin sein. Ein relatives `/contents` landet nach OAuth sonst auf dem Auth-Server. Den ausgehenden Social-Login-Request auf die tatsächliche `callbackURL` prüfen; Tests mit einem gleich-originigen Memory-Backend entdecken diesen Integrationsfehler nicht.

- Content-Demo: Erfolgreiche Better-Auth-Anmeldung/Registrierung führt nach `/contents` in die AppShell. Der Workspace liest die echte Sitzung über den gemeinsamen `authService`, ohne sie in `workspace.signedIn` zu spiegeln; dieses Flag gehört ausschließlich zum lokalen Demo-Einstieg. Bei echter Sitzung das Better-Auth-Kontomenü anzeigen. Inhalte bleiben lokale Beispieldaten. Organisationen authentifizierter Benutzer kommen über den Better-Auth-Adapter aus dem Server; nur der ausdrücklich lokale Demo-Einstieg verwendet Demo-Organisationen. Den Übergang und Neuladen mit einer echten isolierten Better-Auth-Testinstanz prüfen.

- Google-Login der Web-App wird serverseitig nur bei gesetzter `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET` aktiviert. Beide gehören in die ignorierte lokale Umgebung, nie in den Client. Die Content-Demo nutzt denselben Auth-Dienst über ihren API-Proxy; OAuth-Callbacks müssen daher zur konfigurierten Auth-Basis-URL passen. Eine erfolgreiche Weiterleitung zu Google ersetzt noch keinen abgeschlossenen Login mit Nutzerzustimmung. GitHub wird analog nur bei gesetzter `GITHUB_CLIENT_ID` und `GITHUB_CLIENT_SECRET` aktiviert; der lokale Callback verwendet den bestehenden Auth-Origin. Ein sichtbarer Button allein beweist keine Provider-Konfiguration.

Bei Änderungen an Discovery, Gruppen oder Plugin-Lebenszyklus den tatsächlichen
Entwicklungsablauf prüfen, nicht nur einen erfolgreichen Build:

1. Neue Action-Datei in einer gerenderten Gruppe hinzufügen: ohne manuellen Neustart sichtbar.
2. Titel ändern und Datei entfernen: Oberfläche aktualisiert sich, keine Duplikate oder alten Einträge.
3. Neue Gruppe: gemäß der ausdrücklich gewählten Darstellungsregel sichtbar oder nachvollziehbar nicht platziert.
4. Navigationsziel anklicken: richtige Seite und nativer Link, kein nur syntaktisch gültiger Link auf eine fehlende Route.
5. Plugin deaktivieren/aktivieren: alle Beiträge verschwinden/kehren zurück; Cleanup funktioniert.
6. Bei betroffenen Zuständen Sprache, Formularzustand und Organisationswechsel prüfen.

Tests müssen nach einem UI-Umbau noch den echten Nutzerweg prüfen. Benötigte
Anmeldedaten und übersprungene Tests klar benennen; übersprungen heißt nicht bestanden.
Den offenen Tab des Nutzers und ungespeicherte Eingaben berücksichtigen. Während
eines größeren Umbaus eine instabile Vorschau nicht als fertig präsentieren.

## Pflege

Neue bestätigte Fehler als konkrete Invariante oder Prüfscenario ergänzen, ohne
unnötige Verbote für andere Anwendungsfälle anzusammeln. Unfertige Funktionen in
der Roadmap festhalten; Dokumentation ersetzt keine Implementierung.

### Mit Änderungen synchron halten

- Bei Änderungen an Architektur, öffentlichen APIs, Dateikonventionen, Registrierung, Routing oder Lebenszyklus diesen Skill im selben Arbeitsschritt prüfen und betroffene Aussagen aktualisieren. Veraltete Regeln ersetzen oder entfernen.
- Neue bestätigte Fehler und vereinbarte Korrekturen als wiederverwendbare Regel oder Prüfscenario nachführen; nicht nur eine chronologische Fehlerliste anhängen. Bereits behobene Beispiele dürfen keinen veralteten Ist-Zustand suggerieren.
- Vor Abschluss Code, Skill und betroffene Anleitungen auf Widersprüche prüfen. Roadmap-Punkte erst nach tatsächlicher Umsetzung als erledigt markieren.
- Routineaktualisierungen innerhalb einer autorisierten Änderung direkt vornehmen und kurz erwähnen. Bei unklaren oder widersprüchlichen Architekturentscheidungen gezielt nachfragen; keine neue Architektur allein aus einer Vermutung als verbindlich dokumentieren.
- Der Skill ist eine gepflegte Entwicklungsanleitung, keine vollständige Kopie des Codes. Details mit eigener Quelle dort belassen und bei Bedarf verlinken. Die Synchronisierung erfolgt bei der Bearbeitung; es gibt keinen automatischen Hintergrundmonitor.

### Plugin-Seiten und Menügruppen

- Plugin-Seiten liegen unter `pages/**/*.page.tsx` und exportieren `definePage({ path, component })`; `entries.pages` überschreibt den Discovery-Pfad. `PluginPage` erhält den aktuellen Pfad vom Host-Router. Exakte statische Pfade werden unterstützt, dynamische Parameter noch nicht.
- Doppelte/ungültige Plugin-Pfade werden vor dem Mounten abgelehnt. Host-Routenkollisionen und HTTP-404-Verhalten benötigen weiterhin die jeweilige Router-Anbindung; ein Client-Fallback allein ist kein HTTP-404.
- Die Content-Demo bindet `navigation` und `navigation2` ausdrücklich an ihr Menü. Weitere Gruppen werden nicht ungeprüft sichtbar. Neue Actions innerhalb gebundener Gruppen erscheinen reaktiv; keine einzelne Action manuell in das Menü aufnehmen.
- Hot-Reload kann die rein lokalen Demo-Services neu erstellen und dadurch deren Beispieldaten/Sitzung zurücksetzen. Das nicht als dauerhafte Speicherung oder erhaltenen Sitzungszustand darstellen.

- Gruppenüberschriften verwenden den expliziten Gruppentitel oder andernfalls unverändert die Gruppen-ID. Keine erfundenen Ersatzkategorien wie „Weitere Seiten“ für nutzerdefinierte Gruppen anzeigen.

### Gezieltes Ersetzen

- App-Action-Definitionen dürfen mit `replaces` eine bekannte Plugin-Action-ID gezielt ersetzen. ID und bestehende Bindungen bleiben erhalten; Gruppen/Titel/Beschreibung/Icon/Reihenfolge werden bei fehlender Angabe übernommen. Guards und Fachlogik nicht implizit übernehmen oder als weiterhin wirksam darstellen.
- Unbeabsichtigte doppelte IDs, fehlende Ziele und mehrere Ersatzdefinitionen melden Fehler. Plugin-zu-Plugin-Ersetzungen sind nicht erlaubt. Konstruktor-only-IDs sind keine unterstützten Override-Ziele.
- Im Next-Beispiel haben explizite Host-Routen Vorrang vor dem Plugin-Catch-all. Diese Regel nicht ohne Prüfung auf andere Router übertragen.
- Zielarchitektur: allgemeine Packages und die dünne Basis-App setzen keinen Auth-Anbieter voraus. Anbieter-Code gehört in optionale Plugins/Adapter. Die ursprüngliche `apps/web` ist noch direkt mit Better Auth verbunden; diese Migration nicht als abgeschlossen darstellen. Serverrechte, Sessionvalidierung und Organisationsprüfungen bei einer späteren Extraktion vollständig erhalten.

### Sicht eines neuen Entwicklers

- Bei Paketänderungen `packages/README.md` als Einstieg aktuell halten: Verantwortung, Abhängigkeitsrichtung und Reifegrad jedes Pakets müssen ohne Gesprächshistorie verständlich sein.
- Architekturvorschläge kritisch gegen Eigenständigkeit, optionale Abhängigkeiten und Server-/Client-Grenzen prüfen. Nicht jedem Vorschlag reflexartig zustimmen oder Diskussion als fertige Umsetzung darstellen.
- Eine einfache öffentliche Nutzung darf mehrere intern klar getrennte Pakete bündeln. Zusätzliche Pakete nur mit eigenständiger Verantwortung begründen; keine großen Zusammenlegungen bloß zur Reduktion der Ordneranzahl.
- Aktuelle Priorität: begonnene optionale Plugins fertigstellen; keine neue Authoring-App und kein neues Themenmanagement ohne erneuten Auftrag.

### Core und Anbieter-Plugins

- Actions und Foundation-Verwaltung liegen in `packages/core`. React-Oberflächen werden über `@bitakit/ui` beziehungsweise `@bitakit/ui/actions` importiert; allgemeine Logik benötigt keine React-Laufzeit. Keine alten separaten Actions-/React-Pakete wieder anlegen.
- Better Auth und next-intl liegen in eigenen optionalen Paketen. Auch die Next-Router-Anbindung liegt ausschließlich in `packages/next`. Core enthält keine Anbieter-Imports oder Anbieter-Peer-Abhängigkeiten.
- Anbieter sind normale Plugins; keinen zweiten `integrations`-Konfigurationsbereich oder Lebenszyklus hinzufügen. Explizite Plugin-Listen ersetzen Discovery; nötigenfalls beide Listen bewusst zusammenführen.
- Gemeinsame Verträge mit `serviceKey<T>` definieren, Anbieter mit `provideService` prüfen und mit `getService` beziehen. Benötigte Services über `requires` beziehungsweise `watch` deklarieren. Optionale Services nicht allein durch globale Typdeklarationen als installiert darstellen.
- Jede Contribution-Art (Command, Form, Dialog, Klassen-Export) wird in `packages/core/src/contributions` durch einen Adapter in Registrierungen normalisiert; die Runtime ordnet, erzeugt Services, registriert und übersetzt nur noch. Neue Arten bekommen einen Adapter; `mount()` nicht wieder um Sonderfälle erweitern.
- Die Formular-Registrierung `<id>.submit` ist `internal`: ausführbar und abonnierbar, aber aus `useActions()` und Gruppenansichten ausgeschlossen. Jede Aufzählung von Actions (auch eine künftige Suche) muss `internal` respektieren.
- Klassen-Actions erhalten `context` als zweiten `execute`-Parameter; `success`/`failure` sind dort Opt-in-Felder. Declarative commands also require explicit outcome messages; missing/false messages stay silent. `list.execute` liefert `{ status: 'completed', value }`.
- Discovery erzeugt eine `ActionMap` mit wirksamer ID, Eingabe- und Ergebnistyp. Klassen-/Funktions-Exports sind ausgenommen, weil sie ihre ID erst im Konstruktor festlegen; `ActionMapOptions { strict: true }` erlaubt strikte IDs. Type-Tests dafür liegen in `packages/core/tests/action-types.ts` und `apps/web/tests/foundation-types.ts`.
- Öffentliche npm-Namen verwenden den Scope `@bitakit/`; kurze Ordnernamen sind keine ungescopten npm-Pakete. Verfügbarkeit und Veröffentlichung des Scopes nicht ohne Prüfung behaupten.
- Autor, Version und Kontakt nicht doppelt pflegen: öffentliche Paket-Metadaten übernehmen, lokale Overrides optional. Keine vollständige package.json mit Scripts oder privaten Konfigurationsdaten in den Client übernehmen.

- Bei rekursiver Dateierkennung auch Verzeichnis-Erstellung und -Umbenennung beobachten: Ein Dateiendungsfilter allein kann die erste Action in einem neu angelegten Ordner übersehen. Den Ablauf mit zunächst fehlendem Actions-Ordner testen.

### Organisationen und E-Mail

- `organizations` enthält allgemeinen Vertrag, Service und optionale UI unter `/react`; `better-auth/organizations` implementiert den Vertrag. UI und Anbieter nicht vermischen. Die erste Version deckt Standardrollen und grundlegende Mitglieder-/Einladungsabläufe ab, nicht alle Spezialfunktionen der alten Web-App.
- Formular-Ausführungen erhalten den ursprünglichen Öffnungskontext über `submit`-Kontext `input`. Organisationsbezogene Dialoge prüfen ihn beim Speichern, damit ein zwischenzeitlicher Wechsel keine Einladung im falschen Arbeitsbereich erzeugt.
- Backend-Kontextänderungen löschen alte Organisationsdaten sofort; asynchrone Antworten nach Wechsel oder Dispose dürfen sie nicht wiederherstellen. Abonnements gehören dem Service-Lebenszyklus.
- Die Content-Demo bindet Inhalte und Organisationsoberfläche an dieselbe Organisations-Service-Instanz; der Testadapter speichert nur lokal für die Sitzung.
- `email` definiert den allgemeinen serverseitigen Vertrag, `nodemailer` stellt SMTP bereit, `better-auth/email` liefert optionale Server-Callbacks. Keine SMTP-Registrierung im Browser. Kein automatischer Versand durch Installation oder Tests.
- Adaptertests und SDK-Typprüfung sind keine Live-Backend-Verifikation. Echte Zustellung, produktive Rechte und bestehende Web-App-Migration separat prüfen und ihren Status ehrlich nennen.

- Organisations-Toolbars und Zeilenaktionen über die öffentlichen `organizationGroups` rendern. Keine feste Liste einzelner Buttons im UI zurückbringen; Erweiterungs-Plugins müssen ohne Änderungen am Renderer erscheinen. Kontext enthält Organisations- und Zeilen-ID.
- Responsive Prüfungen mit normalen Mitgliedern, langen ungetrennten Namen/Adressen und zusätzlichen Zeilenaktionen durchführen. Ein Eigentümer ohne Buttons beweist keine responsive Aktionsspalte. Auf allen Bildschirmgrößen dieselbe shadcn-Tabelle verwenden; auf schmalen Bildschirmen scrollt nur ihr Tabellencontainer horizontal. Keine separate mobile Liste und keine doppelte Zeilenimplementierung. Seitenüberlauf und Button-Grenzen prüfen.

### Vollständigkeit und Shell

- Bestehende Organisationsabläufe vollständig inventarisieren: Mehrfach-E-Mail-Eingabe mit Teilfehlern, Ablaufzeit, erneutes Senden, Zurückziehen, Empfänger-Annahme/Ablehnung, Mitgliedsrollen, Sperren/Entsperren, Profil/Logo, Such-/Rollen-/Status-/Datumsfilter und Pagination. Einzelne erfolgreiche Demo-Abläufe bedeuten keine Funktionsgleichheit.
- Organisationswechsel ausschließlich im durchsuchbaren oberen Switcher mit Erstellen-Eintrag. Keine zusätzliche Organisationskartenliste in der Mitgliederseite. Profil-, Layout- und Organisationseinstellungen gehören ins untere Benutzermenü.
- `shell` ist ein optionales Plugin auf Basis der vorhandenen Sidebar-Komponenten. Sidebar und Navbar verwenden denselben stabilen Inhaltsbereich. Einstellungen registrieren sich als eigene Seiten im bestehenden Katalog; die Host-Kategorie ist konfigurierbar.
- Alle Plugin-Oberflächen übernehmen Host-Theme-Tokens. Keine eigene feste Farbwelt. Radio-Karten und andere Settings-Renderer nutzen denselben bestätigten Settings-Wert; keine zweite Speicherung hinzufügen.
- Die Content-Demo verwendet jetzt den Organisations-Service auch für die Auswahl ihrer Inhalte. Keine unabhängige zweite Organisationsauswahl neu anlegen.
- Dialog-Actions dürfen `watch` und `resolve` verwenden; dieselben Berechtigungs-/Pending-Guards wie bei direkten Actions erhalten. Service und Server prüfen beim Ausführen erneut.

- Vorhandene Seitenköpfe und Logo-Auswahl beim Herauslösen in Packages erhalten: `ui/page-header` bietet Titel, Untertitel und trailing-Aktionen; Organisationslogo mit Vorschau, Wechseln und Entfernen statt einer nackten Dateieingabe. Organisationssuche verwendet den vorhandenen ruhigen CommandInput mit Löschbutton. Popover-Oberflächen übernehmen die XL-Rundung des Designsystems. Settings-Übersichten lesen ausschließlich den Settings-Katalog.

- Settings benötigen auch den bewährten Rahmen: eigene Sidebar, Katalognavigation, Breadcrumb und explizites Zurück-Ziel. Die übernommene `shell/SettingsShell` bleibt routerunabhängig und nutzt denselben Katalog wie die Übersicht. Keine zweite hart kodierte Settings-Seitenliste. Logo-Dateieingaben vollständig verstecken; eine nur visuell beschnittene native Dateieingabe kann auf Mobilgeräten Überlauf verursachen.
- Menü-Detailparität ausdrücklich prüfen: SidebarIdentity bündelt Organisations- und Nutzertrigger; Chevron im Ruhezustand verborgen, bei Hover, Tastaturfokus oder offenem Menü sichtbar. Command-Suche erhält symmetrische vertikale Innenabstände; ausgewählte Menüeinträge verwenden die vereinbarte XL-Rundung. Benutzermenüs nicht mit Direktlinks für jede Settings-Unterseite füllen: ein gemeinsamer Einstieg Einstellungen und Abmelden reichen; keinen zweiten Organisationssettings-Link auf denselben Katalog im Benutzermenü platzieren; Unterseiten bleiben im Katalog erreichbar.

- Organisationsprofil: Speichern und die erweiterbare Danger-Action-Gruppe teilen sich eine responsive Aktionszeile mit gleichen Kontrollgrößen (Löschen links, Speichern rechts). Keine zweite separate Button-Zeile unter dem Formular. Zeilen-Actions innerhalb von Formularen ausdrücklich als type=button rendern.

- Horizontale Shell: gebundene Action-Gruppen als shadcn-NavigationMenu-Kategorien mit ihren aktuellen Actions/Icons darstellen, nicht Sidebar-Gruppen horizontal umbrechen. Nutzertrigger nur als Avatar; Identität im Menü, Popups nach unten. Settings-Suche sitzt in der Sidebar und verwendet unveränderte Standard-InputGroup-Theme-Werte; keine doppelte Suche im Inhaltsbereich. Die Navbar erhält keine redundante zweite App-Kopfzeile.

- Organisations-Settings an der freigegebenen Referenz ausrichten: Abschnittstitel außerhalb der Feldgruppen, Logo unter Erscheinungsbild, allgemeine Angaben als getrennte Zeilen mit Beschreibung links und Eingabe rechts; mobil stapeln. Keine zusätzliche äußere Karte um diese Gruppen. Die gemeinsame Speichern-/Löschen-Zeile erhalten.

- Dezente Flächenrahmen und Trennlinien werden über den zentralen Host-Token --border gesteuert; Sidebar-Rahmen referenzieren ihn. Keine lokalen Opacity-Sonderwerte pro Plugin. Eingabefelder behalten den separaten --input-Token für erkennbare Bedienflächen.

- ActionButton rendert das Action-Icon selbst, auch bei eigenen children. Menü-Renderer dürfen es nicht zusätzlich als Kind einfügen; bei ActionLink bleibt die explizite Icon-Komposition nötig.

- Organisationseinstellungen enthalten Profil sowie Mitglieder und Einladungen. Die Personenansicht verwendet dieselbe OrganizationsPage wie die eigenständige Mitgliederseite: keine zweite Tabelle, Filter-, Einladungs- oder Action-Implementierung. Die Settings-Sidebar bietet Organisationsprofil und eine gemeinsame Seite Mitglieder und Einladungen. Diese Personenansicht verwendet wie die alte App Linien-Tabs mit Zählern, eine kompakte Filterleiste und die Tabelle ohne zusätzliche Karten oder wiederholte Überschriften. Einladungen an mich stehen als eigener Eintrag unter Mein Konto; sie bleiben die persönlich erhaltenen Einladungen und sind nicht die ausgehenden Organisationseinladungen. Die persönliche Kategorie heißt Mein Konto (englisch My Account); ihre technische ID personal bleibt erhalten.

- Mitglieder- und Einladungszeilen rendern ihre Action-Gruppen im gemeinsamen Dropdown-Menü hinter Weitere Aktionen. Keine sichtbare Reihe aus Sperren-, Entfernen- und Rollen-Buttons. Zusätzliche Plugin-Actions werden aus derselben reaktiven Gruppenbindung übernommen.

- Dialog-Actions können size: wide anfordern; der gemeinsame DialogHost reicht diese semantische Größe an die UI weiter. Die UI definiert die Breite zentral, mobil bleibt der Bildschirmrand erhalten. Mehrfach-Einladungen nutzen diese breite Variante.

- Die Host-UI-Bindung muss die gemeinsame Dialog-Komponente verwenden; eine alte lokale Kopie kann neue Größenoptionen still ignorieren. Dialogbreite im Browser messen, nicht nur die Definition oder CSS-Klasse prüfen.

- Plugin-Verwaltung ist ein eigener Katalogeintrag unter der hostdefinierten Anwendungsverwaltung. Normale Plugin-Einstellungen erscheinen nach ihrem Zweck in der Katalognavigation. Die Plugin-Übersicht verlinkt deren Seiten anhand pluginId; keine zusätzliche Registry.

- Plugin-Übersicht liest aktivierte Plugins und öffentliche Metadaten aus der Foundation-Konfiguration; SettingsSection.pluginId ordnet vorhandene Detailseiten ihrem Plugin zu. Fehlende Versionen bleiben leer bzw. Nicht angegeben, keine erfundenen Paketdaten. Optionale Icons gehören zu den öffentlichen Plugin-Metadaten. Details verwenden URL-Zustand über nuqs.

- Settings-Einträge definieren ihre Reicon-Icons im jeweiligen Beitrag; Renderer lesen section.icon. Die Plugin-Übersicht verwendet dieselben Outline-Items wie die Settings, als einspaltige Liste über die volle Inhaltsbreite, mit optionalem Bild, Metadaten und einem generischen Icon als Fallback, keine erfundenen Versions- oder Autorenangaben.

- Gemeinsame Card unterscheidet frame (ruhige Fläche) und interactive (dezenter zentraler Hover-/Fokus-Effekt nur für Rand und Schatten, keine Positionsänderung; reduzierte Bewegung beachten). Vollständig anklickbare Flächen nutzen echte Links über asChild; keine zusätzlichen Details-Buttons oder lokalen Hover-Stile.

- Detailseiten verwenden den gemeinsamen BackLink oberhalb des Titels mit explizitem internem Elternziel, nicht history.back. Plugin-Details bewahren den Suchparameter beim Zurückweg; Metadaten stehen auf großen Bildschirmen rechts, mobil unter dem Inhalt.

- Suchfelder mit InputGroupClearButton verwenden den Standard-Textinput. Nicht gleichzeitig den nativen Löschen-Knopf von type=search und einen expliziten Clear-Button anzeigen. Dieselbe Regel gilt in Plugin-, Settings- und Mitglieder-Suche.

- Keine doppelte Alle-Einstellungen-Übersicht neben einer vollständigen Settings-Sidebar. Die Content-Demo startet im Profil; Darstellung bündelt Farbschema und Navigation. Das optionale Shell-Theme schreibt über AppPreferences; ein DOM-/System-Adapter setzt die bestätigte Auswahl um, ohne zweiten Preference-Store.

- Eigenständige Settings-Seiten nutzen PageHeader mit Titel, Untertitel und passenden Aktionen rechts. Listen wie persönliche Einladungen haben kompakte Standard-Suche und dieselbe responsive Tabelle; keine leere Seite, wenn keine Einträge vorhanden sind. Formularseiten benötigen keine künstliche Suche.

- Tabellenaktionen dürfen durch neue Spalten nicht zusammengedrückt werden: Gruppenmenü mit stabiler Aktionsspalte nutzen. Persönliche Einladungen zeigen unter der Organisation die Zieladresse mit der Beschriftung Eingeladen als; Datum und Uhrzeit sind zweizeilig. Horizontales Scrollen statt schmaler, vertikal umbrechender Aktionsbuttons.

- Eingebettete Formularflächen (z. B. Organisationsprofil: Erscheinungsbild und Allgemein) verwenden Card/CardContent aus dem UI-Paket; keine eigenen rounded-xl/border-Karten. Abschnittslegenden und Formularsemantik bleiben erhalten. Card-Radius, Rahmen und Innenabstände stammen aus der zentralen Komponente. Hinweise verwenden Alert statt selbst gestalteter Rahmen.

## Kleine externe UI-Vergleiche

- Für einen ausdrücklich visuellen Bibliotheksversuch zuerst die kleinste sichtbare Preview liefern; keine vollständige Auth-/Plugin-Migration daraus machen.
- Better Auth UI shadcn liefert Registry-Quellcode plus `@better-auth-ui/react`, nicht dieselbe Oberfläche wie das HeroUI-Paket. Registry-Dry-run prüfen, vorhandene UI nicht überschreiben. Auch Provider-Typ-Erweiterungen gehören zu den offiziellen Formularkomponenten.
- Eine lokale Vorschau muss echte Konten, E-Mails und Sessions ausschließen und dies sichtbar nennen. Rendering und Theme-Übereinstimmung sind kein Beweis für produktive Auth-Integration.

### Better Auth UI als externe Komponentenbibliothek

- `better-auth-ui` ist ein schlanker regulärer Foundation-Adapter um `@better-auth-ui/heroui`. UI und native Plugins unmittelbar aus den öffentlichen npm-Exports importieren/re-exportieren. Keine Registry-Dateien, kein src/upstream, keine nachgeschriebenen Bibliotheksformulare, keine Paket-Patches.
- Original unverändert bedeutet hier ausdrücklich **keine Quellcodekopie im Repository**. Das zuvor verwendete vendorte shadcn-Experiment ist verworfen. Node_modules enthält die reguläre externe Abhängigkeit.
- Eigene Foundation-Registrierung und zentrale Theme-CSS bleiben außerhalb der Bibliothek. Vollständige native Provider-Optionen weiterreichen; keine Demo-Daten, Secrets oder zweite Session ins Paket aufnehmen.
- Verfügbarer Katalog bedeutet nicht aktiviertes Backend: server-/clientseitige Erweiterungen und externe Credentials separat dokumentieren. Erfolgreiche Anmeldung und UI-Flüsse mit dem realen isolierten Better-Auth-Handler prüfen, ohne echte Testnutzer oder Nachrichten in geteilter Infrastruktur.

- Der lokale Content-Demo-Einstieg ist keine Better-Auth-Sitzung. Geschützte native Organisationsseiten müssen nach echter Anmeldung ohne aktive Organisation zur Organisationsübersicht führen; diesen Weg mit isoliertem echten Auth-Handler prüfen. Theme-Brücken auch an zusammengesetzten Passwortfeldern und ihren kleinen Augenbuttons gegen die zentrale Referenz prüfen, einschließlich Hover und Tastaturfokus.

- Externe Tabellen auch mit unterschiedlich schnell eintreffenden echten Berechtigungs- und Datenabfragen prüfen. In Better Auth UI HeroUI1.7.16–26 kann die Mitglieder-Auswahlspalte vor dem dreizelligen Loading-Skeleton erscheinen und React Aria abbrechen. Ein älterer offizieller Paketstand muss samt zusammengehörigen Core/React/Locales, Funktionsverlusten und erneuter Authentifizierung geprüft werden; kein stiller Downgrade oder Bibliotheks-Patch.

- Native Teams benötigen passende Server-/Client-/UI-Aktivierung und Team-Mitgliedschaft. TeamSwitcher erhält den aktiven Teamwert aus derselben echten Sitzung plus syncSession; keinen zweiten lokalen Teamzustand führen. Der Content-Host nimmt autorisierte Team-Ersteller über die offizielle API ins Team auf.
- API-Key-Verwaltung verwendet getrennte Konfigurationen default/user und organization/organization. Schlüssel werden nur einmal angezeigt, nicht geloggt oder in Testbildern gespeichert; Testkeys nach Prüfung widerrufen. Server prüft Eigentum/Rollen und gesperrte Organisationsmitgliedschaften auch bei Schlüssel-ID- und Team-ID-Zugriffen. Neue Auth-Tabellen erhalten RLS und keine öffentlichen Datenbankrechte.
- Native HeroUI-Selects (auch secondary/full-width und Dialog-Portale) extern auf Foundation SelectTrigger rounded-md plus zentrale Squircle-Eckenform abbilden; nicht mit der runden Textinput-Ausnahme vermischen. Umrandete native Dialog-Listenzeilen verwenden Item rounded-xl. Keine dynamischen React-Aria-IDs oder übersetzten Labels als CSS-Selektor. Upstream-CSS über einen regulären Styles-Export des besitzenden Adapterpakets auflösen, damit npm-Hoisting keine Voraussetzung ist.

- Tailwind-Quellen gehören ins besitzende Paket: öffentlicher styles.css-Export mit @source "./dist", CSS in files und sideEffects aufnehmen. Hosts importieren nur tatsächlich genutzte Paketoberflächen; keine ../../packages-Scanpfade, kein Scan des ganzen Monorepos, keine Sammeldatei aller optionalen Plugins. Notwendige UI-/Core-Styles darf ein UI-Plugin selbst importieren. Headless-Service-Verbrauch benötigt keine Styles. Paketgrenzen durch npm-pack plus isolierte Tailwind-Kompilierung ohne ungenutzte Plugins prüfen; Host-Theme nicht duplizieren.


### Settings: App Preferences and plugin-owned pages (implemented)

- App Preferences are a client feature. Declare definitions with `defineSettings({ id, scope, fields })` and the field builders in `settings/`, sections with `defineSettingsSection({ id, title, settings: [collections] })` in `sections/`, and renderers with `defineSettingsRenderers` in `renderers/` of the app or a plugin root; the installed package contributes discovery kinds automatically; explicit `kinds: settingsDiscovery()` remains an override. Packaged plugins pass the same values as `contributions`. Keys are `${collectionId}.${field}`. An omitted collection ID is inferred from plugin and file path; explicit IDs preserve persistence across moves. Keep helper components outside these folders and move or reconfigure existing folders that would collide.
- `AppPreferences` stays the only owner of confirmed values. Register data by owner (installers do this for contributions; `scopedSettings(app, services)` in setup). Several owners of one definition are allowed; a different definition under an existing key or collection ID must fail with both sources. Sections only reference definitions; removing a section or plugin never deletes stored values.
- Writes: one in flight per key, newer values coalesce, promises resolve `saved`/`superseded`/`cancelled` and reject only for validation or their own failure. Controls stay enabled while pending, show a local draft and revert on failure. Never confirm a value that nothing persists; remote APIs authorize and validate themselves.
- Rendering goes through the `settings.renderer` service with the documented precedence (app field > owner plugin field > app type+variant > owner plugin type+variant > built-in variant > app type > owner plugin type > built-in type). Unknown variants are configuration errors, not fallbacks. Plugin renderers apply only to their own fields and sections; view renderers are app-only. Imperative registration uses `service.scoped(app)` so layer and owner come from the runtime scope; never accept owner strings from callers.
- Initial render: `appPreferencesPlugin` derives a pure, per-runtime snapshot from `runtime.contributionsOf()` before mount. Verify that server markup, hydration and the mounted runtime resolve the same renderers; no module-global renderer tables.
- Each plugin owns its own settings pages (`pluginId`, assigned from the contributing module). The host defines categories. Compose several fields within the own page through the section's references or a section renderer. No contributions into another module's page and no page-targeting API. The legacy `SettingsSection({ groups, component })` registration via `add()` keeps working.
- Die Content-Demo definiert Darstellung (Layout und Farbschema), Mein Konto (Profil und Sicherheit), Organisation und Anwendungsverwaltung. Die ältere Web-App bleibt unverändert. Die Standardkategorien liegen im Shell-Paket; die App aktiviert die Plugin-Angebote. Kategorien sind Präsentation, keine Speicher-Scopes und keine Berechtigung. Die Settings-Seitenleiste zeigt keinen zusätzlichen Organisationsnamen; dieser bleibt im Organisationsprofil. Organisationsidentität stammt aus dem vorhandenen verifizierten Anbieter bzw. dem ausdrücklich lokalen Demo-Service. Einladungen an mich sind persönlich und unabhängig von einer aktiven Organisation zugänglich; in der Content-Demo stehen sie thematisch unter Organisation. Plugin-Verwaltung bleibt von den normalen Einstellungen eines Plugins getrennt.
- The main `@bitakit/app-preferences` entries stay independent of router and Foundation runtime; the React visual entry owns standard shadcn controls; only the optional `./foundation` entry integrates Core and the UI bindings. `projectSettings` projects only the current catalog. `packages/shell/settings` bietet den gemeinsamen SettingsShell/SettingsNavigation/SettingsPage-Rahmen; Web-Routen und abgefangener Dialog sind dünne Next-Adapter. Desktop-Sidebar, mobiler Drawer, Suchzustand in nuqs und echte Links bleiben erhalten. Im Dialog ersetzt SettingsLink den Eintrag; direkte Seiten verwenden ein explizites internes Zurück-Ziel.
- SettingsProvider bewahrt den anfänglichen Katalogsnapshot ausschließlich für die Hydrierung. Plugin-Effekte können laufen, bevor Suspense-Navigation hydriert; getServerSnapshot darf dann nicht bereits den veränderten Live-Katalog liefern. Danach wird der aktuelle Katalog über useSyncExternalStore verwendet. Direkte Loads mit später Plugin-Registrierung und Sprachwechsel auf Hydrierungsfehler prüfen.
- Verschachtelten mobilen Settings-Drawer im abgefangenen Dialog mit Escape und Fokus-Rückgabe prüfen, auch unmittelbar nach einem Sprachwechsel. Die zentrale Sidebar bewahrt den Auslöser für den kontrollierten Sheet und akzeptiert übersetzte mobile Titel/Beschreibungen. Der Settings-Dialog ignoriert Escape aus dem portalierten mobilen Drawer; dieser schließt sich selbst über sein Tastaturereignis. Das verhindert ein versehentliches Schließen des äußeren Dialogs, während sich die Radix-Layer nach Navigation oder Sprachwechsel aktualisieren. In Browserprüfungen vor Escape den tatsächlichen Fokus im geöffneten Drawer abwarten.
- Runtime-Settings-Seiten werden erst nach Plugin-Registrierung aufgelöst. Unbekannte Web-Pfade liefern derzeit zunächst HTTP 200 und anschließend die bestehende Nicht-verfügbar-Seite; der Content-Host verwendet ebenfalls einen Katalog-Fallback. Das nicht als serverseitigen HTTP-404 oder Berechtigungsprüfung darstellen. Keine zweite Server-Seitenregistry nur für einen Test einführen.
- Shell Appearance owns theme and layout: Shell contributes `shellPreferences`, the Appearance section and plugin-layer card renderers, and requires `appPreferencesPlugin`. No second value or error handling; failures keep the confirmed value and a new attempt clears the error.
- Die Web-App behält `appearance.theme` und ihren bestehenden DOM/System/Cache-Adapter. Die Content-Demo behält `shell.theme` und `shell.layout` im lokalen Browser-Speicher. Unterschiedliche Hosts/Schlüssel sind kein Konflikt. Ein Host kann `shellPlugin({ theme, applyTheme: false })` mit seiner bestehenden Definition und seinem DOM-Adapter verwenden. Keine Schlüsselumbenennung ohne echte Notwendigkeit und Migration.
- Persistente Definitionen explizit auf Client und vertrauenswürdigem Server registrieren. `shell/definitions` ist ein nicht-React-Einstieg für eigene Storage-Adapter. Die lokale Content-Demo besitzt keinen Settings-Server; ihre Browserwerte autorisieren keinen Datenbankzugriff. Passwort, MFA, Sessions und Organisationsoperationen bleiben in den Domänenservices.
- Gemeinsame Katalog-Eltern werden einmal vom einbindenden Host oder dem zuständigen Shell-Plugin registriert. Ein Plugin darf beim Cleanup keinen gemeinsam verwendeten Kategorien-Elternknoten entfernen. Normale Kategorieobjekte benötigen keinen Elternknoten; der ältere `{ section }`-Gruppierungsweg bleibt kompatibel. Doppelte IDs/Pfade, unabhängiges Entfernen, direkte Verfügbarkeit, Pending/Fehler, Kontextwechsel und verspätete Antworten prüfen.
- Beim älteren Eltern-Gruppierungsweg erben Unterseiten die explizite Host-Kategorie des Elternteils, andernfalls dessen ID/Titel. Übersetzte Kategorieänderungen propagieren über denselben Katalog; Speicher-Scope und Schreibrechte bleiben davon unabhängig.
- Appearance option cards share `SettingChoiceCards` (`packages/shell/src/choice-cards.tsx`): presentation only, labelled externally by the field view (`labelledBy`, `describedBy`, `showFeedback={false}`). Icons belong to the renderers; plain option descriptions may live in the definition because they are localizable data.
- `Field` muss direktes Kind von `FieldLabel` bleiben. Das gesamte Kartenbild (Rahmen, Radius, Hover, Fokusring, `data-checked`-Hervorhebung) hängt an den `has-[>[data-slot=field]]`-Regeln in `packages/ui/src/field.tsx`; ein zwischengeschobenes Wrapper-Div entfernt es ersatzlos.
- Boolesche `data-*`-Flags immer als `wert || undefined` setzen. React serialisiert `false` zu `"false"`, und `[data-disabled]` prüft nur die Anwesenheit des Attributs: `data-disabled={disabled}` hat den Hover-Zustand aller Optionskarten dauerhaft deaktiviert. Gleiches gilt für `data-checked` und `data-invalid`.
- Reicon Outline ist nicht einheitlich konstruiert. Die Mehrheit (Sun, Moon, Monitor, Sidebar, Window2, Layout …) liefert vorab expandierte Füllpfade; eine Minderheit (SidebarLeft2, SidebarTop, SidebarBottom, Sun4, Moon3, Monitor3, Computer …) liefert echte `stroke-width="1.5"`-Pfade. Beide Familien in einer Gruppe zu mischen ist sichtbar. Vor dem Paaren die `O:`-Variante im Modul prüfen, nicht nur den Dateinamen. Die frühere Layout-Auswahl mischte SidebarLeft (Füllpfad) mit SidebarTop (Stroke); SidebarTop ist zudem ein Chevron im Rahmen und bedeutet „einklappen“, nicht „Navigation oben“.
- Aktueller Icon-Satz der Appearance-Seite: Sun/Moon/Monitor für Hell/Dunkel/System (gleich wie die ältere Web-App) und Sidebar/Window2 für Sidebar/Navbar. Sidebar zeigt eine linke Spalte mit Navigationszeilen, Window2 ein oberes Band mit Einträgen; die beiden spiegeln sich und lesen dadurch als Paar.
- Offene Lücke: `SettingSelect` reicht `error` nicht an seine `as`-Komponente weiter und rendert den Fehler selbst als ungestyltes `<p role="alert">`. Eigene Renderer können deshalb keinen zentralen `FieldError` zeigen. Eine Weiterreichung müsste `apps/web` (nutzt denselben Fallback) mitziehen; bis dahin bleibt das Farbschema beim Standardfehler, das Layout nutzt `FieldError`.
- Zurückgestellt: Mehrfachauswahl/strukturierte Werte, allgemeine Mehrfeld-Draft/Save-Transaktionen, generische Renderer-Registry, automatische Server-Plugin-Discovery und Runtime-Aktivierung. Die bestehende Auswahl öffentlicher Standardkontrollen plus SettingBinding genügt für diese Umsetzung.

### Selektive Better-Auth-UI-Komposition

- Upstream-Paket und Quellcode unverändert lassen. Geeignete öffentliche Komponenten/Hooks direkt wiederverwenden; eigene Elternkomponenten dürfen öffentliche Unterkomponenten neu anordnen. Exportierte Bausteine und ihre Verträge zuerst verifizieren.
- Nur unzureichende Oberflächen gezielt durch eigene Komponenten ersetzen. Upstream-Quellcode darf zum Verständnis gelesen werden; keine vendorte Kopie oder Paket-Patches einführen. Authentifizierung, Session und serverseitige Autorisierung bleiben beim vorhandenen Better-Auth-Vertrag.
- Eigene Ersatzkomponenten austauschbar halten: wenn eine spätere offizielle Version den Bedarf erfüllt, wieder deren Oberfläche verwenden. Bei Upgrades betroffene eigene Integrationen und vollständige Nutzerabläufe prüfen; Upstream-Tests decken die eigene Zusammensetzung nicht automatisch ab.

### Späterer interaktiver Projekt-Konfigurator

- Zurückgestellt: Website mit Plugin-Auswahl, Live-Vorschau und daraus erzeugtem Installations-/Projektgenerierungsbefehl. Vorschau und Generator sollen dieselbe deklarative Auswahl einschließlich Abhängigkeiten und Konfiguration verwenden; konkrete CLI-/Paketnamen sind noch nicht festgelegt.
- Für die erste Vorschau ist ein Neustart mit neuer Konfiguration akzeptabel; flüchtiger Zustand kann dabei verloren gehen. Hot-Aktivierung einzelner Plugin-Scopes und tenantabhängige Freigaben sind separate, noch nicht implementierte Fähigkeiten. Reale Backend-Verbindungen brauchen eigene Einrichtung; Demo-Daten nicht als produktive Integration darstellen.

- Kontoeinstellungen gehören ins Better-Auth-UI-Paket: `betterAuthUIPlugin({ accountSettings: { catalog } })` registriert Profil und Sicherheit samt Cleanup, Icons und Zusammensetzung. Die App hält dafür keine Seiten- oder Setup-Implementierung. Ein optionaler `profileFallback` ist ausschließlich bestehender lokaler Demo-Inhalt und autorisiert keine echte Sitzung. Das Shell-Plugin besitzt die Standardkategorien und optional mit `pluginManagement: true` die Plugin-Übersicht; `appearance: true` verwendet standardmäßig Allgemein. App-Code darf diese Angebote konfigurieren, aber keine Kopien ihrer Darstellung oder Registrierung enthalten.
- Eingehende Einladungen verwenden im Organisations-Plugin denselben vertikalen Listenaufbau wie Mitglieder: Abstand zwischen Seitenkopf und Inhalt sowie zwischen Suchfeld und Tabelle. Kein layoutloses Fragment direkt im Settings-Inhaltscontainer.

- Eingehende Einladungen tragen optional `organizationId` und `organizationLogo`. Die Organisationsliste zeigt den zentralen Avatar mit geliefertem Logo, sonst einem bereits autorisiert geladenen Organisationslogo oder Initialen. Keine zusätzlichen unautorisierten Organisationsabfragen für Logos. Better Auths native Einladungsliste liefert derzeit nur Organisationsnamen; ein nicht geliefertes Logo kann die UI nicht erfinden.

- `authPageLayout` im Better-Auth-UI-Plugin trennt echte Anmeldung (einschließlich „Konto hinzufügen“) vom optionalen Katalograhmen `pageLayout`. Die Content-App bindet dafür den paket-eigenen `AuthPageLayout` ein. Der Multi-Session-Menüeintrag verwendet weiterhin die offiziellen Auth-Pfade; vorhandene Sitzung nicht zum Hinzufügen eines Kontos abmelden. Login und Rückkehr zur App sowie Kontenwechsel gemeinsam testen.

- Organisationsanbindung: Die Content-App komponiert `organizationsPlugin` mit `betterAuthOrganizations` und dem paket-eigenen `sessionOrganizationBackend`. Nur ohne echte Sitzung darf der ausdrücklich lokale Demo-Anbieter verwendet werden; bei API-Fehlern niemals auf Demo-Daten wechseln. Kontowechsel leert vorhandene Organisationsdaten; Schreibvorgänge mit veraltetem Benutzerkontext werden abgewiesen.
- Der Better-Auth-Organisationsadapter verwendet native APIs für Erstellen/Aktivieren, Profiländerung (Website in Metadata, übrige Metadata erhalten), Logo und Löschen. Logo-Dateien werden wie bei der nativen UI als begrenzte Bild-Data-URL übertragen; der vorhandene Server validiert Format und Bildgröße. Keine Browser-Datenbankzugriffe und keine kopierten App-Endpunkte. Optional vorhandene Server-Erweiterungen bleiben vorrangig.
- Providerfähigkeiten werden beim Rendern aktuell ermittelt. Native Einladungen verwenden die serverseitige Standardgültigkeit; ohne Erweiterung bleibt die Gültigkeitsauswahl deaktiviert. Mitgliedssperren benötigen eine explizite Server-Erweiterung. Mitgliedschafts-/Rollenprüfung, deaktivierte Mitgliedschaften und tenantübergreifende Ablehnung bleiben serverseitig verbindlich.

- Organisations-Websites werden im Organisations-Paket mit derselben HTTP(S)-URL-Prüfung für Formular und Service validiert, inklusive Hostsyntax, Port, Zugangsdaten und Leerzeichen. Leere optionale Werte sind erlaubt; syntaktische Gültigkeit bestätigt keine Erreichbarkeit. Feldfehler zugänglich direkt am Website-Feld anzeigen, beim Erstellen und Bearbeiten prüfen. Der Auth-Server bindet dieselbe Prüfung ein.
- Better Auth kann eingehende Einladungen vor E-Mail-Bestätigung gezielt verweigern. Nur diesen konkreten Fehler als Hinweis für persönliche Einladungen behandeln; er darf nicht Erstellen und Verwalten eigener Organisationen blockieren. Andere API-Fehler weiterhin weitergeben.

- Organisationsformulare verwenden das vorhandene React-Hook-Form-/Zod-Muster (`onTouched`, Nachprüfung bei Änderung) und zentrale FieldError-Komponenten. Kein separater boolescher URL-Fehlerzustand und keine Browser-Popups als Ersatz; Feldfehler unter dem jeweiligen Input mit aria-invalid/aria-describedby verbinden.

- Website-Domains zusätzlich mit der gepflegten Public-Suffix-Datenbasis von tldts prüfen: eine registrierbare Domain unter bekannter ICANN-Endung verlangen (lokale Hosts/IPs bleiben für Entwicklung erlaubt). Ein Punkt allein reicht nicht, etwa bei www.mva. Das ist keine DNS-/Erreichbarkeitsprüfung; Fehler bleiben im Standard-RHF-/Zod-Feldpfad.
- Organisationsadapter lädt voneinander unabhängige Abfragen parallel und ignoriert reine Session-Fetching-Flag-Änderungen. Die Organisationsauswahl bleibt während des Ladens aufklappbar und benennt den Ladezustand; Schreibvorgänge warten weiterhin auf den verifizierten Kontext.

- Für die aktive Organisationsidentität im Better-Auth-Adapter die native `getOrganization`-Metadatenabfrage verwenden, sofern verfügbar. `getFullOrganization` lädt zusätzlich Mitglieder, Einladungen und Teams und führte beim echten Backend zu langen/hängenden Ladevorgängen. Die Metadatenroute prüft weiterhin Mitgliedschaft; Rollen/Sperren und die abschließende Kontextprüfung bleiben erhalten.

- Die Content-Studio-Navigation verwendet für angemeldete Nutzer den unveränderten `OrganizationSwitcher` aus Better Auth UI, mit voller Slotbreite und ohne Links zum Demorahmen. Der native Erstellungsdialog fragt Name und Kennung ab; Website/Logo bleiben im Organisationsprofil. Der lokale Demo-Einstieg behält seinen Demo-Switcher. Standard-UI nicht parallel nachbauen.

- Better Auth liefert Datumsfelder teils als Date-Objekte. Der Adapter normalisiert sie an der Paketgrenze zu ISO-Strings — für Mitglieder sowie eingehende und ausgehende Einladungen. Datumsfilter dürfen nicht auf unnormalisierte SDK-Daten treffen; ausgehende Einladungen ausdrücklich in Regressionstests einschließen.

- Session-Antworten sind neue Objekte, auch wenn Konto und aktive Organisation gleich bleiben. Die Organisationsanbindung invalidiert anhand der tatsächlichen Benutzer-/Session-/Organisationsidentität und relevanter Auth-Zustände, nicht anhand der Objektidentität. Normales Session-Refetch darf weder Mitgliederlisten leeren noch offene Einladungsdialoge als Kontextwechsel behandeln.

- Organisationsprofil: Initiales Laden und Ladefehler vor dem Leerzustand prüfen. Fehlgeschlagene Abfragen dürfen nicht als „Bitte wähle eine Organisation“ erscheinen; zentralen Alert und erneutes Laden anbieten. Lange Auth-Antwortzeiten mit Client-/Server-Datenbanklaufzeiten abgleichen, bevor UI-Optimierungen als Behebung gelten. Ein erfolgreicher Memory-Test bestätigt keine stabile echte Datenbankverbindung.

- Lokale Supabase-Verbindung: Bei wiederholt langen Direktverbindungen den vom Dashboard angegebenen Session-Pooler vergleichend prüfen. Hier beantwortete der Pooler parallele Organisationsabfragen in unter zwei Sekunden, während direkte Verbindungen hingen. Die lokale Auth-Konfiguration nutzt deshalb den Session-Pooler; Zugangsdaten bleiben in ignorierter Env-Datei, TLS-/Hostname-Prüfung samt CA bleibt aktiv. Keine abgeleiteten Pooler-Hosts raten und keine TLS-Prüfung deaktivieren.

- Auth-Server mit Mail-Konfiguration über `npm run dev:content-auth` beziehungsweise nach dem Web-Build `npm run start:content-auth` starten. Beide laden die ignorierte `.env.mail.local`; direkter `next start` lädt diese Root-Datei nicht. Das vorhandene Ethereal-Testkonto fängt Nachrichten ab und stellt sie nicht an echte Empfänger zu. SMTP-Verify prüft nur Verbindung und Anmeldung; keinen tatsächlichen Versand behaupten.

- „Mitglieder und Einladungen“ im Settings-Katalog nur bei `canManage` anzeigen (Owner/Admin im Better-Auth-Adapter). Das Organisations-UI-Plugin aktualisiert die vorhandene Section über `updateSection` und die Service-Subscription; Cleanup gehört zum Plugin. Organisationsprofil und persönliche Einladungen bleiben sichtbar. Dies ist ausschließlich Navigation, keine zusätzliche serverseitige Lesesperre: Better Auths Standard-Leserechte für Mitglieder bleiben bestehen.

- Organisationsprofil für normale Mitglieder mit zentralen Item-/Avatar-Komponenten nur lesend darstellen: Logo oder Initialen, Name, Kennung und Website. Keine Editierfelder, Upload-, Speicher- oder Löschaktionen. Owner/Admin behalten das vorhandene Formular; Better Auth autorisiert Schreibzugriffe weiterhin serverseitig.

- Rollenänderungen im Organisations-Plugin benennen das feste Ziel („Zum Administrator machen“ / „Zum Mitglied machen“) und verwenden den vorhandenen Bestätigungsdialog mit Person und Auswirkung. Kein blindes Umschalten. Nur einfache member/admin-Rollen anbieten; Owner und zusammengesetzte Rollen nicht überschreiben. Vor Bestätigung Organisationskontext und Ausgangsrolle erneut prüfen; eigentliche Autorisierung bleibt im Service/Better Auth.
- Die Website im lesenden Organisationsprofil als Link innerhalb der zentralen ItemDescription anzeigen, mit vorhandener Website-Validierung und sicherem Öffnen in einem neuen Tab. Keine lokalen Link-Stilabweichungen.

- Zwei-Faktor-Authentifizierung verwendet Better Auth `twoFactor`, `twoFactorClient` und Better Auth UI `twoFactorPlugin` unverändert. Die plugin-eigene Sicherheitsseite rendert dessen native securityCards; Challenge-Routen kommen aus viewPaths. Host-Dateien konfigurieren nur die Standardplugins. Das Auth-Schema enthält die vollständigen Felder der installierten Version; Migrationen schützen twoFactor per RLS und entzogenen öffentlichen Rechten. Keine automatische Aktivierung für echte Nutzer: TOTP-Bestätigung und Wiederherstellungscodes bleiben beim Nutzer. Standardmäßig ist ein Kontopasswort nötig; OAuth-Anmeldung erhält keine selbst erfundene zusätzliche Challenge. Isolierter Integrationstest prüft Einrichtung, Challenge und Backup-Code.
- HeroUI Tooltip.Trigger kann denselben DOM-Knoten wie ein Button verwenden (z. B. OpenEmailButton). Die Tooltip-Regel überschreibt sonst inline-flex mit inline-block und stellt das Icon unter den Text. Die zentrale Theme-Brücke erhält für `.button.tooltip__trigger` das native Button-Flexlayout; keine lokale Ersatzkomponente.
- Auf Nutzerwunsch steht die native Zwei-Faktor-Aktion optisch innerhalb ihrer Karte unter dem Beschreibungstext. Der Settings-Adapter markiert den Bereich; die zentrale Theme-Brücke ordnet unveränderte Upstream-Elemente über Grid/Subgrid mit Standardabständen an. Keine kopierten Dialoge oder Auth-Handler. Bei Upstream-DOM-Änderungen diese Darstellung erneut prüfen.
- Native Better-Auth-Menüs erwarten führende Icons in Standardgröße size-4. Host-Reicon-Elemente haben ohne Größenklasse 24px statt 16px und verschieben den Text. Die zentrale UI-Theme-Brücke normiert direkte führende SVGs in menu-item auf size-4/shrink-0; Untermenü-Indikatoren bleiben unverändert.


### Gemeinsame Datei-Discovery und Config

- Verbindliche Grammatik und implementierte Grenzen stehen in `packages/core/docs/file-contributions.md`. Punkte und Ordner ergeben dieselben Segmente: `actions.refresh.ts` = `actions/refresh.ts`, ebenso Services, Interceptors und Config. Eine zentrale Erfassung/Normalisierung unter `core/discovery/entries.mjs`; keine separaten Scanner pro Art hinzufügen.
- Default-Exports mit dem TypeScript-Parser erkennen, nicht Beiträge zur Erkennung ausführen. Manifeste/Build-Konfiguration sind weiterhin vertrauenswürdiger ausgeführter Code. Hilfsdateien ohne Default-Export und `-`-Segmente ausschließen. Alte Suffixe bleiben Migrationsaliase; gleiche logische Pfade dürfen nicht doppelt registriert werden. Ein alter `index.action.ts` bleibt eine Action, während `actions/index.ts` die Sammlung bezeichnet.
- Actions/Services/Interceptors unterstützen Sammlungen. Automatische IDs aus Modul und lokalem Pfad ableiten; explizite IDs und geteilte Service-Keys erhalten. Service-Typen deaktivierter Plugins nicht als installiert deklarieren. Die optionale App-Modul-ID wird aus `src/plugin.config.ts` gelesen; ohne sie bleiben alte unpräfixierte App-IDs kompatibel.
- Config liegt unter `configs`; Action-Config unter `configs.actions.<lokaler Pfad>`. Kein Alias von `configs.refresh` zu `configs.actions.refresh`, kein stiller Plugin-Fallback. Der gebundene Scope kommt aus der registrierten Herkunft, nicht aus einem globalen aktuellen Action-Namen. Manuelle Definitionen können `configPath` setzen. App-Replacements behalten die Herkunft der ersetzten Plugin-Action.
- Config-Service hält einen unveränderlichen Runtime-Snapshot; Host-Overrides separat in `configOverrides`. Optionales synchrones Schema vor Service-Erstellung prüfen; keine eigene Schema-Validierungsbibliothek schreiben. `ConfigMap` unterstützt typisierte Zugriffe, typisiert jedoch freie Callback-Parameter nicht automatisch. `usePluginConfig` liest den Runtime-Snapshot; keine automatische Mutations-Reaktivität behaupten. Benutzerpräferenzen bleiben bei AppPreferences.
- Config-Kontext ausdrücklich an Action-Adapter übergeben. Keine abgeleitete Runtime via `Object.create(runtime)`: Methoden würden Dialogzustand an der Kopie statt an der wirklichen Runtime verändern. Action-Factories/Konstruktoren und Service-`create` erhalten Config bereits bei Erstellung.
- Plugin-Interceptors gelten standardmäßig lokal; Host-Interceptors aus Kompatibilitätsgründen global. Expliziter Scope und numerisches `order` sind möglich. Ohne App-`enabled`-Liste werden erkannte Interceptors aktiviert, mit Liste nur deren Auswahl; Provider-Auswahl bleibt ausdrücklich. Eigentum anhand registrierter Actions prüfen, nicht anhand von ID-Präfixen. Cleanup im bestehenden Runtime-Lifecycle erhalten.
- Client-Discovery schließt `server`-Dateisegmente aus; das ersetzt keine Prüfung transitiver Server-Imports durch den Host. Server-Discovery, Decorators, YAML, reaktive Config-Updates und Co-Location bleiben offen. Neue Beitragsarten brauchen einen Adapter, gegebenenfalls Typgenerierung/Lifecycle-Unterstützung, aber keine neue Dateisuche.

### Package-Aufräumen: bestätigte Richtung, Migration noch offen

- Zielstruktur und optionale Ordner: `docs/architecture/package-structure-standard.md`. Keine leeren Pflichtordner erzeugen; öffentliche Einstiege klein halten und vorhandene Paketgrenzen respektieren.
- Native Better Auth UI vor eigener Organisationsoberfläche verwenden. Nur notwendige, ausdrücklich vereinbarte UI-Erweiterungen gehören zu better-auth-ui; organizations behält verwendete Headless-Verträge und Services. Vor Entfernung beide App-Verbraucher migrieren und Funktionsabdeckung prüfen.
- Better Auth UI upstream re-exports now live under `src/upstream`, preserving public import paths. Organization UI ownership has moved to better-auth-ui; native replacement of custom/demo behavior remains a separate task. Better-auth ist nicht leer: Auth-, Organisations- und Mail-Anbindung bleiben separate Headless-Verantwortlichkeiten.

### Repository writing language

- Write all new or modified documentation, code comments, and development guidance in English. A Persian conversation does not authorize Persian repository content. Preserve localized product translation catalogs as product data.

### Root application module and package cleanup

- Content Demo now owns actions, services, and components directly under src, with routes and layouts under src/app; it is not nested inside src/plugins/content. Future independent local plugins may still use a plugins directory.
- Root application pages, views, dependencies, and setup participate in the existing runtime lifecycle. Root setup follows declared plugin dependencies and cleanup runs in reverse order.
- Host application pages use native framework routing: in Next.js, src/app/**/page.tsx and layout.tsx. Do not create root pages.*.tsx Foundation definitions for app-owned pages. Discovery pages are for independent plugins, rendered through the host catch-all. src/pages remains reserved for the Next.js Pages Router.
- Better Auth UI upstream re-exports now live in src/upstream, with public plugins and email exports preserved. The custom organization UI is now owned by better-auth-ui. Native replacement of its custom/demo behavior remains a separate task; do not describe that replacement as completed.
- Every existing workspace package currently has consumers. The Next adapter invokes Core discovery, watches changes during development, and connects Action navigation to Next Router/Link; it is not a duplicate discovery implementation.

### Custom component ownership after cleanup

- Organizations is now headless. Both apps import its custom UI from `@bitakit/better-auth-ui/organizations`; UI tests live in that package. The former organizations/react and organizations/styles.css exports are removed; the lightweight replacement stylesheet is better-auth-ui/organization-styles.css.
- Foundation-authored UI belongs under components; unchanged external re-exports belong under upstream. Document each custom component's purpose and relationship to native components in better-auth-ui/CUSTOM_COMPONENTS.md. Do not call a custom service-backed component an upstream override unless it actually overrides a public extension point.
- The current custom organization pages preserve demo behavior, membership suspension, website/logo forms, and Action-group integration. These remain in use; moving ownership is not proof of native feature parity and is not a reason to remove behavior.
- Shell now separates public exports, plugin composition, the shell service key, and app-shell rendering. Preserve its existing theme subscription and stable content ancestry.

- Keep Better Auth UI upstream re-exports flat: upstream/organization.ts, upstream/two-factor.ts, etc. Do not add an extensions subdirectory when it adds no distinct responsibility. Public plugins/* imports map to these flat files through package exports.

- Better Auth UI settings belong in src/settings: organizations.tsx owns organization settings views, catalog registration, and role subscriptions; account.tsx owns account settings. Reusable custom controls remain in components.

## Minimal host application code

- Reuse the existing Foundation architecture and package APIs before adding host code. Keep application code limited to product behavior, native framework routes, and essential composition/configuration.
- Core already manages service registration, plugin lifecycle, and plugin-provided providers. The Better Auth adapter already registers the shared authentication service. Use these mechanisms; do not introduce a parallel registry, provider bootstrap, session store, or authentication binding in the app.
- Keep reusable provider-specific wiring in its optional adapter package, not Core or duplicated host files. Preserve server/client boundaries and explicit server configuration.
- Before adding host infrastructure, identify the concrete gap in existing package APIs. Moving boilerplate to another app folder is not simplification. Do not add wrappers or abstractions solely to reduce visible line count.
- Keep demo/catalog code separate from required application integration so it can be removed independently. Preserve native framework routing for app-owned pages.
- Write all new documentation, development guidance, and code comments in English, regardless of conversation language. Product localization catalogs are separate from this rule.

- Content Demo no longer registers the Better Auth component catalog, its showcase navigation action, or demo layout. Native account/organization pages use the existing WorkspaceLayout; authentication uses AuthPageLayout. Keep the package public component exports available independently of the removed app showcase.

- Content Demo keeps its remaining host authentication options in src/auth.tsx. The removed features/better-auth/plugin.tsx directory contained no independent application plugin after the showcase was deleted; do not recreate that wrapper. This is host configuration using existing package factories, not a new auth registry.

- Standard Better Auth browser client creation belongs to better-auth/client. Better-auth-ui's createBetterAuthIntegration composes the existing service and UI plugins using a single client and owns QueryClient/default UI extensions. It is not a second registration mechanism; register the returned plugins through Core. Content Demo retains only host customizations in src/auth.tsx.
- The standard client/UI preset includes organization/teams, multi-session, API keys, and two-factor, matching the existing demo. Client plugins append extensions; an explicit provider.plugins list replaces UI defaults. Native lower-level factories remain available for other presets. Matching server extensions and secrets stay explicit; never claim that activating browser UI configures the server.

### Headless boundary supersedes earlier Core React organization

- Core contains no React imports, React types, TSX renderer modules, or React dependency. Generic opaque presentation contracts may carry host payloads, but Core does not render them.
- All existing React hooks/providers/control bindings and host-driven dialog rendering now live in packages/ui. The old core/react and core/actions/react exports are removed. Use @bitakit/ui and @bitakit/ui/actions.
- User-approved shared base components now live behind packages/ui `./components`: StandardActionMenu, Button and DropdownMenu. Keep generic bindings separate from this visual entry. Do not add Shell, Settings or application behavior to these components.
- Shared standard visual components complement the generic bindings; they do not replace them. Preserve central host theme tokens and keep Core free of React and UI libraries. Core boundary tests and UI behavior tests remain separate.

### Source readability

- Document public classes, functions and hooks with concise English JSDoc explaining responsibility, ownership and relevant lifecycle behavior. Avoid comments that merely repeat a symbol name.
- Maintain a source responsibility map in each affected package README. Keep entry points small and distinguish state ownership, optional adapters and rendering. Do not add folders solely for symmetry.
- Settings owns its bindings, default controls (standard shadcn Radix Vega primitives with central theme tokens) and views. Only the optional `./foundation` entry depends on Core and the Foundation UI bindings; only `./actions` integrates Core Actions.

- Group Settings definition classes and builders under src/fields, including the shared Setting base. Keep public exports in core.ts stable; add future setting kinds to that directory instead of scattering them in src. Renderer registry and builders live under src/renderers, the Foundation integration under src/foundation.

- Group Settings section/group definitions, catalog registration and navigation projection under src/catalog. AppPreferences remains the value/persistence owner; catalog organization does not introduce another store.

- Main sidebar navigation uses the same host Button secondary/ghost selection treatment as Settings. The default navigation group without a title is labeled Allgemein by explicit user request; preserve titles and IDs of other groups.

- UI implementations are grouped under components, hooks, providers, bindings and types. Root files are public exports only. Preserve package import paths when reorganizing internals. Prefer a directly usable component with host-mapping defaults and optional overrides over requiring every app to call a factory and repeat its mappings.

### Visual plugin ownership

- Shell and Better Auth UI own only their needed visual controls and direct library dependencies. Do not recreate host-components catalogs, component lookup registries or automatic discovery of host controls. The Settings renderer service is the one approved, typed registry for preference rendering; do not add others. Generic UI bindings remain library-independent.
- All visual plugins inherit application CSS theme tokens. A richer centralized theme service and provider injection are deferred; do not add another settings authority.
- Content Demo now uses real authentication only. Its sample content, local user/profile, workspace service and demo entry are removed. The reviewed minimal host composition uses the Next FoundationProvider; retain only application-specific options.

- Workspace authentication gates reuse AuthPageLayout so direct signed-out visits retain the standard centered layout. Browser tests identify the native organization switcher by its accessible label; it selects organizations, not teams. Test team management on the native team page instead of expecting team entries in the organization menu.


### App Preferences rename and renderer consistency

- The package is `packages/app-preferences` / `@bitakit/app-preferences`; register `appPreferencesPlugin` with plugin ID `app-preferences`. The confirmed-value owner is `AppPreferences`. Preserve stored keys, existing service keys and Settings routes during the rename.
- Standard visual controls belong to the optional App Preferences package. Reuse shadcn Field, Switch, Checkbox, RadioGroup, Select, Input, Textarea, Card and Button. Do not rebuild controls with styled HTML or inject a host component catalog. Shell and Web reuse its choice-card renderer.
- Plugin composition lives in `src/plugin.tsx`, renderer services in `src/services`, and the initial-render bridge in `src/providers`. Discovery reuses Core's contribution pipeline.
- Custom default renderers must seed both initial snapshots and the mounted service. Test custom defaults through SSR, hydration and mount, not only declarative overrides.
- Multi-choice values are immutable arrays of declared strings. Use standard schema validation and the same persistence owner; orientation and columns affect presentation only.

### Shared host theme and primary hover

- `packages/ui/theme.css` owns the shared theme tokens, geometry and control finishes and is exported as `@bitakit/ui/theme.css`. Existing apps import it through `apps/theme.css`; generated apps import the package directly; retain only intentional application token overrides locally. Keep visual CSS out of headless Core and generic UI bindings.
- Primary hover lighting is defined once for shadcn default buttons and native auth primary buttons. Preserve focus shadow layers, disabled/pressed states, forced colors and reduced motion; do not add per-button glow classes or duplicate the effect in plugin CSS.

- Shell predefined preferences live in `packages/shell/src/settings/appearance.ts`; the public React-free definitions entry re-exports them. Declare the built-in `cards` variant on these fields. Shell renderers only enrich the shared App Preferences `CardsControl` with icons; do not restore a Shell-specific choice-card implementation.

- Shell contributes its existing appearance page under the default Appearance category. Settings sidebar and mobile drawer project the same catalog; do not add duplicate manual links. Hosts can still override the category. The Theme page uses this same mechanism; future Branding pages must also contribute through it.

- Shell visual preferences live in `src/settings/theme.ts`; their confirmed-value DOM projection lives in `src/theme/projection.ts`. Preserve stable `shell.style` keys and restore host tokens on disposal. Use Color.js for primary foreground contrast and the native color input with standard fields; do not introduce another preference store.
- Settings navigation and overview must include field-based sections (`fields.length`), not only legacy groups or custom components. Otherwise registered preference pages silently disappear from both sidebar and mobile drawer.

- Shell keeps only public entry points and plugin composition at the source root. Settings implementations live in `src/settings`, the application shell in `src/components`, service contracts in `src/services` and theme projection in `src/theme`. Preserve public package exports when moving implementation files; import catalog projection directly from App Preferences.

- App Shell has two fixed layout variants (`sidebar`, `navbar`). `AppShell.layouts` can replace each variant's Navigation and optional Header; the content subtree stays owned by AppShell so unsaved component state survives switching. No layout registry or discovery is needed for this contract.
- Shared standard sidebar/navigation primitives and AppBar live in UI's optional `./components` entry. ActionSidebarNavigation and ActionNavigationMenu consume the existing Action bindings. Do not copy action state, add a second ActionList or move Shell preference ownership into UI.

- Content Demo has no local UI primitive library or host UI mapping. Use `standardFoundationUI` from UI's optional components entry. Retain only framework routing, application configuration, Action contributions and necessary provider/workspace composition. Do not add app-only wrappers merely to make the host appear smaller.

- Content Demo is an empty host: its root page returns no content, authentication returns to `/`, and no demo Actions or standalone members page are registered. `organizationUIPlugin({ path: false })` retains Settings integration while omitting the standalone page and its navigation Action. Generic plugin routing remains available for installed plugins.

### Minimal host and public app access

- The Next root entry exports FoundationProvider with standard UI/labels and native navigation defaults. Generic UI's provider owns the sole ActionProvider unless a host provider already exists; in that case it reuses the host's list and options. Do not add another host ActionList or provider wrapper.
- App Preferences' plugin bridge supplies SettingsProvider when absent. Preserve an explicit outer identity-scoped provider. Storage namespace and confirmed-value ownership remain unchanged.
- withFoundation runs Core discovery and aliases the generated app module for Webpack and Turbopack. The Next generator writes foundation-env.d.ts so the host compiler includes generated types. Ignore that file and .foundation in Git. Missing foundation.config.ts means defaults; malformed existing configuration remains an error.
- Core discovery reads opt-in Foundation metadata from direct dependencies and optionalDependencies exposing package.json. The foundation.plugin subpath default-exports a synchronous Plugin factory; optional foundation.configuration metadata passes a resolved root config path, otherwise no argument is passed. Emit client imports without executing them at build time; invoke factories per provider composition. Factories describe resources; service construction and disposal stay in the existing runtime.
- foundation.discovery points to a trusted Node-safe default factory of contribution kind descriptors. Explicit kinds override package defaults by name; preserve existing validation for duplicate kinds and folders. App Preferences exposes its discovery descriptors this way.
- packages: false or a package-name false entry disables automatic package contributions. Generated types must drop disabled/removed package capabilities. Do not activate arbitrary, transitive or development dependencies. Backend configuration and credentials remain explicit.
- Plugin publicServices maps public app names to existing typed service keys. The app facade projects the current runtime container; it is not another service registry. Public aliases live under app.services and must not collide within that namespace.
- useFoundationApp belongs to UI, subscribes to readiness, and returns existing instances. Direct required access reports FoundationServiceError; app.optional.services provides availability checks before mount and after removal. Service data still requires its own subscription hook. Never claim direct access is reactive or retain disposed services.
- Local contributions and installed package factories provide generated public-service completion. Manual compositions can use useFoundationApp<typeof plugins>() with precise tuple/factory types. Broad Plugin annotations erase exposed property types. Compile-time absent-property errors and missing npm imports cannot be replaced by runtime diagnostics.
- createBetterAuthIntegration optionally composes the existing organization adapter and UI through organizations options, sharing its auth client and defaulting to accountSettings.catalog. Do not duplicate that wiring in hosts or claim this activates backend organization support.
- Content Demo uses the single Next FoundationProvider with additionalPlugins for configured packages. No direct generated-file import or default foundation.config.ts is needed. Keep its host-owned labels, persistence keys, auth options, routes, Shell choices and toast behavior.
- Organize additions by responsibility (app access, providers, hooks, routing, discovery) with small public entries and concise English lifecycle/ownership comments. Avoid both flat file piles and unnecessary folder nesting.
- Validate changed contracts with focused type, lifecycle, discovery and hydration tests. Do not repeat successful checks without new changes or run full builds/browser suites for unrelated edits.

- Local discovery treats each immediate folder under src/plugins as a plugin. plugin.config.ts is optional; its explicit ID overrides the folder name. foundation.config.ts can override the directory. Reuse the existing scanner and contribution pipeline.
- Local defineService contributions expose app.services using their relative file path or explicit ID. Preserve the existing module-scoped raw service key and runtime ownership. Generated types infer method inputs, outputs and promises without requiring manual ServiceKey declarations for ordinary local services.
- app.actions projects dotted Action IDs as typed references. References execute through the existing ActionList, reflect current registrations and guards, and exclude internal actions from enumeration. ActionButton, ActionBinding and useAction accept same-list references; do not duplicate action state.
- Plain command execution receives app alongside the existing services/config context. Setup retains its existing scoped contract. Do not imply that setup or service factories receive the new app facade.
- Services have no root-level aliases. Use app.services, app.actions and app.optional.services consistently in examples. Preserve existing action input contracts; this change does not add an action-parameter system.

### Discovered Config and Settings facades

- app.config projects the existing immutable module snapshots, with generated property types. Low-level scoped access remains runtime.configuration; config callbacks retain plugin/action scopes. defineConfig accepts defaults without requiring a schema.
- AppExtensionMap and plugin appExtensions let optional packages project their own instance-local facades. Core stays independent of Settings and React. Do not create another value store or contribution registry.
- ID-free defineSettings declarations resolve during discovery using plugin ID plus file path (the root app prefix is app). Explicit collection IDs replace that prefix. Keep IDs stable or migrate stored keys when renaming files; never silently rewrite persisted values.
- app.settings exposes definition-compatible get/set handles. UI bindings resolve them to the original definition and reject a different preferences owner. Direct get is not reactive; useSetting and SettingToggle subscribe through existing AppPreferences. Initial bindings use the static contribution snapshot until registration completes.
- App Preferences package metadata activates its default plugin and discovery kinds. Its default is browser-local storage with the foundation.settings. prefix; unavailable storage means read-only defaults. Server persistence and identity configuration remain explicit.
- Next additionalPlugins replaces discovered entries with matching IDs, enabling a configured AppPreferences instance to override the default without duplicate registration. Preserve existing host storage keys and options.
- Interceptors continue to use the existing auto-discovery, plugin-local default scope and cleanup. No additional interceptor binding or registry is needed.

### Typed Action state and instance-style execution

- defineAction<Input>()({ initialState, execute(input) { ... } }) supports inferred custom state and results. Use method syntax so this is bound; arrow functions cannot access the action instance this. The existing context-style defineAction({...}) remains supported.
- this.app/services/config reuse the command context. this.state.get/update read and update the existing registration snapshot. Never add a second state store. Initial state uses a fresh structured clone per registration; require cloneable state and immutable updates in examples. Input and execution results remain per-invocation values, separate from state.
- ActionStatus is owned by Core and exported publicly. Idle/Pending/Succeeded/Failed track execution; pending still guards concurrent calls. Failed executions reject and retain their error; successful retries clear it. Skips preserve prior status/error after any temporary interceptor wait.
- Stateful adapters preserve registration ownership across awaits. Late updates cannot mutate a replacement action; removal resets state on the next registration. State is not persistent storage.
- Discovery includes custom state in ActionMap. useAction exposes its read-only type; ActionButton/ActionBinding reuse the existing guards and subscription store. Do not repeat these guards in host buttons.
- Keep inferred definitions in contribution modules and their app consumers separate. Reading the generated app namespace before its own inferred definition in the same module can cause a TypeScript augmentation cycle; this also affects legacy definitions. Do not claim arbitrary circular definitions are supported.
- Focus checks on inferred input/state/result, enum typos, async status/error, skipped executions, stale ownership, per-runtime isolation and ActionButton subscriber updates.

### Mixed Action and Service interceptors

- Both kinds use the existing interceptors discovery pipeline. Default exports may be single definitions, named collections or arrays. Array support is specific to interceptor normalization; do not silently expand unrelated contribution grammars.
- defineActionInterceptor marks Action definitions; legacy defineInterceptor remains supported. defineServiceInterceptor marks Service observers. Folder names only organize files and never override the discriminator.
- Service observers explicitly select a public service alias or raw container key and optionally a method. Generated service contracts infer arguments and awaited results. Omitting the method observes public string-named methods; constructors and symbol methods are excluded.
- before/after/onError service hooks only observe. Their return values do not replace outcomes, their failures are isolated and their promises are not awaited. Preserve sync return behavior, original Promise identity, thrown/rejected errors, and original receivers for private fields.
- Decorate services once during container construction, before dependents consume them. Reuse the same wrapper for raw container access and app.services. Do not add a second service registry. Dispose original instances and disable observers when the container is disposed, including late Promise settlement.
- Internal self-calls and calls through retained original references bypass observation. The service facade supports normal object/class methods, including frozen objects; do not claim transparent reflection or callable-function proxy semantics.
- Keep Action cancellation and lifecycle observation on the existing Action pipeline. Do not infer that Service observation adds argument/result transformation or cancellation.

### Automatic Shell composition

- Shell opts into installed-package discovery with `foundation.plugin` and `foundation.configuration: "shell"`. Both Shell and App Preferences remain direct host dependencies; never activate arbitrary transitive packages.
- Optional root `src/configs/shell.ts` uses the existing `defineConfig` contract. Discovery passes resolved root configuration to opted-in factories without importing client plugins during generation. Factories remain synchronous and resource-free.
- `shellPlugin()` resolves the existing `settingsService`; explicit settings remain compatible. Its provider shares definitions only, never preference values. `useShellLayout` uses App Preferences `useSetting`, including its pre-mount snapshot.
- Shell layout defaults are per provider instance. Saved choices override them; preserve `shell.layout` and `shell.theme` storage keys. `navigationGroups` selects navigation, while legacy `groups` places the settings action.
- Next supplies pathname and Link through the existing ActionProvider UI context. Navigation uses these defaults unless explicit props override them. Native route layouts still choose where `<AppShell>` appears.
- Content Demo discovers Shell automatically and keeps its prior options in `src/configs/shell.ts`; its host preferences storage prefix and authentication integration remain unchanged. Shell now owns the shared HeroUI notification surface.


### Action feedback, keyboard bindings and individual preference reset

- Runtime feedback is opt-in for every contribution kind. Supplied success/failure literals or dynamic translated messages follow only their corresponding outcome; missing/false/empty messages stay silent. Do not restore convention-based fallback Toasts. Errors still reject with the existing ActionFailure/cause contract.
- Runtime owns one failure observer through its existing execution lifecycle. Outcome-aware `notify(message, kind)` is presentation-only, including asynchronous rejection isolation and ownership-safe cleanup. Hosts must not Toast the same ActionFailure again from ActionProvider.onError. The approved default renderer is HeroUI in Shell. Content Demo removes its Sonner callback/surface and disables the duplicate native surface via our Better Auth UI adapter option; upstream code remains unchanged.
- Action shortcut metadata stays framework-independent in Core. UI ActionProvider owns TanStack Hotkeys registration, once per public Action independently of controls. Use active scopes and the existing ActionList execution guards. Required typed input must be explicit in shortcut.input; never guess row/input context from mounted controls.
- Keyboard defaults ignore editable fields, repeat/composition and handled events. Input opt-in is explicit. Library collision policy keeps the first binding and reports the second; cleanup releases ownership. Sidebar Mod+B uses the same manager. No Quick Find/command-palette plugin is included. Library formatting supplies platform labels after hydration.
- App Preferences owns resetControl and its existing reset callback, persistence, pending and errors. Default field views render it; Shell only places the same bound part in its cards. Custom layouts render exactly one reset affordance per field. Pending/read-only/disabled settings cannot reset; failed resets retain confirmed values and support retry. Default-valued fields may still reset to remove a stored override. Never reset unrelated preferences or Better Auth forms.

- Content Demo Turbopack previously resolved the generated absolute app alias as a server-relative import; Webpack is available for preview. Next additionalPlugins must replace existing entries in place, preserving provider order (especially settings.ui before shell.ui); append only new IDs. Package/type tests do not prove the host renders.


### Developer-facing notification service

- Design new Foundation features for developers first: expose reusable behavior through existing typed services and app access, not only implicit UI wiring. Notifications expose `app.services.notifications.show(message, options)` and `dismiss(id)` when Shell notifications are enabled. Shared `notificationService` is available to plugins through getService/requires. No second service registry or application wrapper.
- Shell notifications are opt-in; HeroUI is the default implementation. `notifications.service` accepts the existing ServiceDefinition create/requires/dispose contract without its fixed ID. `toastProvider: false` allows an application-owned replacement surface. Preserve the same public contract for callers; no vendor types leak into NotificationService.
- Shell owns the native position preference and renders one default HeroUI queue. Our Better Auth UI adapter supports `toastProvider: false` when Shell owns that surface; this is not an upstream modification. Native Better Auth calls continue to use HeroUI directly. The user explicitly accepted this external-library exception when a developer replaces the Foundation service.
- Use native supported logical start/end/top/bottom positions and App Preferences persistence/reset. The configured position is the default, persisted choices take precedence. Custom provider mode omits the HeroUI-only position page. Native queue sharing is browser-wide; do not claim per-runtime queue isolation or clear another consumer's notifications during cleanup.
- Verify public service access, replacement/disposal, one shared native surface, live position updates for both Action and native-source messages, and notifier cleanup. Package/DOM tests are not a full-host visual check when Next composition is blocked.

- Shell `notifications.layout` forwards the native HeroUI Toast.Provider children renderer through the existing Shell provider. It customizes all messages on that shared surface, including native Better Auth messages, without changing upstream. Preserve native Toast parts and required content in custom renderers; omitted layout retains native defaults. No runtime layout registry, setLayout or per-message custom-content API is introduced. App-owned surface mode ignores this option.

### Automatic Quick Search

- Quick Search is an optional discoverable package. Its dialog Action uses the existing Foundation dialog host and Mod+K shortcut binding; its view targets the standard AppBar `app-bar.end` slot. No host search component, provider, action registry or manual bootstrap is required. AppBar remains usable without Foundation.
- Search reads current public resolved Action snapshots and only safe URL destinations. Reuse ActionLink for native navigation without double execution, cmdk for filtering/keyboard behavior, central primitives/theme tokens and Reicon. Disabled/pending and hidden/internal guards remain authoritative. Group each Action once by its first existing group and search all group labels; do not invent a category model.
- Keep ephemeral dialog search local. Do not introduce URL state, persistence, remote content search or a second action registry. Package styles load with its entry; Content Demo only declares the package dependency.

- Quick Search imports its CSS from the concrete plugin module; preserve package sideEffects metadata for CSS-bearing entry modules so Next/Webpack does not prune the stylesheet. Verify actual computed layout in a browser; a DOM behavior test without CSS cannot establish visual correctness.

- App Preferences' Foundation setup projects its live SettingsCatalog into scoped URL Actions named `settings.section.<id>`. Registration, metadata/visibility/enabled updates and removal follow catalog subscriptions, with owned cleanup. The catalog remains the only section registry; standalone preferences has no Foundation requirement. Quick Search deduplicates identical destination URLs, preferring an explicit shortcut-bearing Action.

- All settings destinations, including Shell layout and organization profile, use the same App Preferences catalog-to-Action binding. Section navigation metadata may preserve a public Action ID, placements and shortcut; do not register a second independent settings URL Action. Presentation and permissions come exclusively from the section. Shell notifications declare their icon on their section.

- Shell sidebar scheme is an App Preferences field with app-following, light and dark choices. Project its confirmed value through the existing theme adapter; central sidebar palettes also color the inset backdrop. Keep the content theme independent and preserve projection cleanup.

- The vertical Shell content header uses background/foreground tokens, not sidebar tokens. An independent dark sidebar must not darken the content header while retaining light-theme text. Verify contrasting sidebar/content schemes in the rendered host.

- Native sidebar identity triggers must map HeroUI hover, pressed and expanded colors to sidebar tokens. Their portal menus retain the application popover theme; do not apply sidebar-only colors globally to portals or patch upstream components.

### Reactive shared translation access

- React consumers use `useTranslation()` from UI and call the returned `t(key, values?, fallback?)`. Core owns only the existing translator contract and runtime notification revision; no React dependency or second locale store. Service replacement remains normal plugin composition.
- Observe runtime translation notifications, not translator function identity: adapters may keep a stable function while their language changes. The App Preferences bridge uses the same hook. Settings messages resolve `settings.messages.<name>` with configured fallback text.
- Automatic settings navigation resolves explicit section keys, then `settings.sections.<id>.title/description`, and `settings.categories.<id>.title`; refresh and dispose its translation subscription with catalog ownership. This wiring does not itself supply missing message catalogs or translate hard-coded product text.

- Shell wraps the configured NotificationService factory once to resolve title and description keys through the current i18n service, with `options.values` interpolation and literal fallback. This also covers replacement renderers and forwards disposal to their original instance. External Better Auth notifications keep their native translation integration. Existing queued notifications are not retranslated on locale changes.

- TranslationService optionally exposes `getCatalog(namespace?)` for raw nested message groups. Omitted namespace requests the full catalog; missing groups return undefined. The Next-intl adapter reads its existing messages, with no duplicate catalog store. `createTranslationPlugin` accepts/updates the catalog accessor alongside the translator and notifies the same subscribers. Vendor integrations consume this public data API; never copy upstream implementation code.

- Foundation action metadata uses the shared runtime text path, with `<actionId>.title`, `.description` and `.tooltip` catalog fallbacks; supplied feedback may use `<actionId>.success/failure`, but absent feedback remains silent. Never translate Action labels separately in buttons, menus or search results.
- Settings section/category snapshots and automatic navigation resolve the same catalog keys; choice labels support `.options.<value>.label` alongside legacy string options, allowing descriptions in the same object. Raw settings message templates come from the catalog so interpolation is applied with actual values.
- Better Auth UI reads the `betterAuth` catalog group through the shared reactive hook and passes it to native AuthProvider.locale. Use published locale bundles at request composition and native plugin localization; do not pin separate plugin translations to an initial locale. No upstream code is copied or modified.
- Content Demo now composes Next-intl via its standard request configuration and plugin. Both examples use the `saas-foundation.locale` cookie and English/German catalogs. Interface text is translated; user content, names, identifiers and provider-returned error messages are not machine-translated. The shared hook falls back safely outside Foundation for standalone controls.

### Package-owned catalogs and language selection

- English/German plugin messages live in each owning package's `locales/`, exported through
  `./locales/*.json`; app catalogs contain product text and intentional overrides only.
  Shared UI dialog labels belong to UI as well as independently rendered adapter dialogs.
  Never put another plugin's messages in Core, a catch-all translation plugin or host catalogs.
- `mergePluginMessages` priority is app current locale, plugin current locale, app fallback,
  plugin fallback. Preserve per-key fallback and input immutability. New host locales may
  translate plugin keys without modifying installed package catalogs.
- `next-intl/preferences` composes the existing SelectSetting, SettingsSection and plugin
  contribution APIs. It uses configured locale options, with optional flags in their labels.
  Use the standard Select dropdown, not per-language buttons or radio lists.
- Content Demo persists `language.locale` through server actions to its existing HTTP-only
  cookie. App Preferences owns confirmed/pending/error/reset state; other preferences retain
  their existing storage. Cookie mutation updates Next's existing provider tree without a
  full document navigation. The Web app retains its existing language persistence path.
- Verify only relevant catalog precedence/fallback, language persistence/failure/reset and
  the real dropdown path. Browser tests use isolated Better Auth memory data, never shared
  accounts. Do not claim arbitrary unsaved form preservation from a no-document-reload check.

### Frontend project generator

- `packages/create-app` is a standalone Node CLI using Commander, Clack and the official
  pinned `create-next-app` empty scaffold. It offers Next.js and experimental TanStack Start (React). Core remains
  framework-independent; the existing Next adapter owns discovery/runtime integration.
- Keep orchestration and capability prerequisites shared. Each future framework adapter
  supplies scaffold/configure behavior; do not add unused adapters or a second runtime registry.
- Generate only native routes, required composition/configuration and selected dependencies.
  Import shared package styles/theme rather than copying plugin code or maintaining another
  theme. No demo business data, auth server, database, empty folders or host bootstrap layer.
- Never overwrite an existing destination. Preserve partial output on failure, propagate
  failures, and report completion only after selected installation succeeds. Support explicit
  no-install and dry-run modes and prompt cancellation before filesystem changes.
- The package remains private pending release review. Local npm tarballs and npm overrides
  support isolated verification before publication; do not silently link the monorepo or
  assume the npm scope exists. No package publication is authorized by generator work.
- TanStack implementation was authorized on September 30. Reuse the native nuqs adapter;
  Start remains experimental because upstream does not promise support. Record verified
  paths and versions rather than claiming complete portability. Do not replace nuqs.

### Framework adapter boundaries

- Core Actions never read browser globals to navigate. Headless callers explicitly supply
  navigation when mounting their ActionList; the UI ActionProvider owns the ordinary browser
  fallback. Framework providers replace that fallback with the app's existing router.
- Router packages are peer dependencies of their integration. Installing another router
  does not switch Foundation automatically. Hosts mixing routers must define route ownership;
  incompatible peer versions are not guaranteed to work. Keep this wiring inside the
  integration package rather than repeating router hooks in generated application providers.

- `packages/next` and `packages/tanstack` own framework routing and nuqs adapters. Core
  remains React/router/nuqs-free; do not introduce an adapter registry or parallel runtime.
- UI's optional `StandardFoundationProvider` owns visual defaults and ordered plugin
  overrides. Both adapters use it; replacements keep their discovered position and new IDs
  append. Explicit plugin lists retain existing semantics.
- Next's root provider supplies QueryProvider by default. Legacy standalone hosts use
  `@bitakit/next/query`; `queryState: false` is only for intentional outer adapters.
  Content Demo and generated hosts must not add redundant NuqsAdapter boundaries.
- TanStack mounts inside the router context and uses a Vite build plugin for discovery.
  Build setup is not a runtime plugin lifecycle. FoundationLink adapts dynamic hrefs;
  app-owned typed routes still use native TanStack Link. No mirrored location store.
- Shared compiler references use `generateFoundationHost` in Core's existing Node-only
  discovery entry. Generated type imports must omit unused contribution types so strict
  host `noUnusedLocals` stays enabled. Never suppress host checks to conceal generated errors.
- The CLI invokes official minimal scaffolds and installs only the selected host adapter.
  Pin the reviewed scaffold CLI and TanStack versions; keep Start visibly experimental.
  Check generated builds and relevant query/history behavior, not unrelated product suites.

### Developer documentation site

- `apps/docs` is the independent Fumadocs/Next.js workspace authorized on September 30.
  Keep English MDX guides in `content/docs` and use upstream layouts, search and components.
- The public quickstart targets application developers, not repository maintainers.
  Before npm publication, label public installation commands as a release preview.
  Keep local build/archive instructions in the contributor guide, not the public quickstart.
- Documentation contributions are reviewed repository changes, not runtime plugin registration
  or package publication. External providers may remain in their own repositories.
- Preserve experimental TanStack and unresolved Next discovery/Turbopack qualifications.
  The documentation site's own Next build does not exercise Foundation discovery.

### Repository preparation for Bita

- The root README is the concise product and contributor entry point. Keep current
  package names and pre-release limitations explicit until publication is verified.
- Keep database setup in `docs/development-environment.md` and API details in package
  guides. Do not restore outdated prototype APIs as installable examples.
- Code comments and new technical documentation are English. Preserve intentionally
  localized catalog values, UI strings and language-test fixtures during cleanup.
- Ignore local editor settings, scratch files and generated output. Remove confirmed
  obsolete scratch artifacts; do not delete credentials or user configuration merely
  to keep them out of a commit. Check commit candidates without printing secret values.

### BitaKit branding

The product name is BitaKit. The user-created npm organization `bitakit` was verified
in the signed-in organization settings. Package manifests, imports, generator templates, tarball matching and documentation
now use `@bitakit`. Preserve existing storage/cookie keys and Foundation API names;
this is a package-scope migration, not a persistence or API redesign. Documentation and README use the supplied
transparent light/dark BitaKit logos without recoloring. Registration is not publication.
