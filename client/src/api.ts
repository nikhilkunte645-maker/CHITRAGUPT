const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string } | null;
      message = body?.error ?? message;
    } catch {
      // Body was not JSON; keep the generic message.
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
};

export type PaymentStatus = "paid" | "partial" | "unpaid";
export type PaymentMethod = "UPI" | "Cash" | "Bank";

export interface Invoice {
  id: number;
  student_id: number;
  student_name: string;
  parent_name: string | null;
  phone: string | null;
  batch_id: number | null;
  batch_name: string | null;
  amount: number;
  issue_date: string;
  due_date: string;
  paid: number;
  balance: number;
  status: PaymentStatus;
  days_overdue: number;
}

// Matches GET /api/students (SELECT s.id, s.name, s.parent_name, s.phone, s.batch_id, b.name AS batch_name).
export interface Student {
  id: number;
  name: string;
  parent_name: string | null;
  phone: string | null;
  batch_id: number | null;
  batch_name: string | null;
}

// Matches GET /api/batches (SELECT id, name, monthly_fee).
export interface Batch {
  id: number;
  name: string;
  monthly_fee: number;
}

export interface Reminder {
  id: number;
  invoice_id: number;
  message: string;
  sent_date: string;
  student_name: string;
}

export const getInvoices = () => api.get<Invoice[]>("/invoices");
export const getStudents = () => api.get<Student[]>("/students");
export const getReminders = () => api.get<Reminder[]>("/reminders");
export const getBatches = () => api.get<Batch[]>("/batches");

// NOTE: The POST /api/invoices response shape was not confirmed in the lines read,
// so the return type is only guaranteed to include the new invoice id.
export function createInvoice(body: {
  student_id: number;
  amount: number;
  issue_date: string;
  due_date: string;
}) {
  return api.post<{ id: number }>("/invoices", body);
}

export function recordPayment(
  invoiceId: number,
  body: { amount: number; date: string; method: PaymentMethod },
) {
  return api.post<Invoice>(`/invoices/${invoiceId}/payments`, body);
}

export function createReminder(body: { invoice_id: number; message: string }) {
  return api.post<Reminder>("/reminders", body);
}

// Mirrors ServerForecastResult from server/src/forecast.ts. All values are integer rupees, computed by the server.
export interface ForecastDay {
  date: string;
  balance: number;
}

export interface LargestPayer {
  studentId: number;
  name: string;
  outstanding: number;
}

export interface BillEvent {
  name: string;
  date: string;
  amount: number;
}

export interface UnaffordableBill extends BillEvent {
  balanceAfter: number;
}

export interface ForecastResult {
  days: ForecastDay[];
  lowestBalance: number;
  lowestDate: string;
  totalExpectedCollections: number;
  largestPayer: LargestPayer | null;
  billEvents: BillEvent[];
  unaffordableBills: UnaffordableBill[];
}

export function getForecast(horizon: 30 | 60 | 90, delay: number): Promise<ForecastResult> {
  return api.get<ForecastResult>(`/forecast?horizon=${horizon}&delay=${delay}`);
}

// Mirrors ActionItem from GET /api/actions. Sorted by priority ascending by the server; title is server-written text.
export interface ActionItem {
  id: string;
  kind: "chase" | "cash_gap";
  priority: number;
  title: string;
  detail: string;
  invoiceId: number | null;
  amount: number | null;
}

export function getActions(): Promise<ActionItem[]> {
  return api.get<ActionItem[]>("/actions");
}

export interface GenerateMonthResult {
  created: number;
  skipped: number;
  month: string;
}

export function generateMonthInvoices(month: string): Promise<GenerateMonthResult> {
  return api.post<GenerateMonthResult>("/invoices/generate-month", { month });
}

