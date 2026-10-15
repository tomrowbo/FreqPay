import { NextResponse, type NextRequest } from 'next/server'
import { shopByHost, shopUrl } from '@/lib/shops'
import { findIssuingCard, stripe } from '@/lib/stripe'
import { readStore, updateStore, type Order } from '@/lib/store'
import { parseBasket, priceBasket } from '@/lib/basket'
import { PUBLIC_DEMO } from '@/lib/demo'

// The shop's checkout. In production this would go to the shop's payment processor and on to the
// card network. In sandbox the shop server plays the card network: it asks Stripe Issuing to
// authorize the agent's card directly (test helper), which runs the card's spending controls and
// our real-time authorization webhook.
// Merchant category codes as the card network would report them.
const MCC: Record<string, 'grocery_stores_supermarkets' | 'wholesale_clubs' | 'stationery_stores_office_and_school_supply_stores'> = {
  tesco: 'grocery_stores_supermarkets', sainsburys: 'grocery_stores_supermarkets', asda: 'grocery_stores_supermarkets', ocado: 'grocery_stores_supermarkets',
  iceland: 'grocery_stores_supermarkets', aldi: 'grocery_stores_supermarkets', costco: 'wholesale_clubs', viking: 'stationery_stores_office_and_school_supply_stores',
}

export async function POST(req: NextRequest) {
  if (PUBLIC_DEMO) return new NextResponse('checkout is disabled in the public demo', { status: 403 })
  const shop = shopByHost(req.headers.get('host') ?? '')
  if (!shop || !shop.orderable) return new NextResponse('this shop does not sell online', { status: 404 })
  const base = shopUrl(shop)
  const decline = (reason: string) => NextResponse.redirect(`${base}/checkout?declined=${encodeURIComponent(reason)}`, 303)

  const b = priceBasket(shop, parseBasket(req.cookies.get('basket')?.value)) // never trust a client-sent amount
  if (!b.lines.length) return decline('basket is empty')
  if (b.belowMinimum) return decline(`minimum order is £${(b.minimum / 100).toFixed(2)}`)
  const total = b.total

  const form = await req.formData()
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
    weekIndex: readStore().weekIndex,
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
  updateStore((s) => {
    s.orders.push(order)
    s.auths.unshift({ id: auth.id, amount: total, merchant: shop.name, approved: auth.approved, reason: reason ?? '', policyReason, t: Date.now() })
  })
  if (!auth.approved) return decline(order.declineReason ?? 'declined')
  const res = NextResponse.redirect(`${base}/order/${order.id}`, 303)
  res.cookies.set('basket', '{}', { path: '/' })
  return res
}
