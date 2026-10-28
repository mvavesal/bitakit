# Orders

The shop's orders: a dashboard card and a button that records a sample order.

## Public contracts

- `services/recent.ts` (`orders.recent`): `thisMonth`, `latest` (five orders), `status`,
  `error` and `record()`. Data comes from `src/app/api/orders/route.ts`.
- Event `orders.created` (`{ id, product, total }`), emitted after the server saved an order.
- Fills `dashboard.widgets` (order 20) and places `orders.record` in `dashboard.toolbar`.

## Checks

On `/dashboard`, **Record a sample order** shows "Order recorded", raises the count this month by
one and puts the order first in the list.
