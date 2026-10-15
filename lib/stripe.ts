import Stripe from 'stripe'

// The agent's Stripe account (Issuing, test mode). The SDK pins its own API version, so the
// account's old default (2015-10-16) doesn't affect API calls.
export const stripe = new Stripe(process.env.STRIPE_AGENT_SECRET_KEY!)

export const CARD_ID = process.env.STRIPE_AGENT_CARD_ID!

export async function getCardDetails() {
  const card = await stripe.issuing.cards.retrieve(CARD_ID, { expand: ['number', 'cvc'] })
  return {
    number: card.number!,
    cvc: card.cvc!,
    expMonth: card.exp_month,
    expYear: card.exp_year,
    last4: card.last4,
    name: card.cardholder.name,
  }
}

// Shop side: resolve a typed card number to an Issuing card (sandbox stand-in for the card network).
export async function findIssuingCard(number: string, expMonth: number, expYear: number) {
  const digits = number.replace(/\D/g, '')
  const list = await stripe.issuing.cards.list({ last4: digits.slice(-4), exp_month: expMonth, exp_year: expYear, limit: 10 })
  for (const c of list.data) {
    const full = await stripe.issuing.cards.retrieve(c.id, { expand: ['number'] })
    if (full.number === digits) return full
  }
  return null
}
