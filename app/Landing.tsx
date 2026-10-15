'use client'

import { useState } from 'react'
import { SHOPS } from '@/lib/shops'

// Numbers below are from verified sandbox runs on the 60-person example (15 Oct 2026 shelf prices).
export default function Landing({ onIn }: { onIn: () => void }) {
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  async function go(e: React.FormEvent) {
    e.preventDefault()
    const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) }).then((x) => x.json())
    if (r.error) setErr(r.error)
    else onIn()
  }
  const signIn = (
    <form className="fp-signin" onSubmit={go}>
      <input className="fp-input" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Work email" />
      <button className="fp-btn" type="submit">Get started</button>
    </form>
  )
  return (
    <>
      <section className="lp-hero">
        <div>
          <span className="lp-badge"><span className="fp-dot" style={{ color: 'var(--good)' }} /> Built on Stripe Issuing · powered by Claude</span>
          <h1 className="fp-h1">The office shop that <span>does itself.</span></h1>
          <p className="fp-lede">Tell FreqPay what your office gets through. On your schedule, an AI agent compares ten UK shops that deliver, buys from the cheapest mix after delivery charges, and pays with a company card that only approves its plan.</p>
          {signIn}
          {err && <p className="fp-bad small">{err}</p>}
          <p className="fp-muted small">No password, no card details. Sandbox demo: no real orders or payments.</p>
        </div>
        <div className="lp-visual">
          <img className="lp-photo" src="/brand/hero.jpg" alt="A restocked office kitchen with drinks, coffee, tea and a fruit bowl" />
          <div className="lp-float lp-float-a">
            <div className="fp-eyebrow" style={{ marginBottom: 8 }}>This week · w/c 2 Nov</div>
            {[['asda', '£226.12'], ['iceland', '£90.65'], ['viking', '£61.41']].map(([slug, amt]) => (
              <div key={slug} className="lp-paid"><img src={SHOPS.find((x) => x.slug === slug)?.logo} alt={slug} /><span>{amt}</span><span className="fp-ok">✓ paid</span></div>
            ))}
            <div className="lp-saved">£378.18 delivered · <b>saved £35.41</b></div>
          </div>
          <div className="lp-float lp-float-b"><span className="fp-bad">✕ Declined</span> GadgetMart Online £15.00 · not an approved supplier</div>
        </div>
      </section>

      <section className="lp-strip">
        <div className="fp-muted small">Compares real shelf prices, delivery fees and minimum orders at</div>
        <div className="fp-logos">{SHOPS.map((x) => <img key={x.slug} src={x.logo} alt={x.name} title={x.name} />)}</div>
      </section>

      <section id="how" className="lp-section">
        <div className="fp-eyebrow">How it works</div>
        <h2 className="lp-h2">Set it up once. It shops every week.</h2>
        <div className="lp-steps">
          <div className="lp-step"><span className="lp-num">1</span><b>Tell us your demand</b><p>&ldquo;Every week: 72 cans of Coke Zero, 600 tea bags, 60 bananas. Cleaning every two weeks.&rdquo; Claude turns it into a priced basket from what the shops actually sell.</p></div>
          <div className="lp-step"><span className="lp-num">2</span><b>The agent compares ten shops</b><p>It browses Tesco, Sainsbury&apos;s, Asda, Ocado, Iceland, Waitrose, Morrisons, Co-op, Costco and Viking, checks every product against your allergies and brands, and finds the cheapest split, delivery included.</p></div>
          <div className="lp-step"><span className="lp-num">3</span><b>The card pays only the plan</b><p>Each shop is paid with its own Stripe Issuing card. A real-time check approves a charge only if it matches the plan to the penny. Everything else is declined.</p></div>
        </div>
      </section>

      <section className="lp-band">
        <div className="lp-stat"><b>£1,800</b><span>saved a year for a 60-person office (£35 a week vs one supermarket + Viking)</span></div>
        <div className="lp-stat"><b>10 shops</b><span>and about 290 products compared every delivery, delivery fees included</span></div>
        <div className="lp-stat"><b>32</b><span>products a week rejected for nut allergies and brand rules</span></div>
        <div className="lp-stat"><b>£0</b><span>approved that didn&apos;t match the plan</span></div>
      </section>

      <section className="lp-split">
        <div>
          <div className="fp-eyebrow">Subscriptions</div>
          <h2 className="lp-h2">On your schedule, not the shop&apos;s.</h2>
          <p className="fp-lede" style={{ fontSize: 16 }}>Kitchen every week, cleaning every two, the big coffee order every four. Each delivery, FreqPay buys everything that&apos;s due as one shop, so you get one split, one budget and free delivery thresholds hit more often. Change items or frequency in one click.</p>
        </div>
        <div className="lp-mock">
          <div className="lp-mock-card"><div><b>Kitchen &amp; pantry</b><div className="fp-muted small">14 items · next w/c 9 Nov</div></div><div className="fp-freq"><button className="sel">Weekly</button><button>2 weeks</button><button>4 weeks</button></div></div>
          <div className="lp-mock-card"><div><b>Washrooms &amp; cleaning</b><div className="fp-muted small">8 items · next w/c 16 Nov</div></div><div className="fp-freq"><button>Weekly</button><button className="sel">2 weeks</button><button>4 weeks</button></div></div>
          <div className="lp-mock-card"><div><b>Coffee beans</b><div className="fp-muted small">1 item · paused</div></div><span className="fp-pill off"><span className="fp-dot" />Paused</span></div>
        </div>
      </section>

      <section className="lp-split rev">
        <div className="lp-rules">
          {['Approved shops only', 'Each charge matches the plan to the penny', 'Weekly budget + £300 per-charge card limit', 'Allergies, including "may contain"', 'The brands you insist on', 'Every decision logged with a reason'].map((r) => <div key={r} className="lp-rule"><span className="fp-ok">✓</span>{r}</div>)}
        </div>
        <div>
          <div className="fp-eyebrow">Control</div>
          <h2 className="lp-h2">An agent with a company card, and rules it can&apos;t break.</h2>
          <p className="fp-lede" style={{ fontSize: 16 }}>The agent never does the maths or the allergy judgement: plain code does. And the money rules live at the card, in Stripe&apos;s real-time authorization. If the agent is tricked, or a shop overcharges by £5, the card says no.</p>
        </div>
      </section>

      <section className="lp-cta">
        <h2 className="lp-h2" style={{ color: '#fff' }}>Never reorder the toilet roll again.</h2>
        {signIn}
      </section>
      <footer className="fp-muted small lp-foot">FreqPay · hackathon demo in Stripe test mode · shelf prices seen 15 Oct 2026 · shops are simulated and no real orders are placed</footer>
    </>
  )
}
