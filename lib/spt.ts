// Stripe Shared Payment Tokens (agentic commerce, preview API). FreqPay is the agent: for each
// planned shop order it mints a token scoped to exactly that amount, in GBP, for 15 minutes, only
// after its money policy approves. The shop is the seller: it charges the token with a
// PaymentIntent, and Stripe refuses anything over the token's limit.
const KEY = process.env.STRIPE_AGENT_SECRET_KEY!
const VERSION = '2026-09-30.preview'
export const PAY_RAIL = process.env.PAY_RAIL === 'issuing' ? 'issuing' : 'spt'

async function stripeForm(path: string, params: Record<string, string | number>) {
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${KEY}`, 'stripe-version': VERSION, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])),
  })
  return r.json() as Promise<{ id?: string; status?: string; error?: { message?: string } }>
}

// Test mode: Stripe's test helper grants the seller a token backed by a test card (in live mode the
// office's saved payment method backs it, issued through Link).
export async function grantToken(amount: number): Promise<{ id: string; expiresAt: number } | { error: string }> {
  const expiresAt = Math.floor(Date.now() / 1000) + 15 * 60
  const t = await stripeForm('/test_helpers/shared_payment/granted_tokens', {
    payment_method: process.env.SPT_PAYMENT_METHOD ?? 'pm_card_visa',
    'usage_limits[currency]': 'gbp',
    'usage_limits[max_amount]': amount,
    'usage_limits[expires_at]': expiresAt,
  })
  return t.id ? { id: t.id, expiresAt } : { error: t.error?.message ?? 'Stripe could not mint the token' }
}

export async function chargeToken(token: string, amount: number, shopName: string): Promise<{ id: string } | { error: string }> {
  const pi = await stripeForm('/payment_intents', {
    amount,
    currency: 'gbp',
    'payment_method_data[shared_payment_granted_token]': token,
    confirm: 'true',
    'automatic_payment_methods[enabled]': 'true',
    'automatic_payment_methods[allow_redirects]': 'never',
    description: `${shopName} order paid with a FreqPay agent token`,
  })
  return pi.status === 'succeeded' && pi.id ? { id: pi.id } : { error: pi.error?.message ?? `payment ${pi.status ?? 'failed'}` }
}
