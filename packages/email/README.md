# @bitakit/email

The shared server-side email contract and its typed `emailService` key for BitaKit apps.
This package sends nothing itself. Nodemailer or another provider implements
`send({ to, subject, text?, html? })` and returns a message ID.
Auth plugins can then send email without importing a specific provider.
