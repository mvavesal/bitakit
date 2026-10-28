'use client';
import { useServiceState, useSetting } from '@bitakit/ui';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@bitakit/ui/components';

// The third card on the dashboard.
export const order = 30;

export default function LowStockWidget() {
  const limit = Number(useSetting('inventory.lowStock').value);
  const products = useServiceState('inventory.stock', (state) => state.products, []);
  const status = useServiceState('inventory.stock', (state) => state.status, 'loading');
  const low = products.filter((product) => product.stock < limit);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Low stock</CardTitle>
        <CardDescription>
          Fewer than {limit} left. Change it in Settings → Inventory.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === 'loading' ? (
          <Skeleton className="h-24 w-full" />
        ) : low.length ? (
          <ul aria-label="Low stock" className="flex flex-col gap-1 text-sm">
            {low.map((product) => (
              <li key={product.id} className="flex justify-between gap-2">
                {product.name}
                <Badge variant={product.stock < 5 ? 'destructive' : 'secondary'}>
                  {product.stock} left
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Everything is well stocked.</p>
        )}
      </CardContent>
    </Card>
  );
}
