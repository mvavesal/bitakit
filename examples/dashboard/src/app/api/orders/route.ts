import type { Order } from '@/plugins/orders/services/recent';
import { database } from '@/server/database';

const latest = `SELECT orders.id, products.name AS product, orders.quantity, orders.total,
  orders.created_at AS createdAt
  FROM orders JOIN products ON products.id = orders.product_id
  ORDER BY orders.created_at DESC, orders.id DESC LIMIT 5`;

// The orders widget's numbers: this month's count and the five latest orders.
export function GET() {
  const db = database();
  const { count } = db
    .prepare(
      "SELECT COUNT(*) AS count FROM orders WHERE created_at >= date('now', 'start of month')",
    )
    .get() as { count: number };
  return Response.json({ thisMonth: count, latest: db.prepare(latest).all() as Order[] });
}

// Records one order of a product that is in stock and takes it out of stock, in one
// transaction. The dashboard's "Record a sample order" Action calls this.
export function POST() {
  const db = database();
  const product = db
    .prepare('SELECT id, name, price FROM products WHERE stock > 0 ORDER BY RANDOM() LIMIT 1')
    .get() as { id: number; name: string; price: number } | undefined;
  if (!product) return new Response('Every product is sold out.', { status: 409 });
  db.exec('BEGIN');
  try {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO orders (product_id, quantity, total, created_at) VALUES (?, 1, ?, ?)')
      .run(product.id, product.price, new Date().toISOString());
    db.prepare('UPDATE products SET stock = stock - 1 WHERE id = ?').run(product.id);
    db.exec('COMMIT');
    const order: Order = {
      id: Number(lastInsertRowid),
      product: product.name,
      quantity: 1,
      total: product.price,
      createdAt: new Date().toISOString(),
    };
    return Response.json({ order }, { status: 201 });
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
