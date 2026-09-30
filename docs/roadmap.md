# Nächste Schritte

Besprochen am 20. September 2026. Planung, noch keine Implementierungszusage für diese Punkte.

- [x] Gemeinsame Anbindung für Plugin-Seiten mit eigener URL und bestehendem App-Rahmen. Plugins liefern Seitenkomponente und Pfad; keine manuelle App-Seite pro Plugin.
- [x] Kleines zweites Projekt mit den Packages anbinden und prüfen, dass kein Verbindungscode kopiert werden muss.
- [ ] Entwickleroberfläche weiter vereinfachen und den Ablauf „definieren, automatisch erkennen, UI anbinden“ kurz dokumentieren.
- [x] Erste Organisations-Plugin-Version: allgemeiner Service, Better-Auth-Adapter, optionale Mitglieder-/Einladungs-UI und lokale Browser-Demo.
- [ ] Bestehende Web-App vollständig migrieren; erweiterte Rollen, Sperren und weitere bisherige Spezialfunktionen ergänzen.
- [x] Austauschbarer serverseitiger E-Mail-Vertrag, Nodemailer-Plugin und Better-Auth-Mail-Hooks. Live-Versand und Einbindung in die bestehende Server-Auth-Konfiguration sind noch nicht geprüft/aktiviert.
- [ ] Globale Navigation-Suche aus der bestehenden Action-Liste: aktuelle Titel/Beschreibungen, Sichtbarkeit und Verfügbarkeit berücksichtigen, echte Links erhalten. Datensuche separat behandeln.
- [ ] Später einen Projektgenerator anbieten: dünnes Projektgerüst, Konfiguration, Provider, Plugin-Seitenanbindung und kleines Beispiel. Gemeinsame Logik bleibt in installierten Packages.

## Aktuelle Paketnamen

SaaS Foundation ist der gemeinsame Projektname, kein einzelnes Gesamtpaket.

- `@bitakit/core`: Action-Kern, Services und Plugins; React-Bindings über Subpfade.
- `@bitakit/app-preferences`: Settings-System.
- `@bitakit/better-auth` und `@bitakit/next-intl`: optionale Anbieter-Plugins.
- `@bitakit/next`: Anbindung der Dateierkennung an Next.js.

## Erweiterbarkeit für weitere Bereiche

- [ ] Optionale Fachpakete und Anbieterintegrationen vorsehen, etwa für Zahlungen und Abonnements. Stripe ist ein mögliches zukünftiges Beispiel, noch nicht umgesetzt.
- Fachpaket: kleine gemeinsame Verträge und klar ausgewiesene optionale Fähigkeiten.
- Anbieterintegration: konkrete Umsetzung dieser Verträge; keine Anbieterabhängigkeiten im Foundation-Kern.
- UI-Plugin: optionale Oberflächen und Actions, die die Fachservices verwenden.
- Nur benötigte Pakete installieren; Frontend und serverseitige Implementierung getrennt halten. Zugangsdaten und verbindliche Zahlungsprüfung gehören auf den Server.
- Keine vollständige Vereinheitlichung aller Anbieter erzwingen; anbieterspezifische Funktionen dürfen explizite Erweiterungen bleiben.

## Offenes Plugin-Ökosystem

- [ ] shadcn Registry als Installationsgrundlage prüfen, bevor eine eigene CLI entsteht:
      Plugin-Dateien, UI-Bausteine und npm-Abhängigkeiten gemeinsam einrichten.
- [ ] Paketinstallation und kopierbare Vorlagen unterscheiden; Updates dürfen lokale
      Änderungen nicht ungeprüft überschreiben.
- [ ] Versionsvertrag, erforderliche Services, Herkunft und notwendige Backend-Einrichtung
      für externe Plugins beschreiben. Kein eigener Marktplatz als Voraussetzung.
- [x] Integrationen und Plugins vereinheitlicht: Anbieter sind normale Plugins mit typisierten Service-Schlüsseln. Actions und Foundation liegen im Core, Anbieter in separaten Paketen.

- [ ] Better Auth vollständig aus der allgemeinen Host-Komposition herauslösen: optionale
      Anbieter-Anbindung mit optionaler UI. `apps/web` enthält aktuell noch direkte Auth-,
      Settings- und Organisationsabhängigkeiten; die Content-Demo hat keine Better-Auth-Abhängigkeit.
      Ein deaktiviertes UI-Plugin allein darf nicht als vollständige Backend-Entkopplung gelten.
