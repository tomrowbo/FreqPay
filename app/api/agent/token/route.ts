import { NextResponse, type NextRequest } from 'next/server'
import { decideAuthorization } from '@/lib/policy'
import { readStore, updateStore } from '@/lib/store'
import { grantToken } from '@/lib/spt'

// The agent asks for a payment token for one shop order. FreqPay runs its money policy first
// (approved shop, exact plan, not already paid, weekly limit, wallet); only then does it mint a
// Shared Payment Token scoped to exactly that amount.
export async function POST(req: NextRequest) {
  const { merchant, amount } = await req.json()
  const s = (await readStore())
  const week = s.weeks.find((m) => m.index === s.weekIndex)
  const decision = decideAuthorization({ merchant: String(merchant), amount: Number(amount), budgetPence: s.profile.budgetPence, weekIndex: s.weekIndex, orders: s.orders, planned: week?.orders ?? [], walletPence: s.wallet?.balancePence })
  if (!decision.approved) {
    await updateStore((st) => { st.auths.unshift({ id: `refused_${Date.now().toString(36)}`, amount: Number(amount), merchant: String(merchant), approved: false, reason: 'no token minted', policyReason: decision.reason, t: Date.now() }) })
    return NextResponse.json({ error: decision.reason }, { status: 403 })
  }
  const t = await grantToken(Number(amount))
  if ('error' in t) return NextResponse.json({ error: t.error }, { status: 502 })
  await updateStore((st) => { st.auths.unshift({ id: t.id, amount: Number(amount), merchant: String(merchant), approved: true, reason: 'token minted', policyReason: `${decision.reason}; token limited to this amount for 15 minutes`, t: Date.now() }) })
  return NextResponse.json({ token: t.id, maxAmount: Number(amount), expiresAt: t.expiresAt })
}
