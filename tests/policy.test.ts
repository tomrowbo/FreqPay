import { describe, expect, it } from 'vitest'
import { decideAuthorization } from '../lib/policy'
import { weekLabel, type Order, type SupplierOrder } from '../lib/store'

const planned: SupplierOrder[] = [
  { shop: 'asda', shopName: 'Asda', items: [], subtotal: 7307, delivery: 599, total: 7906, status: 'planned' },
  { shop: 'iceland', shopName: 'Iceland', items: [], subtotal: 6336, delivery: 0, total: 6336, status: 'planned' },
]
const base = { budgetPence: 45000, weekIndex: 2, orders: [] as Order[], planned }
const paid = (shop: string, total: number, weekIndex = 2): Order => ({ id: 'o', shop, weekIndex, items: [], subtotal: total, delivery: 0, total, status: 'approved', createdAt: 0 })

describe('decideAuthorization', () => {
  it('approves a charge that matches the plan', () => {
    expect(decideAuthorization({ ...base, merchant: 'Asda', amount: 7906 })).toEqual({ approved: true, reason: 'matches the plan: £79.06 at Asda' })
  })
  it('declines shops we can see but never order from (Lidl is in-store only)', () => {
    expect(decideAuthorization({ ...base, merchant: 'Lidl', amount: 7906 }).reason).toBe('merchant "Lidl" is not an approved supplier')
  })
  it('declines unknown merchants', () => {
    expect(decideAuthorization({ ...base, merchant: 'GadgetMart Online', amount: 1500 }).reason).toBe('merchant "GadgetMart Online" is not an approved supplier')
  })
  it('declines an approved supplier that is not in this week’s plan', () => {
    expect(decideAuthorization({ ...base, merchant: 'Viking', amount: 2500 }).reason).toBe('no order at Viking in this week\'s plan')
  })
  it('declines any amount that differs from the plan, even by a penny', () => {
    const d = decideAuthorization({ ...base, merchant: 'Asda', amount: 7907 })
    expect(d).toEqual({ approved: false, reason: "£79.07 doesn't match the £79.06 planned at Asda" })
  })
  it('reports an overcharge as a mismatch even after the supplier was paid', () => {
    expect(decideAuthorization({ ...base, merchant: 'Asda', amount: 8406, orders: [paid('asda', 7906)] }).reason).toBe("£84.06 doesn't match the £79.06 planned at Asda")
  })
  it('declines a second charge at the same supplier in the same week', () => {
    expect(decideAuthorization({ ...base, merchant: 'Asda', amount: 7906, orders: [paid('asda', 7906)] }).approved).toBe(false)
    expect(decideAuthorization({ ...base, merchant: 'Asda', amount: 7906, orders: [paid('asda', 7906, 1)] }).approved).toBe(true)
  })
  it('declines when the week would go over budget', () => {
    const d = decideAuthorization({ ...base, budgetPence: 10000, merchant: 'Iceland', amount: 6336, orders: [paid('asda', 7906)] })
    expect(d.reason).toBe('would take this week to £142.42, over the £100.00 budget')
  })
})

describe('weekLabel', () => {
  it('labels each demo week by its Monday, rolling over the month', () => {
    expect(weekLabel(1)).toBe('w/c 2 Nov')
    expect(weekLabel(5)).toBe('w/c 30 Nov')
    expect(weekLabel(6)).toBe('w/c 7 Dec')
  })
})
