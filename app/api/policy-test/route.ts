import { NextResponse, type NextRequest } from 'next/server'
import { stripe, CARD_ID } from '@/lib/stripe'
import { readStore, updateStore } from '@/lib/store'
import { SHOPS } from '@/lib/shops'

// "What if something goes wrong?" — charges the policy must block, made straight against the card.
//   ?kind=rogue      an unapproved merchant (the agent being tricked into buying elsewhere)
//   ?kind=overcharge an approved supplier charging £5 more than the agent's plan
export async function POST(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind') ?? 'rogue'
  const s = readStore()
  // Smallest planned order, so +£5 stays under the £300 card limit and our policy (not the card) declines it
  const planned = [...(s.weeks.find((m) => m.index === s.weekIndex)?.orders ?? [])].sort((a, b) => a.total - b.total)[0]
  const attempt =
    kind === 'overcharge'
      ? { name: planned?.shopName ?? SHOPS[0].name, amount: (planned?.total ?? 4000) + 500, category: 'grocery_stores_supermarkets' as const }
      : { name: 'GadgetMart Online', amount: 1500, category: 'electronics_stores' as const }
  const auth = await stripe.testHelpers.issuing.authorizations.create({
    card: CARD_ID,
    amount: attempt.amount,
    currency: 'gbp',
    merchant_data: { name: attempt.name, category: attempt.category, country: 'GB' },
  })
  const reason = auth.request_history[0]?.reason ?? ''
  const policyReason = auth.metadata?.policy_reason || (reason === 'authorization_controls' ? 'over the card limit' : undefined)
  updateStore((st) => { st.auths.unshift({ id: auth.id, amount: attempt.amount, merchant: attempt.name, approved: auth.approved, reason, policyReason, t: Date.now() }) })
  return NextResponse.json({ kind, merchant: attempt.name, amount: attempt.amount, approved: auth.approved, reason, policyReason })
}
