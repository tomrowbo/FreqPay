import { notFound } from 'next/navigation'
import { formatGBP, shopBySlug } from '@/lib/shops'
import { readBasket } from '@/lib/basket'
import ShopFrame from '../ShopFrame'

export const dynamic = 'force-dynamic'

export default async function BasketPage({ params }: { params: Promise<{ shop: string }> }) {
  const shop = shopBySlug((await params).shop)
  if (!shop) notFound()
  const b = await readBasket(shop)
  return (
    <ShopFrame shop={shop} count={b.count}>
      <h1>Your basket</h1>
      {b.lines.length === 0 ? <p>Your basket is empty. <a href="/">Keep shopping</a></p> : (
        <div className="card" style={{ maxWidth: 680 }}>
          <table>
            <tbody>
              {b.lines.map((l) => (
                <tr key={l.product.id}>
                  <td>{l.qty} × {l.product.name} <span className="muted">({l.product.packLabel})</span></td>
                  <td>{formatGBP(l.cost)}</td>
                  <td>
                    <form action="/api/shop/basket" method="post">
                      <input type="hidden" name="action" value="remove" />
                      <input type="hidden" name="id" value={l.product.id} />
                      <button className="btn secondary" type="submit" aria-label={`Remove ${l.product.name}`}>Remove</button>
                    </form>
                  </td>
                </tr>
              ))}
              <tr><td>Subtotal</td><td>{formatGBP(b.subtotal)}</td><td /></tr>
              <tr><td>Delivery</td><td>{b.delivery ? formatGBP(b.delivery) : 'Free'}</td><td /></tr>
              <tr><th>Total</th><th id="basket-total">{formatGBP(b.total)}</th><th /></tr>
            </tbody>
          </table>
          {b.belowMinimum && <p className="bad">Minimum order is {formatGBP(b.minimum)}.</p>}
          <p><a className="btn" href="/checkout" id="checkout-link">Go to checkout</a></p>
        </div>
      )}
    </ShopFrame>
  )
}
