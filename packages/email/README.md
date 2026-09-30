# @bitakit/email

Gemeinsamer serverseitiger E-Mail-Vertrag und typisierter `emailService`-Schlüssel.
Dieses Paket selbst versendet nichts. Nodemailer oder ein anderer Anbieter implementiert
`send({ to, subject, text?, html? })` und liefert eine Nachrichten-ID zurück.
So können Auth-Plugins E-Mails versenden, ohne einen konkreten Anbieter zu importieren.
