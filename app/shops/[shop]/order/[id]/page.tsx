import { notFound } from 'next/navigation'
import { formatGBP, shopBySlug } from '@/lib/shops'
import { readStore } from '@/lib/store'
import ShopFrame from '../../ShopFrame'

export const dynamic = 'force-dynamic'

export default async function OrderPage({ params }: { params: Promise<{ shop: string; id: string }> }) {
  const { shop: slug, id } = await params
  const shop = shopBySlug(slug)
  const order = (await readStore()).orders.find((o) => o.id === id)
  if (!shop || !order) notFound()
  return (
    <ShopFrame shop={shop} count={0}>
      <div className="card" style={{ maxWidth: 560 }} id="order-confirmation">
        <h1 className="ok">Order confirmed</h1>
        <p>Order <strong id="order-id">{order.id}</strong> · Stripe authorization <code id="authorization-id">{order.authorizationId}</code></p>
        <table><tbody>
          {order.items.map((i, n) => <tr key={n}><td>{i.packs ?? 1} × {i.name}</td><td>{formatGBP(i.price * (i.packs ?? 1))}</td></tr>)}
          <tr><td>Delivery</td><td>{order.delivery ? formatGBP(order.delivery) : 'Free'}</td></tr>
          <tr><th>Total charged</th><th>{formatGBP(order.total)}</th></tr>
        </tbody></table>
      </div>
    </ShopFrame>
  )
}
