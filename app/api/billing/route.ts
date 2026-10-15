import { NextResponse, type NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'
import { readStore, updateStore } from '@/lib/store'

// Top up the agent wallet: a Stripe Checkout payment (test mode) the office makes; the agent's
// Issuing card can only spend what's in the wallet. POST {amountPence, back} -> hosted Checkout
// URL. GET ?session_id= -> credits the wallet once the payment is paid (idempotent).
export async function POST(req: NextRequest) {
  const { amountPence } = await req.json()
  const amount = Math.round(Number(amountPence))
  if (!(amount >= 1000 && amount <= 500000)) return NextResponse.json({ error: 'Top up between £10 and £5,000' }, { status: 400 })
  const origin = req.headers.get('origin') ?? `https://${req.headers.get('host')}`
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ...({ payment_method_types: ['card'] } as object), // card only (the SDK's types omit it; the API accepts it)
      line_items: [{ quantity: 1, price_data: { currency: 'gbp', unit_amount: amount, product_data: { name: 'FreqPay agent wallet top-up', description: `For ${readStore().profile.team}'s restock agent` } } }],
      payment_intent_data: { setup_future_usage: 'off_session' }, // saved for automatic top-ups
      success_url: `${origin}/?funded={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?funded=cancel`,
    })
    return NextResponse.json({ url: session.url })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('session_id') ?? ''
  try {
    const session = await stripe.checkout.sessions.retrieve(id, { expand: ['payment_intent.payment_method'] })
    const pi = session.payment_intent
    const pm = pi && typeof pi !== 'string' && pi.payment_method && typeof pi.payment_method !== 'string' ? pi.payment_method : null
    if (session.payment_status !== 'paid' || !session.amount_total) return NextResponse.json({ error: 'The top-up was not paid' }, { status: 400 })
    const card = pm?.card ? `${pm.card.brand[0].toUpperCase()}${pm.card.brand.slice(1)} ••${pm.card.last4}` : 'card'
    const wallet = updateStore((s) => {
      const w = (s.wallet ??= { balancePence: 0, topups: [] })
      if (!w.topups.some((t) => t.id === session.id)) {
        w.topups.unshift({ id: session.id, amount: session.amount_total!, t: Date.now(), card })
        w.balancePence += session.amount_total!
      }
      return w
    })
    return NextResponse.json({ card, amount: session.amount_total, balancePence: wallet.balancePence })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
