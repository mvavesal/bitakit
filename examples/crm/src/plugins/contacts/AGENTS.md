# Contacts

People at the CRM's companies. Adds a section to every company's page and a Quick Search source,
from this folder only.

## Public contracts

- `services/list.ts` (`contacts.list`): `contacts`, `status`, `error` and
  `add({ companyId, name, email })`. Data comes from `src/app/api/contacts/route.ts`.
- Event `contacts.added` (`{ id, name, companyId }`).
- Fills `companies.detail` with `ui/slots/companies.detail.tsx` (list and add form).
- `setup.ts` attaches the `contacts` Quick Search source when Quick Search is installed.
- Reads `companies.list` on `/contacts` for company names.

## Checks

On `/companies/1`, add "Edsger Dijkstra" with `edsger@northwind.example`: "Edsger Dijkstra added"
and the name joins the list. Mod+K → "Edsger" finds the contact.
