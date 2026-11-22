import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolves to <server>/data whether run from src/ (tsx) or dist/ (tsc build).
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(serverRoot, "data");

// CHITRAGUPT_DB overrides the database file (used by tests); empty or unset keeps the default.
const envDbPath = process.env.CHITRAGUPT_DB?.trim();
export const DB_PATH = envDbPath ? envDbPath : path.join(dataDir, "chitragupt.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
export const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA foreign_keys = ON;");

/** Runs `fn` inside BEGIN/COMMIT, rolling back and rethrowing on error. */
export function withTransaction<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

db.exec(`
CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_fee INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  parent_name TEXT,
  phone TEXT,
  batch_id INTEGER REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id),
  amount INTEGER NOT NULL,
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid'
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  amount INTEGER NOT NULL,
  date TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('UPI', 'Cash', 'Bank'))
);

CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  recurring_monthly TEXT NOT NULL CHECK (recurring_monthly IN ('Y', 'N'))
);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  message TEXT NOT NULL,
  sent_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);
