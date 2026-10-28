# CRM: four plugins, one database

A small CRM built from four plugins that never edit each other. **companies** owns the
companies and their pages; **contacts** and **deals** add their sections to a company's page
through a slot; **activity** listens to their events. All data lives in SQLite.

## Run it

```sh
npm install
npm run dev
```

pnpm, Yarn and Bun work the same way (`pnpm install`, `pnpm run dev`). Open the address the
terminal prints. You need Node.js 24: SQLite comes with it as `node:sqlite`. Coding agent? Run
`npx bitakit init --update-agent-files` once to install the BitaKit skill next to `AGENTS.md`.

## Try it

1. **Companies** lists three sample companies from `data/crm.db`. Open **Northwind Traders**: the
   Contacts and Deals cards come from two other plugins.
2. In the Contacts card, add "Edsger Dijkstra" with `edsger@northwind.example`. He joins the
   list, and the header shows **1 new** from the activity plugin.
3. Press Mod+K and type "Edsger": the contacts plugin's search source finds him.
4. Open **Deals**. **Advance** moves "Support renewal" to Qualified, then Proposal, where the
   button reads **Mark won**. Win it: the header shows **2 new**.
5. **Mark lost** asks first, then takes a deal off the board. **Activity** lists what happened.

Delete the `data` folder to start over with the sample data.

## How the plugins connect

| Plugin    | Owns                             | Connects through                                                             |
| --------- | -------------------------------- | ---------------------------------------------------------------------------- |
| companies | `/companies`, `/companies/<id>`  | Declares the slot `companies.detail` (`{ companyId }`)                       |
| contacts  | `/contacts`, the `contacts.list` | Fills `companies.detail`; a Quick Search source                              |
| deals     | `/deals`, the `deals.board`      | Fills `companies.detail`; emits `deals.won`                                  |
| activity  | `/activity`, the `activity.feed` | Listens to `companies.added`, `contacts.added`, `deals.won`; a header widget |

Each data plugin has one API route in `src/app/api/<plugin>/route.ts` that checks the input and
reads and writes SQLite through `src/server/database.ts`. Its service loads on start and changes
its store only after the server confirmed a change, then emits its event. Every plugin folder
has an `AGENTS.md` with its contracts.
