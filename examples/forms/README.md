# Forms: a dialog, a schema and SQLite

A help desk where new tickets are written in a form inside a dialog. One zod schema checks the
form in the browser, the Action's input and the request on the server; the tickets live in
SQLite.

## Run it

```sh
npm install
npm run dev
```

pnpm, Yarn and Bun work the same way (`pnpm install`, `pnpm run dev`). Open the address the
terminal prints. You need Node.js 24: SQLite comes with it as `node:sqlite`. Coding agent? Run
`npx bitakit init --update-agent-files` once to install the BitaKit skill next to `AGENTS.md`.

## Try it

1. Open **Tickets**: two sample tickets from `data/forms.db`.
2. Press **New ticket** (or Mod+Shift+N). The `tickets.new` Action opens its form in a dialog
   with the Action's title and description.
3. Press **Create ticket** with the form empty: every field says what it needs.
4. Fill in a title, your email, a priority and at least 20 characters. **Create ticket** closes
   the dialog, shows "Ticket created" and puts the ticket first.
5. **Close** asks first; a closed ticket keeps a "closed" badge and loses its button.

Delete the `data` folder to start over with the sample tickets.

## How it fits together

| Part              | File                                                              |
| ----------------- | ----------------------------------------------------------------- |
| The rules         | `src/plugins/tickets/schema.ts` (zod)                             |
| The dialog Action | `src/plugins/tickets/actions/new.ts`                              |
| The form          | `src/plugins/tickets/ui/dialogs/new-ticket.tsx` (react-hook-form) |
| The save Action   | `src/plugins/tickets/actions/create.ts` (`input: ticketSchema`)   |
| The server        | `src/app/api/tickets/route.ts`, `src/server/database.ts`          |
| The textarea      | `src/components/ui/textarea.tsx` (shadcn)                         |

The form validates with the schema through `zodResolver` and runs `tickets.create`; the Action
parses its input with the same schema, and the API route parses the request again before it
writes. If the server still says no, its message shows inside the dialog and the form stays
open.
