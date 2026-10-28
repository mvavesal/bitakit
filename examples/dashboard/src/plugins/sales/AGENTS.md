# Sales

Revenue per month as a bar chart on the dashboard.

## Public contracts

- `services/monthly.ts` (`sales.monthly`): `months` (`{ month, revenue }`, six months), `status`
  and `error`, from `src/app/api/sales/route.ts`. Reloads on `orders.created`.
- Fills `dashboard.widgets` (order 10). The chart uses recharts with the theme's `--chart-1`.

## Checks

The Revenue card shows six bars and the six-month total. Recording a sample order raises the
total.
