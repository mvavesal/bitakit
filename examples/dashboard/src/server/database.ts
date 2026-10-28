import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * The shop's SQLite database: `data/dashboard.db` with products and six months of orders,
 * created the first time a request needs it. `node:sqlite` ships with Node.js 24. Server code
 * only: the API routes in src/app/api import it. Delete the data folder to start over.
 */
const file = path.join(process.cwd(), 'data', 'dashboard.db');

const schema = `
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    price INTEGER NOT NULL,
    stock INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products (id),
    quantity INTEGER NOT NULL,
    total INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`;

const products: [name: string, price: number, stock: number][] = [
  ['Desk lamp', 45, 14],
  ['Notebook', 8, 120],
  ['Headphones', 129, 6],
  ['Coffee beans', 18, 40],
  ['Backpack', 79, 3],
];

/** Six months of orders up to today, with a small upward trend. */
function seed(db: DatabaseSync) {
  const product = db.prepare('INSERT INTO products (name, price, stock) VALUES (?, ?, ?)');
  const order = db.prepare(
    'INSERT INTO orders (product_id, quantity, total, created_at) VALUES (?, ?, ?, ?)',
  );
  const ids = products.map(([name, price, stock]) =>
    Number(product.run(name, price, stock).lastInsertRowid),
  );
  const now = new Date();
  for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo--) {
    for (let index = 0; index < 8 + (5 - monthsAgo) * 2; index++) {
      const which = (index * 7 + monthsAgo) % products.length;
      const quantity = 1 + ((index + monthsAgo) % 3);
      // This month's orders stay on or before today.
      const date = 1 + ((index * 3) % 27);
      const day = new Date(
        now.getFullYear(),
        now.getMonth() - monthsAgo,
        monthsAgo === 0 ? Math.min(date, now.getDate()) : date,
      );
      order.run(ids[which], quantity, quantity * products[which][1], day.toISOString());
    }
  }
}

// One connection per server process. The dev server reloads modules on every change, so the
// connection lives on globalThis instead of in a module variable.
const shared = globalThis as typeof globalThis & { dashboardDatabase?: DatabaseSync };

export function database(): DatabaseSync {
  if (shared.dashboardDatabase) return shared.dashboardDatabase;
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(schema);
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM products').get() as {
    count: number;
  };
  if (count === 0) seed(db);
  shared.dashboardDatabase = db;
  return db;
}
