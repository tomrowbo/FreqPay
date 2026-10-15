import { notFound } from 'next/navigation'
import { formatGBP, priceOf, shopBySlug } from '@/lib/shops'
import { readBasket } from '@/lib/basket'
import { readStore } from '@/lib/store'
import ShopFrame from './ShopFrame'
import AddButton from './AddButton'

export const dynamic = 'force-dynamic'

// One table per shop: the whole range with this week's prices, pack sizes and allergen labels,
// so a shopper (or the agent) can compare in one read.
export default async function Catalogue({ params }: { params: Promise<{ shop: string }> }) {
  const shop = shopBySlug((await params).shop)
  if (!shop) notFound()
  const basket = await readBasket(shop)
  const week = readStore().weekIndex
  return (
    <ShopFrame shop={shop} count={basket.count}>
      <h1 style={{ marginBottom: 4 }}>All products</h1>
      <table>
        <thead><tr><th>Product</th><th>Pack</th><th>Price</th><th>Allergens</th><th /></tr></thead>
        <tbody>
          {shop.products.map((p) => {
            const pr = priceOf(p, week)
            const inBasket = basket.lines.find((l) => l.product.id === p.id)?.qty ?? 0
            return (
              <tr key={p.id}>
                <td><a href={`/p/${p.id}`} style={{ fontWeight: 600 }}>{p.name}</a><div className="muted" style={{ fontSize: 12 }}>{p.brand} · id {p.id}</div></td>
                <td>{p.packLabel}</td>
                <td><strong>{formatGBP(pr.price)}</strong>{pr.was !== undefined && pr.label && <div style={{ fontSize: 12 }}><span className={pr.price < pr.was ? 'ok' : 'bad'}>{pr.label}</span> <s className="muted">{formatGBP(pr.was)}</s></div>}</td>
                <td style={{ fontSize: 12 }}>{p.contains.length ? `Contains: ${p.contains.join(', ')}` : ''}{p.mayContain.length ? `${p.contains.length ? ' · ' : ''}May contain: ${p.mayContain.join(', ')}` : ''}</td>
                <td>{shop.orderable ? <AddButton id={p.id} name={p.name} inBasket={inBasket} /> : <span className="muted">In store</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ShopFrame>
  )
}
