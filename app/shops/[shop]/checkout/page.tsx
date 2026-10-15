import { notFound } from 'next/navigation'
import { formatGBP, shopBySlug } from '@/lib/shops'
import { readBasket } from '@/lib/basket'
import ShopFrame from '../ShopFrame'

export const dynamic = 'force-dynamic'

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ shop: string }>; searchParams: Promise<{ declined?: string }> }) {
  const shop = shopBySlug((await params).shop)
  if (!shop) notFound()
  const { declined } = await searchParams
  const b = await readBasket(shop)
  return (
    <ShopFrame shop={shop} count={b.count}>
      <h1>Checkout</h1>
      {declined && <p className="bad" id="decline-message" role="alert"><strong>Payment declined:</strong> {declined}</p>}
      <div className="card" style={{ maxWidth: 520 }}>
        <p>{b.count} packs · subtotal {formatGBP(b.subtotal)} · delivery {b.delivery ? formatGBP(b.delivery) : 'free'} · <strong id="checkout-total">{formatGBP(b.total)}</strong></p>
        <form action="/api/shop/checkout" method="post" id="checkout-form" data-basket={JSON.stringify(Object.fromEntries(b.lines.map((l) => [l.product.id, l.qty])))}>
          <label htmlFor="name">Name on card</label>
          <input id="name" name="name" autoComplete="cc-name" required />
          <label htmlFor="card-number">Card number</label>
          <input id="card-number" name="cardNumber" inputMode="numeric" autoComplete="cc-number" required />
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label htmlFor="exp">Expiry (MM/YY)</label><input id="exp" name="exp" placeholder="MM/YY" autoComplete="cc-exp" required /></div>
            <div style={{ flex: 1 }}><label htmlFor="cvc">CVC</label><input id="cvc" name="cvc" inputMode="numeric" autoComplete="cc-csc" required /></div>
          </div>
          <label htmlFor="postcode">Delivery postcode</label>
          <input id="postcode" name="postcode" autoComplete="postal-code" required />
          <p><button className="btn" type="submit" id="pay-button" disabled={b.lines.length === 0 || b.belowMinimum}>Pay {formatGBP(b.total)}</button></p>
        </form>
        {b.belowMinimum && <p className="bad">Minimum order is {formatGBP(b.minimum)}.</p>}
        <p className="muted">Sandbox: card payments are authorised against Stripe Issuing test mode.</p>
      </div>
    </ShopFrame>
  )
}
