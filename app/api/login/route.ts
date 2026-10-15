import { NextResponse, type NextRequest } from 'next/server'
import { DEFAULT_STORE, readStore, writeStore } from '@/lib/store'

// Demo sign-in: an email in a cookie, no password. Sandbox only.
export async function POST(req: NextRequest) {
  const { email } = await req.json()
  const e = String(email ?? '').trim()
  if (!/^\S+@\S+\.\S+$/.test(e)) return NextResponse.json({ error: 'Enter your work email' }, { status: 400 })
  const res = NextResponse.json({ ok: true })
  res.cookies.set('fp_user', e, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
  return res
}

// Signing out resets the demo: subscriptions, wallet and deliveries go, so the next sign-in starts fresh.
export function DELETE() {
  writeStore({ ...structuredClone(DEFAULT_STORE), profile: { ...readStore().profile, confirmed: false }, subscriptions: [] })
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('fp_user')
  return res
}
