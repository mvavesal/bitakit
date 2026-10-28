# Dashboard: one page, many plugins

A dashboard whose cards all come from other plugins. **dashboard** owns the page and two
slots; **sales**, **orders** and **inventory** each add a card from their own folder and read
the shop's SQLite data through their own API route.

## Run it

```sh
npm install
npm run dev
```

pnpm, Yarn and Bun work the same way (`pnpm install`, `pnpm run dev`). Open the address the
terminal prints. You need Node.js 24: SQLite comes with it as `node:sqlite`. Coding agent? Run
`npx bitakit init --update-agent-files` once to install the BitaKit skill next to `AGENTS.md`.

## Try it

1. Open **Dashboard**. Three cards load from `data/dashboard.db`: revenue per month as a chart,
   this month's orders and the products running low.
2. Press **Record a sample order**. The orders plugin saves one order and announces
   `orders.created`; the revenue chart and the stock list reload by themselves.
3. Settings → Inventory → **Low stock below**: set it to 50 and more products appear in the
   card.

Delete the `data` folder to start over with the sample data.

## How the cards get there

| Plugin    | Adds                                                     | Reads            |
| --------- | -------------------------------------------------------- | ---------------- |
| dashboard | The page, the slots `dashboard.widgets` and `.toolbar`   | Nothing          |
| sales     | The Revenue card (`export const order = 10`)             | `/api/sales`     |
| orders    | The Orders card and the **Record a sample order** button | `/api/orders`    |
| inventory | The Low stock card and its setting                       | `/api/inventory` |

A card is one file, `ui/slots/dashboard.widgets.tsx`; a button is an Action with
`slots: ['dashboard.toolbar']`. The dashboard page renders `<PluginSlot name="dashboard.widgets" />`
and never imports a card. sales and inventory listen to `orders.created` instead of being called
by orders. The chart is [recharts](https://recharts.org) with the theme's `--chart-1` color.
