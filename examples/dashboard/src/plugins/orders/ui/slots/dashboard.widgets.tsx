'use client';
import { useServiceState } from '@bitakit/ui';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@bitakit/ui/components';

// The second card on the dashboard.
export const order = 20;

const euros = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' });

export default function OrdersWidget() {
  const thisMonth = useServiceState('orders.recent', (state) => state.thisMonth, 0);
  const latest = useServiceState('orders.recent', (state) => state.latest, []);
  const status = useServiceState('orders.recent', (state) => state.status, 'loading');
  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders</CardTitle>
        <CardDescription>
          <span aria-label="Orders this month">{thisMonth}</span> this month
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === 'loading' ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <ul aria-label="Latest orders" className="flex flex-col gap-1 text-sm">
            {latest.map((order) => (
              <li key={order.id} className="flex justify-between gap-2">
                <span>
                  {order.quantity} × {order.product}
                </span>
                <span className="text-muted-foreground">{euros.format(order.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
