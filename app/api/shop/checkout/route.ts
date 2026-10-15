import { NextResponse, type NextRequest } from 'next/server'
import { shopByHost, shopUrl } from '@/lib/shops'
import { findIssuingCard, stripe } from '@/lib/stripe'
import { readStore, updateStore, type Order } from '@/lib/store'
import { parseBasket, priceBasket } from '@/lib/basket'
import { PUBLIC_DEMO } from '@/lib/demo'
import { chargeToken } from '@/lib/spt'

// The shop's checkout. In production this would go to the shop's payment processor and on to the
// card network. In sandbox the shop server plays the card network: it asks Stripe Issuing to
// authorize the agent's card directly (test helper), which runs the card's spending controls and
// our real-time authorization webhook.
// Merchant category codes as the card network would report them.
const MCC: Record<string, 'grocery_stores_supermarkets' | 'wholesale_clubs' | 'stationery_stores_office_and_school_supply_stores'> = {
  tesco: 'grocery_stores_supermarkets', sainsburys: 'grocery_stores_supermarkets', asda: 'grocery_stores_supermarkets', ocado: 'grocery_stores_supermarkets',
  iceland: 'grocery_stores_supermarkets', waitrose: 'grocery_stores_supermarkets', morrisons: 'grocery_stores_supermarkets', coop: 'grocery_stores_supermarkets', costco: 'wholesale_clubs', viking: 'stationery_stores_office_and_school_supply_stores',
}

export async function POST(req: NextRequest) {
  if (PUBLIC_DEMO) return new NextResponse('checkout is disabled in the public demo', { status: 403 })
  const shop = shopByHost(req.headers.get('host') ?? '')
  if (!shop || !shop.orderable) return new NextResponse('this shop does not sell online', { status: 404 })
  const base = shopUrl(shop)
  const decline = (reason: string) => NextResponse.redirect(`${base}/checkout?declined=${encodeURIComponent(reason)}`, 303)

  const b = priceBasket(shop, parseBasket(req.cookies.get('basket')?.value), (await readStore()).weekIndex) // never trust a client-sent amount
  if (!b.lines.length) return decline('basket is empty')
  if (b.belowMinimum) return decline(`minimum order is £${(b.minimum / 100).toFixed(2)}`)
  const total = b.total

  const form = await req.formData()
  const token = String(form.get('agentToken') ?? '').trim()
  if (token) {
    // Agentic checkout: charge the Shared Payment Token. Stripe refuses anything over its limit.
    const pi = await chargeToken(token, total, shop.name)
    const ok = 'id' in pi
    const order: Order = {
      id: `ord_${Date.now().toString(36)}`, shop: shop.slug, weekIndex: (await readStore()).weekIndex,
      items: b.lines.map((l) => ({ id: l.product.id, name: l.product.name, price: l.price, packs: l.qty })),
      subtotal: b.subtotal, delivery: b.delivery, total, status: ok ? 'approved' : 'declined',
      authorizationId: ok ? pi.id : undefined, declineReason: ok ? undefined : pi.error, createdAt: Date.now(),
    }
    await updateStore((s) => {
      s.orders.push(order)
      s.auths.unshift({ id: ok ? pi.id : `declined_${Date.now().toString(36)}`, amount: total, merchant: shop.name, approved: ok, reason: ok ? 'paid with agent token' : 'token refused', policyReason: ok ? `charged token ${token}` : pi.error, t: Date.now() })
      if (ok && s.wallet) s.wallet.balancePence -= total
    })
    if (!ok) return decline(pi.error)
    const res = NextResponse.redirect(`${base}/order/${order.id}`, 303)
    res.cookies.set('basket', '{}', { path: '/' })
    return res
  }
  const [mm, yy] = String(form.get('exp') ?? '').split('/').map((s) => parseInt(s.trim(), 10))
  const card = await findIssuingCard(String(form.get('cardNumber') ?? ''), mm, 2000 + (yy ?? 0))
  if (!card) return decline('card number not recognised')
  const withCvc = await stripe.issuing.cards.retrieve(card.id, { expand: ['cvc'] })
  if (withCvc.cvc !== String(form.get('cvc') ?? '').trim()) return decline('incorrect CVC')

  const authorize = () =>
    stripe.testHelpers.issuing.authorizations.create({
      card: card.id,
      amount: total,
      currency: 'gbp',
      merchant_data: { name: shop.name, category: MCC[shop.slug], city: shop.city, country: shop.country, url: base },
    })
  let auth = await authorize()
  let reason = auth.request_history[0]?.reason
  if (!auth.approved && (reason === 'webhook_error' || reason === 'webhook_timeout')) {
    // `stripe listen` goes stale when idle and can miss the first event after a quiet spell; retry once
    auth = await authorize()
    reason = auth.request_history[0]?.reason
  }

  const policyReason = auth.metadata?.policy_reason
  const order: Order = {
    id: `ord_${Date.now().toString(36)}`,
    shop: shop.slug,
    weekIndex: (await readStore()).weekIndex,
    items: b.lines.map((l) => ({ id: l.product.id, name: l.product.name, price: l.price, packs: l.qty })),
    subtotal: b.subtotal,
    delivery: b.delivery,
    total,
    status: auth.approved ? 'approved' : 'declined',
    authorizationId: auth.id,
    declineReason: auth.approved ? undefined : policyReason || (reason === 'authorization_controls' ? 'over the card limit' : reason),
    createdAt: Date.now(),
  }
  if (auth.approved) await stripe.testHelpers.issuing.authorizations.capture(auth.id)
  await updateStore((s) => {
    s.orders.push(order)
    s.auths.unshift({ id: auth.id, amount: total, merchant: shop.name, approved: auth.approved, reason: reason ?? '', policyReason, t: Date.now() })
    if (auth.approved && s.wallet) s.wallet.balancePence -= total // the charge comes out of the agent wallet
  })
  if (!auth.approved) return decline(order.declineReason ?? 'declined')
  const res = NextResponse.redirect(`${base}/order/${order.id}`, 303)
  res.cookies.set('basket', '{}', { path: '/' })
  return res
}
