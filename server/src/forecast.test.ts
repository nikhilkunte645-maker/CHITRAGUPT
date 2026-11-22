import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { computeForecast } from './forecast.js'

type Result = ReturnType<typeof computeForecast>
const TODAY = '2026-11-22'
const rent = { name: 'Rent', amount: 20000, dueDate: '2026-11-30', recurringMonthly: false }
const inv1 = { id: 1, studentId: 1, studentName: 'Aarav', balance: 10000, dueDate: '2026-11-25' }
const bal = (r: Result, date: string) => r.days.find((d) => d.date === date)?.balance

test('a) base forecast', () => {
  const r = computeForecast({ today: TODAY, openingCash: 15000, invoices: [inv1], bills: [rent], extraDelayDays: 0 })
  assert.equal(bal(r, '2026-11-25'), 25000)
  assert.equal(bal(r, '2026-11-30'), 5000)
  assert.equal(r.lowestBalance, 5000)
  assert.equal(r.lowestDate, '2026-11-30')
  assert.equal(r.unaffordableBills.length, 0)
})

test('b) largest payer 15 days late', () => {
  const r = computeForecast({ today: TODAY, openingCash: 15000, invoices: [inv1], bills: [rent], extraDelayDays: 15 })
  assert.equal(bal(r, '2026-11-30'), -5000)
  assert.equal(r.lowestBalance, -5000)
  assert.equal(r.lowestDate, '2026-11-30')
  assert.equal(r.unaffordableBills.length, 1)
  assert.equal(r.unaffordableBills[0].name, 'Rent')
  assert.equal(bal(r, '2026-12-10'), 5000)
})

test('c) delay 0 equals default', () => {
  const a = computeForecast({ today: TODAY, openingCash: 15000, invoices: [inv1], bills: [rent], extraDelayDays: 0 })
  const b = computeForecast({ today: TODAY, openingCash: 15000, invoices: [inv1], bills: [rent] })
  assert.deepEqual(a, b)
})

test('d) zero-balance invoice changes nothing', () => {
  const zero = { id: 9, studentId: 9, balance: 0, dueDate: '2026-11-25' }
  const withZero = computeForecast({ today: TODAY, openingCash: 15000, invoices: [zero], bills: [rent] })
  const without = computeForecast({ today: TODAY, openingCash: 15000, invoices: [], bills: [rent] })
  assert.deepEqual(withZero, without)
  assert.equal(withZero.largestPayer, null)
})

test('e) recurring monthly bill', () => {
  const r = computeForecast({
    today: TODAY,
    openingCash: 50000,
    invoices: [],
    bills: [{ name: 'Internet', amount: 1000, dueDate: '2026-11-05', recurringMonthly: true }],
    horizonDays: 90,
  })
  assert.deepEqual(
    r.billEvents.map((e) => e.date),
    ['2026-12-05', '2027-01-05', '2027-02-05'],
  )
})

test('f) only the largest payer is delayed', () => {
  const s1 = { id: 1, studentId: 1, studentName: 'Big', balance: 10000, dueDate: '2026-11-25' }
  const s2 = { id: 2, studentId: 2, studentName: 'Small', balance: 3000, dueDate: '2026-11-26' }
  const r = computeForecast({ today: TODAY, openingCash: 0, invoices: [s1, s2], bills: [], extraDelayDays: 10 })
  assert.equal(r.largestPayer?.studentId, 1)
  assert.equal(bal(r, '2026-11-25'), 0)
  assert.equal(bal(r, '2026-11-26'), 3000)
  assert.equal(bal(r, '2026-12-04'), 3000)
  assert.equal(bal(r, '2026-12-05'), 13000)
})
