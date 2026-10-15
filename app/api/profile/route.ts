import { NextResponse, type NextRequest } from 'next/server'
import { updateStore } from '@/lib/store'
import type { Profile } from '@/lib/rules'

// {profile} replaces the whole profile (onboarding "Looks right"); otherwise edit budget,
// allergies and line quantities; {confirmed:false} sends the owner back to onboarding.
export async function POST(req: NextRequest) {
  const { profile, budgetPence, allergies, address, qtys, confirmed } = await req.json()
  updateStore((s) => {
    if (profile) s.profile = { ...(profile as Profile), confirmed: true }
    if (Number(budgetPence) > 0) s.profile.budgetPence = Math.round(Number(budgetPence))
    if (Array.isArray(allergies)) s.profile.allergies = allergies.map(String).map((a) => a.trim()).filter(Boolean)
    if (qtys && typeof qtys === 'object') for (const l of s.profile.lines) if (Number(qtys[l.id]) >= 0) l.qty = Number(qtys[l.id]) // kg and litres can be fractional
    if (typeof address === 'string') s.profile.address = address.trim().slice(0, 200)
    if (confirmed === false) s.profile.confirmed = false
  })
  return NextResponse.json({ ok: true })
}
