import { NextResponse } from 'next/server'
import { readStore } from '@/lib/store'
import { stripe, CARD_ID } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

let card: { last4: string; limitPence: number; fetchedAt: number } | null = null

export async function GET() {
  if (!card || Date.now() - card.fetchedAt > 30_000) {
    const c = await stripe.issuing.cards.retrieve(CARD_ID)
    card = { last4: c.last4, limitPence: c.spending_controls.spending_limits?.[0]?.amount ?? 0, fetchedAt: Date.now() }
  }
  const s = readStore()
  return NextResponse.json({ ...s, events: s.events.slice(-300), card })
}
