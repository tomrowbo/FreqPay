import { NextResponse, type NextRequest } from 'next/server'
import { shopByHost } from './lib/shops'

// Each supplier is its own "site": iceland.localhost:3000/p/x -> /shops/iceland/p/x
export function proxy(req: NextRequest) {
  const shop = shopByHost(req.headers.get('host') ?? '')
  const { pathname } = req.nextUrl
  if (!shop || pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.startsWith('/shops/')) return NextResponse.next()
  const url = req.nextUrl.clone()
  url.pathname = `/shops/${shop.slug}${pathname === '/' ? '' : pathname}`
  return NextResponse.rewrite(url)
}

// Static files (logos) are served as-is on every shop host.
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|logos/).*)'] }
