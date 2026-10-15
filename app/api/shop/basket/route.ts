import { NextResponse, type NextRequest } from 'next/server'
import { inStock, shopByHost } from '@/lib/shops'
import { readStore } from '@/lib/store'
import { parseBasket } from '@/lib/basket'

// Set a product's quantity (packs). Setting, not adding, makes a repeated click harmless.
export async function POST(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const shop = shopByHost(host)
  if (!shop || !shop.orderable) return new NextResponse('this shop does not sell online', { status: 404 })
  const form = await req.formData()
  const id = String(form.get('id'))
  const qty = Math.max(0, Math.min(99, Math.floor(Number(form.get('qty') ?? 1)) || 0))
  const basket = parseBasket(req.cookies.get('basket')?.value)
  if (shop.products.some((p) => p.id === id) && (inStock(id, (await readStore()).weekIndex) || form.get('action') === 'remove' || qty === 0)) {
    if (form.get('action') === 'remove' || qty === 0) delete basket[id]
    else basket[id] = qty
  }
  const back = req.headers.get('referer') ?? `http://${host}/basket`
  const res = NextResponse.redirect(back, 303)
  res.cookies.set('basket', JSON.stringify(basket), { path: '/', httpOnly: true, sameSite: 'lax' })
  return res
}
