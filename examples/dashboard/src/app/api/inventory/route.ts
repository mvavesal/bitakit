import type { Product } from '@/plugins/inventory/services/stock';
import { database } from '@/server/database';

// Every product with what is left in stock, lowest first, for the inventory widget.
export function GET() {
  const products = database()
    .prepare('SELECT id, name, stock FROM products ORDER BY stock, name')
    .all() as Product[];
  return Response.json({ products });
}
