# @bitakit/nodemailer

Serverseitiges SMTP-Plugin für den gemeinsamen E-Mail-Service. Keine Browser-Installation
oder globale SMTP-Instanz; jede Runtime besitzt ihren Transport und schließt ihn beim Unmount.

```ts
import { FoundationRuntime, createActionList, getService } from '@bitakit/core';
import { emailService } from '@bitakit/email';
import { nodemailerPlugin } from '@bitakit/nodemailer';
import { betterAuthEmail } from '@bitakit/better-auth/email';

const runtime = new FoundationRuntime(createActionList(), {
  plugins: [nodemailerPlugin({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER!,
    password: process.env.SMTP_PASSWORD!,
    from: process.env.SMTP_FROM!,
  })],
});
const dispose = runtime.mount();
const callbacks = betterAuthEmail(getService(runtime.services, emailService), {
  invitationURL: id => new URL(`/invitations/${encodeURIComponent(id)}`, appOrigin).href,
});
// Pass callbacks to your server-side Better Auth configuration.
// Call dispose when the server runtime is shut down, not after every request.
```

Die Route im Beispiel muss im Host tatsächlich existieren. `appOrigin` stammt aus vertrauenswürdiger
Serverkonfiguration. Die lokale Env-Datei lädt der Host; das Plugin liest keine geheimen Dateien
oder Umgebungsvariablen automatisch. `from` muss eine Adresse enthalten, beispielsweise
`Demo <sender@example.test>`; ein Anzeigename allein reicht nicht.

TLS wird auch bei STARTTLS verlangt. Der Browser-Einstieg weist die Nutzung zurück.
Credentials, Nachrichtentext und Empfänger werden nicht geloggt. Die Registrierung selbst
öffnet keine SMTP-Verbindung und versendet keine Nachricht. Die automatischen Tests verwenden
Transport-Doubles; keine echte Testmail wird ohne ausdrücklichen Auftrag versendet.
