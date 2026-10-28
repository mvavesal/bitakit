# Tickets

A help desk's tickets, created through a form in a dialog and stored in SQLite.

## Public contracts

- `schema.ts`: `ticketSchema` (zod) and `NewTicket`. The form, the `tickets.create` Action and
  `src/app/api/tickets/route.ts` all check with it.
- `services/list.ts` (`tickets.list`): `tickets`, `status`, `error`, `create(ticket)`,
  `close(id)`.
- Actions: `tickets.open` (navigation), `tickets.new` (opens `ui/dialogs/new-ticket.tsx`; on
  the page and on Mod+Shift+N), `tickets.create` (input: `ticketSchema`),
  `tickets.close` (input: an id; asks first; only for open tickets).

## Checks

**New ticket** → submit the empty form: each field shows its message. Fill title, email and a
20-character description → **Create ticket** closes the dialog, shows "Ticket created" and puts the
ticket first.
