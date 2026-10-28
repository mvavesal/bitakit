# Inventory

Products running low, as a dashboard card with its own setting.

## Public contracts

- `services/stock.ts` (`inventory.stock`): `products` (`{ id, name, stock }`), `status` and
  `error`, from `src/app/api/inventory/route.ts`. Reloads on `orders.created`.
- Setting `inventory.lowStock` (default 10): the card lists products below it.
- Fills `dashboard.widgets` (order 30).

## Checks

The Low stock card lists Backpack, Headphones and other products under 10. Set the limit to 50
in Settings → Inventory: Coffee beans joins the list.
