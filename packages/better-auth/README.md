# @bitakit/better-auth

Optionales Foundation-Plugin für einen bereits konfigurierten Better-Auth-Client.
`betterAuthPlugin(client, { signOut? })` liefert ein normales Plugin für die Foundation-Liste.
Es stellt den allgemeinen `authService` bereit: Sitzung, Änderungen und Abmelden.

Die Foundation übernimmt Beobachtung und Cleanup. Der Client und die Serverkonfiguration
bleiben beim Host. Die Basis-Anbindung implementiert keine Anmeldeoberfläche; Organisationen und E-Mail-Hooks
sind separate optionale Einstiegspunkte desselben Pakets. Es darf nicht als vollständiges Auth-Setup
oder Ersatz für serverseitige Rechteprüfungen verstanden werden.

## Organisationsanbindung

`@bitakit/better-auth/organizations` exportiert `betterAuthOrganizations(client)`.
Es implementiert den allgemeinen Organisationsvertrag mit den SDK-Methoden des bereits
konfigurierten Organization-Clients, einschließlich paginierter Mitgliederlisten.
Die UI kommt optional aus `@bitakit/organizations/react`.

Die aktuelle UI-Berechtigungsprojektion unterstützt die Standardrollen owner/admin/member.
Ein deaktiviertes Mitglied wird beim Laden abgewiesen. Eigene Rollen benötigen eine
angepasste Fähigkeitenprojektion. Backend-Policies und Suspension-Hooks bleiben Pflicht;
der Client-Adapter ist keine Sicherheitsgrenze. Eine bestehende Web-App wird nicht automatisch migriert.

## E-Mail (Server)

`@bitakit/better-auth/email` exportiert `betterAuthEmail(emailService, { invitationURL })`.
Das liefert die Better-Auth-Callbacks `sendVerificationEmail`, `sendResetPassword` und
`sendInvitationEmail`. Die ersten beiden gehören in die jeweiligen Auth-Optionen,
der dritte in die Organization-Plugin-Konfiguration. Der Host bestimmt seine echte
Einladungsroute. Texte sind derzeit deutsche Standardtexte; für andere Templates können
Host-Callbacks denselben E-Mail-Service direkt verwenden.

Die Callbacks hängen ausschließlich vom allgemeinen E-Mail-Vertrag ab, nicht von Nodemailer.
Sie werden nicht automatisch in eine bereits erzeugte Server-Auth-Instanz injiziert.

### Organisationsverwaltung

`betterAuthOrganizations(client)` unterstützt native Erstellung mit anschließendem Aktivieren, Profiländerung, Logo, Website-Metadata und Löschen. Die vorhandenen serverseitigen Better-Auth-Regeln gelten weiterhin. Optional können explizite Server-Erweiterungen diese Operationen übernehmen. `sessionOrganizationBackend(client, authenticated, signedOut)` trennt einen ausdrücklich lokalen Demo-Einstieg von echten Konten; Fehler des echten Backends werden nie mit Demo-Daten beantwortet. Host-Apps komponieren nur die Adapter, die Logik bleibt im Paket. Ohne Einladungserweiterung gilt die serverseitige Standardlaufzeit; Mitgliedssperren benötigen eine explizite Erweiterung.

## Standard browser client

`createBetterAuthClient` from `@bitakit/better-auth/client` creates the shared browser client with organization/teams, multi-session, API key, and two-factor extensions. These are client capabilities, not server activation: the server must configure the matching native extensions. Native client options such as baseURL are supported; plugins supplied to this helper append additional client extensions. Use the native createAuthClient and existing betterAuthPlugin directly for a different preset.

The main headless adapter entry remains separate from this browser-only subpath.

## Shared client navigation

Pass application-owned `paths: { signIn, afterSignIn, afterSignOut }` as the second
argument to `betterAuthPlugin`. An optional `signIn(options)` delegates a native login
flow; without it, `useAuth().signIn()` opens the configured application login page.
The existing `signOut` override remains supported. Use the shared UI hook for configured
post-logout navigation; avoid also redirecting inside the override.

See the [client authentication guide](../core/docs/auth.md) for configuration,
`AuthBoundary`, safe return destinations and a provider adapter template. These additions
are workspace APIs pending release. Native server configuration and login UI remain external.
