import type { Shop } from '@/lib/shops'

export default async function ShopFrame({ shop, count, children }: { shop: Shop; count: number; children: React.ReactNode }) {
  return (
    <div style={{ ['--accent' as string]: shop.accent }}>
      <div style={{ background: '#fef3c7', color: '#78350f', fontSize: 12, textAlign: 'center', padding: '3px 8px' }}>
        Simulated store for a sandbox demo · real shelf prices seen 15 Oct 2026 · no real orders are placed
      </div>
      <header style={{ background: shop.accent, color: '#fff' }}>
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none' }}>
            <span style={{ background: '#fff', borderRadius: 8, padding: '6px 10px', display: 'inline-flex' }}>
              <img src={shop.logo} alt={shop.name} style={{ height: 34, width: 'auto', maxWidth: 140, objectFit: 'contain' }} />
            </span>
            <span>
              <span style={{ fontSize: 22, fontWeight: 800, display: 'block' }}>{shop.name}</span>
              <span style={{ opacity: 0.85, fontSize: 14 }}>{shop.tagline}</span>
            </span>
          </a>
          {shop.orderable
            ? <a href="/basket" className="btn secondary" id="basket-link">Basket ({count})</a>
            : <span style={{ fontWeight: 700 }}>In-store only</span>}
        </div>
        <div style={{ background: 'rgba(0,0,0,0.18)', fontSize: 13 }}><div className="wrap" style={{ paddingTop: 4, paddingBottom: 4 }}>{shop.kind} · {shop.deliveryNote}{shop.priceNote ? ` ${shop.priceNote}` : ''}</div></div>
      </header>
      <main className="wrap">{children}</main>
    </div>
  )
}
