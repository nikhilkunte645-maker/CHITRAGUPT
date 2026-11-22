export interface ForecastInvoice { id: number; studentId: number; studentName?: string; balance: number; dueDate: string }
export interface ForecastBill { name: string; amount: number; dueDate: string; recurringMonthly: boolean }
export interface ForecastInput {
  today: string
  openingCash: number
  invoices: ForecastInvoice[]
  bills: ForecastBill[]
  horizonDays?: number
  extraDelayDays?: number
}
export interface ForecastDay { date: string; balance: number }
export interface BillEvent { name: string; date: string; amount: number }
export interface UnaffordableBill extends BillEvent { balanceAfter: number }
export interface ForecastResult {
  days: ForecastDay[]
  lowestBalance: number
  lowestDate: string
  totalExpectedCollections: number
  largestPayer: { studentId: number; name: string; outstanding: number } | null
  billEvents: BillEvent[]
  unaffordableBills: UnaffordableBill[]
}

const DAY_MS = 86400000

function toMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
function fromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}
function addDays(iso: string, n: number): string {
  return fromMs(toMs(iso) + n * DAY_MS)
}
function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate()
}

function billOccursOn(bill: ForecastBill, date: string): boolean {
  if (date < bill.dueDate) return false
  if (!bill.recurringMonthly) return date === bill.dueDate
  const [y, m, d] = date.split('-').map(Number)
  const dom = Number(bill.dueDate.slice(8, 10))
  return d === Math.min(dom, daysInMonth(y, m))
}

export function computeForecast(input: ForecastInput): ForecastResult {
  const horizon = input.horizonDays ?? 90
  const delay = input.extraDelayDays ?? 0
  const today = input.today
  const end = addDays(today, horizon)

  const outstanding = new Map<number, { total: number; name: string }>()
  for (const inv of input.invoices) {
    if (inv.balance <= 0) continue
    const cur = outstanding.get(inv.studentId) ?? { total: 0, name: inv.studentName ?? `Student ${inv.studentId}` }
    cur.total += inv.balance
    outstanding.set(inv.studentId, cur)
  }
  let largestPayer: ForecastResult['largestPayer'] = null
  for (const [studentId, v] of outstanding) {
    if (
      !largestPayer ||
      v.total > largestPayer.outstanding ||
      (v.total === largestPayer.outstanding && studentId < largestPayer.studentId)
    ) {
      largestPayer = { studentId, name: v.name, outstanding: v.total }
    }
  }

  const collections = new Map<string, number>()
  let totalExpectedCollections = 0
  for (const inv of input.invoices) {
    if (inv.balance <= 0) continue
    let d = inv.dueDate < today ? today : inv.dueDate
    if (largestPayer && inv.studentId === largestPayer.studentId) d = addDays(d, delay)
    if (d > end) continue
    collections.set(d, (collections.get(d) ?? 0) + inv.balance)
    totalExpectedCollections += inv.balance
  }

  let balance = input.openingCash
  const days: ForecastDay[] = []
  const billEvents: BillEvent[] = []
  const unaffordableBills: UnaffordableBill[] = []
  let lowestBalance = Infinity
  let lowestDate = today

  for (let i = 0; i <= horizon; i++) {
    const date = addDays(today, i)
    balance += collections.get(date) ?? 0
    for (const bill of input.bills) {
      if (!billOccursOn(bill, date)) continue
      balance -= bill.amount
      const ev: BillEvent = { name: bill.name, date, amount: bill.amount }
      billEvents.push(ev)
      if (balance < 0) unaffordableBills.push({ ...ev, balanceAfter: balance })
    }
    days.push({ date, balance })
    if (balance < lowestBalance) {
      lowestBalance = balance
      lowestDate = date
    }
  }

  return { days, lowestBalance, lowestDate, totalExpectedCollections, largestPayer, billEvents, unaffordableBills }
}
