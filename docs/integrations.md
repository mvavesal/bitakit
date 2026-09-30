# Anbieter sind Plugins

Es gibt einen Plugin-Mechanismus und einen Service-Container. Kein separater
`integrations`-Bereich ist erforderlich. Die optionalen Pakete `@bitakit/better-auth`
und `@bitakit/next-intl` importieren den Core; der Core importiert sie nicht.

```tsx
const translation = useNextIntlPlugin();
const [authentication] = useState(() => betterAuthPlugin(authClient));
const plugins = useMemo(
  () => [...discovered.plugins, translation, authentication],
  [translation, authentication],
);
<FoundationProvider config={discovered} plugins={plugins} /* UI props */ />;
```

Die explizite Liste ersetzt die entdeckte Plugin-Liste. Wer beides will, führt beide
Listen bewusst zusammen. Leere Listen deaktivieren den entsprechenden Bereich.
next-intl benötigt weiterhin seinen konfigurierten Provider; Better Auth erhält einen
bereits konfigurierten Client. Das Plugin erzeugt weder eine zweite Sitzung noch einen
zweiten Sprachzustand. Die Host-App liefert weiterhin Serverdaten und sichere Endpunkte.

## Typisierte Services

Der Vertrag liegt in einem gemeinsam importierten Modul. Der Anbieter kann ausgetauscht
werden, solange er denselben Vertrag erfüllt.

```ts
import { serviceKey, provideService, getService, definePlugin } from '@bitakit/core';

interface Notifications {
  show(message: string): void;
}
export const notifications = serviceKey<Notifications>('notifications');

export const notificationPlugin = definePlugin({
  id: 'notifications',
  services: [
    provideService(notifications, {
      create: () => ({ show: (message) => console.info(message) }),
    }),
  ],
});

// In einer Action:
// requires: [notifications],
// execute: ({ services }) => getService(services, notifications).show('Fertig'),
```

`provideService` prüft die Implementierung, `getService` liefert den passenden Typ und
meldet einen fehlenden Service. `requires` prüft Abhängigkeiten beim Mounten;
Service-Abhängigkeiten bestimmen Erstellungsreihenfolge und umgekehrtes Cleanup.
TypeScript ersetzt keine Laufzeitvalidierung von Daten aus Netzwerk oder JavaScript.
Service-IDs müssen global eindeutig sein; Drittanbieter sollten fachliche Namensräume verwenden.

Für Auth und Übersetzung exportiert Core allgemeine Verträge und die Schlüssel
`authService` und `translationService`. Diese sind keine installierten Anbieter.

```ts
export default defineAction({
  title: 'Account.signOut',
  watch: [authService],
  resolve: (_, { services }) => {
    const session = getService(services, authService).getSnapshot();
    return { visible: !!session.user, enabled: !session.pending };
  },
  execute: ({ services }) => getService(services, authService).signOut(),
});
```

Die Runtime übernimmt Beobachtung und Cleanup. Globale ServiceMap-Erweiterungen bleiben
für entdeckte lokale Services kompatibel, sind aber kein Beweis, dass ein Plugin aktiviert
ist. Für wiederverwendbare Anbieter und Verbraucher sind typisierte Schlüssel vorzuziehen.

Ein E-Mail-Service muss in einer Server-Runtime registriert werden. Browser-Actions
rufen dafür autorisierte Server-Endpunkte auf; SMTP-Daten gelangen nie in die UI.
