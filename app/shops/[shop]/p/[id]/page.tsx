import { notFound } from 'next/navigation'
import { PRODUCT_IMAGES } from '@/lib/productImages'
import { formatGBP, inStock, priceOf, shopBySlug } from '@/lib/shops'
import { readBasket } from '@/lib/basket'
import { readStore } from '@/lib/store'
import ShopFrame from '../../ShopFrame'
import AddButton from '../../AddButton'

export const dynamic = 'force-dynamic'

export default async function ProductPage({ params }: { params: Promise<{ shop: string; id: string }> }) {
  const { shop: slug, id } = await params
  const shop = shopBySlug(slug)
  const p = shop?.products.find((x) => x.id === id)
  if (!shop || !p) notFound()
  const basket = await readBasket(shop)
  const pr = priceOf(p, (await readStore()).weekIndex)
  return (
    <ShopFrame shop={shop} count={basket.count}>
      <p><a href="/">← All products</a></p>
      <div className="card" style={{ maxWidth: 640 }} data-product-id={p.id}>
        {PRODUCT_IMAGES[p.id] && <img src={PRODUCT_IMAGES[p.id]} alt="" style={{ width: 220, height: 220, objectFit: 'contain', background: '#fff', borderRadius: 12, marginBottom: 12 }} />}
        <h1 style={{ margin: '0 0 4px' }}>{p.name}</h1>
        <div className="muted">{p.brand} · {p.packLabel} · product id {p.id}</div>
        {p.ingredients && <><h3>Ingredients</h3><p>{p.ingredients}</p></>}
        <h3>Allergens</h3>
        <p><strong>Contains:</strong> {p.contains.length ? p.contains.join(', ') : 'none'}<br /><strong>May contain:</strong> {p.mayContain.length ? p.mayContain.join(', ') : 'none'}</p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <strong style={{ fontSize: 20 }}>{formatGBP(pr.price)}</strong>
          {pr.was !== undefined && pr.label && <span className="muted">{pr.label} <s>{formatGBP(pr.was)}</s></span>}
          {!inStock(p.id, (await readStore()).weekIndex) ? <strong className="bad">Out of stock</strong> : shop.orderable ? <AddButton id={p.id} name={p.name} inBasket={basket.lines.find((l) => l.product.id === p.id)?.qty ?? 0} /> : <span className="muted">In store only</span>}
        </div>
      </div>
    </ShopFrame>
  )
}
