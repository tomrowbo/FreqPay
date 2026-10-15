# FreqPay

**The office shop that does itself.** Tell FreqPay what your office gets through, and how often. On that schedule, an AI agent compares ten UK shops that deliver, buys from the cheapest mix after delivery charges, and pays each shop with a Stripe Issuing card that only approves its plan.

Built at the Stripe x Briefcase AI FinTech hackathon (London, 15 Oct 2026). Live demo: **https://freqpay.app** (Stripe test mode; the shops are simulated, so nothing is really ordered or paid).

## What it does

1. **Set up once.** Your office (company, headcount, delivery address), then what you need: a subscription with items, quantities, units and notes (brands you insist on, allergies), delivered every week, every 2 weeks or every 4 weeks. You can have several subscriptions (say, kitchen weekly and cleaning fortnightly).
2. **See your basket.** Claude turns the list into products the shops actually sell. A deterministic optimiser prices it across all ten shops, delivery included, and shows the split, the saving and the real pack photos.
3. **Top up the agent's wallet.** Set a weekly spending limit and top up with Stripe Checkout. The agent can only spend what's in the wallet.
4. **The agent shops every week.** It opens each shop in a real browser, checks every product against your rules, gets the cheapest split from the optimiser, fills the baskets and pays. Every charge goes through Stripe's real-time authorization, and the dashboard shows each delivery with receipts.

## How it works

```
Office manager ──> FreqPay app (Next.js) ──> Stripe Checkout (wallet top-ups)
                        │   ▲
              plan +    │   │  events, orders
              rules     ▼   │
                   Agent (Claude + Playwright) ──browses/buys──> 10 shop sites
                                                                    │ checkout
                                                                    ▼
                          Stripe Issuing authorization ──webhook──> FreqPay money policy
                                                                    (approve / decline, in real time)
```

- **Agent** (`agent/run.ts`): Claude (`claude-opus-5-5`) with the Anthropic SDK tool runner and Playwright tools (`open_url`, `snapshot`, `set_field`, `click`). It visits every shop, calls `check_items` on every product, calls `plan_order`, fills each planned basket and pays.
- **Rules, not judgement** (`lib/rules.ts`): code decides whether a product fits a line: brand locks ("Coca-Cola only"), allergies (contains and may-contain), fresh vs UHT, and things not on the list. Every rejection is logged with its reason.
- **Optimiser** (`lib/optimise.ts`): an exact branch-and-bound over which shop supplies which line. It accounts for pack sizes (it buys multipacks and rounds up), each shop's delivery tiers (minimum order, small-basket charge, free-delivery threshold), at most 3 deliveries a week, and the card's £300 per-charge limit. The model never does the arithmetic.
- **Subscriptions** (`lib/subscriptions.ts`): each week, everything due across all subscriptions is merged into one shop, so one plan, one budget and one set of card rules cover them.
- **Money policy** (`lib/policy.ts`, run in `app/api/stripe/webhook`): Stripe Issuing's real-time authorization webhook approves a charge only if all of these hold:
  - the merchant is an approved shop
  - the amount matches that shop's planned order to the penny
  - that shop hasn't already been paid this week
  - the week stays within the spending limit
  - the agent wallet can cover it

  Separately, the card itself has a £300 per-authorization spending limit in Stripe.
- **Wallet** (`app/api/billing`): top-ups are Stripe Checkout payments in test mode, and approved charges come off the balance.
- **Shops** (`app/shops`, `lib/shops.ts`): local simulated shops served on their own hosts (`tesco.localhost`, `asda.localhost`…). Checkout stands in for the card network: it asks Stripe Issuing to authorize the agent's card, which runs the card's limits and our webhook.

### Real data, simulated shops
- Prices are real UK shelf prices seen on 15 Oct 2026 (the retailers' own sites, trolley.co.uk, Costco and Viking). The shops are Tesco, Sainsbury's, Asda, Ocado, Iceland, Waitrose, Morrisons, Co-op, Costco and Viking.
- Only shops that deliver to a London office are included. Lidl has no UK delivery, and Aldi's Deliveroo trial doesn't cover London. Supermarkets on Deliveroo or Uber Eats charge 19–45% over shelf price, so their own delivery is always cheaper for an order this size.
- Delivery terms are real where published. Some slot fees and Co-op/Morrisons/Waitrose terms are estimates, and each shop's delivery note says so.
- Promotions, a quiet price creep and stock-outs follow a 3-week cycle, so the agent has to re-plan. For example, Asda runs out of Oatly in week 2 and the order moves.
- Product photos come from trolley.co.uk, the retailers' image CDNs and Open Food Facts. The marketing photos were generated with Higgsfield.

## Run it locally

Requirements: Node 23+, Google Chrome, the Stripe CLI, a Stripe test account with Issuing (one cardholder and one virtual card with a £300 per-authorization limit), and an Anthropic API key.

`.env.local`:
```
STRIPE_AGENT_SECRET_KEY=sk_test_...
STRIPE_AGENT_PUBLISHABLE_KEY=pk_test_...
STRIPE_AGENT_CARD_ID=ic_...
STRIPE_WEBHOOK_SECRET=whsec_...   # stripe listen --api-key $STRIPE_AGENT_SECRET_KEY --print-secret
ANTHROPIC_API_KEY=sk-ant-...
DEMO_WEEK_MINUTES=5
```

```bash
npm install
npm run build && npm start        # app + shops on http://localhost:3000
npm run stripe:listen             # forwards issuing_authorization.request to the webhook
npm run agent                     # the agent and the demo clock (Chrome opens when a week runs)
```

Then open http://localhost:3000, sign in with any email, set up a subscription, top up with test card `4242 4242 4242 4242`, and press **Simulate next week**. Signing out resets the demo. An operator view at `/ops` shows the agent's live log, the price comparison across shops and the guardrail test buttons (unknown merchant, £5 overcharge).

Checks:
```bash
npm test                 # optimiser, rules, money policy, subscriptions (44 tests)
npm run smoke:checkout   # one scripted payment through Stripe Issuing + a duplicate declined
npm run smoke:click      # the browser tools, no model involved
```

## Public demo (freqpay.app)

With `PUBLIC_DEMO=1` (set on Vercel), every page carries a DEMO banner and is hidden from search engines. The shops show no card form and the checkout API refuses requests. Onboarding drafts are rate-limited, and the agent isn't running, so the agent's purchases and the guardrails are shown in the recorded demo.

## Built with

Next.js 16, React 19, TypeScript, the Anthropic SDK (Claude tool runner and structured outputs), Playwright, Stripe Issuing (real-time authorizations, spending controls, test helpers) and Stripe Checkout. Tests use Vitest.
