import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { buildActions } from "./actionsService.js";

import { db } from "./db.js";
import { buildForecast } from "./forecastService.js";
import { createInvoice, getInvoices, recordPayment, ServiceError } from "./invoiceService.js";
import { generateMonthInvoices } from "./monthlyService.js";
import { isISODate, todayISO } from "./money.js";
import { seedIfEmpty } from "./seed.js";

const app = express();
app.use(cors());
app.use(express.json());

type Handler = (req: Request, res: Response) => void;

/** Wraps a handler so ServiceError becomes { error } with its status. */
function route(handler: Handler) {
  return (req: Request, res: Response): void => {
    try {
      handler(req, res);
    } catch (err) {
      if (err instanceof ServiceError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      throw err;
    }
  };
}

function fail(status: number, message: string): never {
  throw new ServiceError(status, message);
}

function body(req: Request): Record<string, unknown> {
  return typeof req.body === "object" && req.body !== null && !Array.isArray(req.body)
    ? (req.body as Record<string, unknown>)
    : {};
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(400, `${field} is required`);
  return value.trim();
}

function requirePositiveInt(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    fail(400, `${field} must be a positive integer`);
  }
  return value;
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) fail(400, "id must be a positive integer");
  return id;
}

function exists(table: "batches" | "students" | "invoices", id: number, label: string): void {
  const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
  if (!row) fail(404, `${label} ${id} not found`);
}

// Health
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Batches
app.get("/api/batches", (_req, res) => {
  res.json(db.prepare("SELECT id, name, monthly_fee FROM batches ORDER BY id").all());
});

app.post(
  "/api/batches",
  route((req, res) => {
    const b = body(req);
    const name = requireText(b.name, "name");
    const monthlyFee = requirePositiveInt(b.monthly_fee, "monthly_fee");
    const result = db
      .prepare("INSERT INTO batches (name, monthly_fee) VALUES (?, ?)")
      .run(name, monthlyFee);
    res.status(201).json({ id: Number(result.lastInsertRowid), name, monthly_fee: monthlyFee });
  }),
);

// Students
app.get("/api/students", (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT s.id, s.name, s.parent_name, s.phone, s.batch_id, b.name AS batch_name
         FROM students s LEFT JOIN batches b ON b.id = s.batch_id
         ORDER BY s.id`,
      )
      .all(),
  );
});

app.post(
  "/api/students",
  route((req, res) => {
    const b = body(req);
    const name = requireText(b.name, "name");
    const parentName = requireText(b.parent_name, "parent_name");
    const phone = requireText(b.phone, "phone");
    if (!/^[6-9]\d{9}$/.test(phone)) fail(400, "phone must be a 10-digit Indian mobile number");
    const batchId = requirePositiveInt(b.batch_id, "batch_id");
    exists("batches", batchId, "Batch");
    const result = db
      .prepare("INSERT INTO students (name, parent_name, phone, batch_id) VALUES (?, ?, ?, ?)")
      .run(name, parentName, phone, batchId);
    res.status(201).json({
      id: Number(result.lastInsertRowid),
      name,
      parent_name: parentName,
      phone,
      batch_id: batchId,
    });
  }),
);

// Invoices
app.get("/api/invoices", (_req, res) => {
  res.json(getInvoices());
});

app.post(
  "/api/invoices",
  route((req, res) => {
    const b = body(req);
    const invoice = createInvoice(b.student_id, b.amount, b.issue_date, b.due_date);
    res.status(201).json(invoice);
  }),
);

app.post(
  "/api/invoices/generate-month",
  route((req, res) => {
    const b = body(req);
    try {
      res.json(generateMonthInvoices(String(b.month ?? "")));
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("month must")) fail(400, err.message);
      throw err;
    }
  }),
);

app.post(
  "/api/invoices/:id/payments",
  route((req, res) => {
    const id = parseId(req.params.id);
    const b = body(req);
    res.json(recordPayment(id, b.amount, b.date, b.method));
  }),
);

// Bills
app.get("/api/bills", (_req, res) => {
  res.json(
    db
      .prepare("SELECT id, name, amount, due_date, recurring_monthly FROM bills ORDER BY due_date, id")
      .all(),
  );
});

app.post(
  "/api/bills",
  route((req, res) => {
    const b = body(req);
    const name = requireText(b.name, "name");
    const amount = requirePositiveInt(b.amount, "amount");
    if (!isISODate(b.due_date)) fail(400, "due_date must be YYYY-MM-DD");
    if (b.recurring_monthly !== "Y" && b.recurring_monthly !== "N") {
      fail(400, "recurring_monthly must be 'Y' or 'N'");
    }
    const result = db
      .prepare("INSERT INTO bills (name, amount, due_date, recurring_monthly) VALUES (?, ?, ?, ?)")
      .run(name, amount, b.due_date, b.recurring_monthly);
    res.status(201).json({
      id: Number(result.lastInsertRowid),
      name,
      amount,
      due_date: b.due_date,
      recurring_monthly: b.recurring_monthly,
    });
  }),
);

// Reminders
app.get("/api/reminders", (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT r.id, r.invoice_id, r.message, r.sent_date, s.name AS student_name
         FROM reminders r
         JOIN invoices i ON i.id = r.invoice_id
         JOIN students s ON s.id = i.student_id
         ORDER BY r.id`,
      )
      .all(),
  );
});

app.post(
  "/api/reminders",
  route((req, res) => {
    const b = body(req);
    const invoiceId = requirePositiveInt(b.invoice_id, "invoice_id");
    exists("invoices", invoiceId, "Invoice");
    const message = requireText(b.message, "message");
    const sentDate = b.sent_date === undefined ? todayISO() : b.sent_date;
    if (!isISODate(sentDate)) fail(400, "sent_date must be YYYY-MM-DD");
    const result = db
      .prepare("INSERT INTO reminders (invoice_id, message, sent_date) VALUES (?, ?, ?)")
      .run(invoiceId, message, sentDate);
    res.status(201).json({
      id: Number(result.lastInsertRowid),
      invoice_id: invoiceId,
      message,
      sent_date: sentDate,
    });
  }),
);

// Settings
app.get("/api/settings", (_req, res) => {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

app.put(
  "/api/settings/opening_cash",
  route((req, res) => {
    const value = body(req).value;
    if (typeof value !== "number" || !Number.isInteger(value)) {
      fail(400, "value must be an integer amount in rupees");
    }
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('opening_cash', ?)").run(
      String(value),
    );
    res.json({ key: "opening_cash", value });
  }),
);

// Forecast
app.get(
  "/api/forecast",
  route((req, res) => {
    const horizon = req.query.horizon === undefined ? 90 : Number(req.query.horizon);
    if (![30, 60, 90].includes(horizon)) fail(400, "horizon must be 30, 60 or 90");
    const delay = req.query.delay === undefined ? 0 : Number(req.query.delay);
    if (!Number.isInteger(delay) || delay < 0 || delay > 30) {
      fail(400, "delay must be an integer from 0 to 30");
    }
    res.json(buildForecast(todayISO(), horizon, delay));
  }),
);

// Actions
app.get(
  "/api/actions",
  route((_req, res) => {
    res.json(buildActions(todayISO()));
  }),
);


// Error handling: malformed JSON and anything unexpected return { error }.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "Malformed JSON body" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

seedIfEmpty();

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`Chitragupt API listening on http://localhost:${port}`);
});
