import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * The CRM's SQLite database: `data/crm.db`, created with its tables and a few sample companies,
 * contacts and deals the first time a request needs it. `node:sqlite` ships with Node.js 24.
 * Server code only: the API routes in src/app/api import it; each plugin calls its own route.
 * Delete the data folder to start over.
 */
const file = path.join(process.cwd(), 'data', 'crm.db');

const schema = `
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    industry TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies (id),
    name TEXT NOT NULL,
    email TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies (id),
    title TEXT NOT NULL,
    value INTEGER NOT NULL,
    stage TEXT NOT NULL CHECK (stage IN ('lead', 'qualified', 'proposal', 'won', 'lost'))
  );
`;

function seed(db: DatabaseSync) {
  const company = db.prepare('INSERT INTO companies (name, industry) VALUES (?, ?)');
  const contact = db.prepare('INSERT INTO contacts (company_id, name, email) VALUES (?, ?, ?)');
  const deal = db.prepare(
    'INSERT INTO deals (company_id, title, value, stage) VALUES (?, ?, ?, ?)',
  );
  const companies = [
    ['Northwind Traders', 'Wholesale'],
    ['Globex', 'Manufacturing'],
    ['Initech', 'Software'],
  ].map(([name, industry]) => Number(company.run(name, industry).lastInsertRowid));
  const [northwind, globex, initech] = companies;
  contact.run(northwind, 'Ada Lovelace', 'ada@northwind.example');
  contact.run(northwind, 'Charles Babbage', 'charles@northwind.example');
  contact.run(globex, 'Grace Hopper', 'grace@globex.example');
  contact.run(initech, 'Alan Turing', 'alan@initech.example');
  deal.run(northwind, 'Annual supply contract', 48000, 'proposal');
  deal.run(globex, 'Factory sensors', 120000, 'qualified');
  deal.run(initech, 'Support renewal', 18000, 'lead');
  deal.run(initech, 'Cloud migration', 64000, 'won');
}

// One connection per server process. The dev server reloads modules on every change, so the
// connection lives on globalThis instead of in a module variable.
const shared = globalThis as typeof globalThis & { crmDatabase?: DatabaseSync };

export function database(): DatabaseSync {
  if (shared.crmDatabase) return shared.crmDatabase;
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(schema);
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM companies').get() as {
    count: number;
  };
  if (count === 0) seed(db);
  shared.crmDatabase = db;
  return db;
}

/** A short, user-readable error answer; the plugin's Action shows the text. */
export function problem(message: string, status = 400) {
  return new Response(message, { status });
}
