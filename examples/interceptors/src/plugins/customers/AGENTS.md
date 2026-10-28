# Customers

A customer list kept in memory. Other plugins watch and gate it; this folder does not know them.

## Public contracts

- `services/list.ts` (`customers.list`): `state` (`customers`), `add(name)` (throws for a taken
  name), `archive(id)`, `remove(id)`.
- Actions: `customers.open` (navigation), `customers.add` (input: a name of 2+ letters),
  `customers.archive` (input: an id; only for active customers), `customers.remove` (input: an
  id; asks first).

## Checks

On `/customers`: adding "Ada Corp" shows "Ada Corp added"; adding "contoso" shows
"contoso is already a customer."; **Archive** on Northwind Traders shows "Customer archived".
