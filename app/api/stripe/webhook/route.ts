import { NextResponse, type NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'
import { decideAuthorization } from '@/lib/policy'
import { readStore } from '@/lib/store'

// Stripe Issuing real-time authorization. Answer synchronously: Stripe uses our JSON reply
// (approved + metadata) as the decision and copies the metadata onto the authorization.
export async function POST(req: NextRequest) {
  const body = await req.text()
  let event
  try {
    event = stripe.webhooks.constructEvent(body, req.headers.get('stripe-signature') ?? '', process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return new NextResponse('bad signature', { status: 400 })
  }
  if (event.type !== 'issuing_authorization.request') return NextResponse.json({ received: true })
  const auth = event.data.object
  const s = (await readStore())
  const week = s.weeks.find((m) => m.index === s.weekIndex)
  const decision = decideAuthorization({
    merchant: auth.merchant_data.name ?? '',
    amount: auth.pending_request?.amount ?? auth.amount,
    budgetPence: s.profile.budgetPence,
    weekIndex: s.weekIndex,
    orders: s.orders,
    planned: week?.orders ?? [],
    walletPence: s.wallet?.balancePence,
  })
  // Send a fixed Content-Length: with Next's default chunked encoding, replies relayed through
  // `stripe listen` intermittently came back to Stripe as webhook_error (25% in testing).
  const reply = JSON.stringify({ approved: decision.approved, metadata: { policy_reason: decision.reason } })
  return new Response(reply, {
    headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(reply)), 'Stripe-Version': '2024-06-20' },
  })
}
