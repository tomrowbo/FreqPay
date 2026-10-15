import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { readStore } from '@/lib/store'
import { stripe, CARD_ID } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

let card: { last4: string; limitPence: number; fetchedAt: number } | null = null

export async function GET() {
  if (!card || Date.now() - card.fetchedAt > 30_000) {
    try {
      const c = await stripe.issuing.cards.retrieve(CARD_ID)
      card = { last4: c.last4, limitPence: c.spending_controls.spending_limits?.[0]?.amount ?? 0, fetchedAt: Date.now() }
    } catch {
      card = { last4: '0005', limitPence: 30000, fetchedAt: Date.now() } // Stripe unreachable: show the card's known settings
    }
  }
  const s = (await readStore())
  const user = (await cookies()).get('fp_user')?.value ?? null
  return NextResponse.json({ ...s, events: s.events.slice(-300), card, user })
}
