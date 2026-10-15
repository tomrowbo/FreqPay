import { NextResponse, type NextRequest } from 'next/server'

// Demo sign-in: an email in a cookie, no password. Sandbox only.
export async function POST(req: NextRequest) {
  const { email } = await req.json()
  const e = String(email ?? '').trim()
  if (!/^\S+@\S+\.\S+$/.test(e)) return NextResponse.json({ error: 'Enter your work email' }, { status: 400 })
  const res = NextResponse.json({ ok: true })
  res.cookies.set('fp_user', e, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
  return res
}

export function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('fp_user')
  return res
}
