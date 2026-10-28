import type { Month } from '@/plugins/sales/services/monthly';
import { database } from '@/server/database';

// Revenue per month for the last six months, for the sales widget.
export function GET() {
  const months = database()
    .prepare(
      `SELECT strftime('%Y-%m', created_at) AS month, SUM(total) AS revenue
       FROM orders
       WHERE created_at >= date('now', 'start of month', '-5 months')
       GROUP BY month ORDER BY month`,
    )
    .all() as Month[];
  return Response.json({ months });
}
