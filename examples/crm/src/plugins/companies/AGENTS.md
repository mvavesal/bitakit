# Companies

Owns the companies and the page of each company. Contacts and deals add their sections to that
page through a slot, without this plugin knowing them.

## Public contracts

- `services/list.ts` (`companies.list`): `companies`, `status`, `error`, `find(id)` and
  `add({ name, industry })`. Data comes from `src/app/api/companies/route.ts`.
- Event `companies.added` (`{ id, name }`), emitted after the server saved a company.
- Slot `companies.detail` (components, payload `{ companyId }`): sections on `/companies/<id>`.
- Actions: `companies.open` (navigation), `companies.add`.

## Checks

`/companies` lists Globex, Initech and Northwind Traders. Adding "Acme" with industry "Retail"
shows "Acme added"; adding it again shows "Acme is already in the CRM." `/companies/1` shows the
contacts and deals cards from the other plugins.
