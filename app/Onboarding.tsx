'use client'

import { useState } from 'react'
import type { Profile } from '@/lib/rules'
import type { WeekPlan } from '@/lib/plan'
import { LINE_EMOJI, LINE_IMAGES } from '@/lib/images'
import { SHOPS } from '@/lib/shops'
import { FREQUENCIES } from '@/lib/subscriptions'

const gbp = (p?: number) => (p === undefined ? '—' : `£${(p / 100).toFixed(2)}`)
const SHOP_NAMES: Record<string, string> = Object.fromEntries(SHOPS.map((s) => [s.slug, s.name]))

const FIRST_EXAMPLE = `Rowbo Studio, a 60-person office in London. Every week we get through:
Drinks: 72 cans of Coke Zero and 48 cans of Fanta (real brands only), 48 bottles of water
Tea and coffee: 4 kg coffee beans, 600 tea bags, 20 four-pint bottles of fresh milk, 12 litres of Oatly Barista (the baristas insist), 2 kg sugar
Fruit: 60 bananas, 60 apples, 3 kg easy peelers
Snacks: 3 kg chocolate biscuits, 80 bags of crisps, 48 chocolate bars
Two people have nut allergies. Keep it under £450 a week.`

const NEXT_EXAMPLE = `Washrooms and cleaning, every 2 weeks: 96 toilet rolls, 6,000 paper hand towels, 3 litres hand wash, 24 rolls of kitchen roll, 2 litres washing-up liquid, 20 dishwasher tablets, 60 bin bags, 3 litres surface spray`

interface Draft { profile: Profile; preview: WeekPlan; name: string; everyWeeks: number; notCovered: string[]; assumptions: string[] }

export function Photo({ category, size = 96 }: { category: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const img = LINE_IMAGES[category]
  if (!img || failed) return <div className="fp-photo" style={{ height: size, fontSize: size * 0.45 }}>{LINE_EMOJI[category] ?? '📦'}</div>
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="fp-photo" src={img.url} alt="" title={img.credit} onError={() => setFailed(true)} style={{ height: size }} />
}

// First time: the office's demand becomes its first subscription (and sets team, budget, allergies).
// Later: `account` says who the office is, so a short "every 2 weeks: …" is enough.
export default function Onboarding({ account, onDone, onCancel }: { account?: Profile; onDone: () => void; onCancel?: () => void }) {
  const [prompt, setPrompt] = useState(account ? NEXT_EXAMPLE : FIRST_EXAMPLE)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function call(body: object, label: string) {
    setBusy(label); setError('')
    try {
      const r = await fetch('/api/onboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json())
      if (r.error) setError(r.error)
      else setDraft((d) => ({ ...r, name: r.name ?? d?.name, everyWeeks: r.everyWeeks ?? d?.everyWeeks ?? 1 }))
    } finally { setBusy('') }
  }
  function draftIt() {
    const who = account ? `${account.team}. Weekly budget £${(account.budgetPence / 100).toFixed(0)}. Allergies: ${account.allergies.join(', ') || 'none'}.\n` : ''
    void call({ prompt: who + prompt }, 'Drafting…')
  }
  const reprice = (profile: Profile) => draft && void call({ profile, notCovered: draft.notCovered, assumptions: draft.assumptions }, 'Re-pricing…')
  const setQty = (id: string, qty: number) => draft && reprice({ ...draft.profile, lines: draft.profile.lines.map((l) => (l.id === id ? { ...l, qty } : l)) })
  const remove = (id: string) => draft && reprice({ ...draft.profile, lines: draft.profile.lines.filter((l) => l.id !== id) })
  async function confirm() {
    const d = draft!
    const r = await fetch('/api/subscriptions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add', name: d.name, everyWeeks: d.everyWeeks, lines: d.profile.lines, profile: d.profile }) }).then((x) => x.json())
    if (r.error) setError(r.error)
    else onDone()
  }

  const p = draft?.preview
  const budget = account?.budgetPence ?? draft?.profile.budgetPence ?? 0
  return (
    <section className="fp-panel" id="onboarding">
      <div className="fp-eyebrow">{account ? 'New subscription' : 'Step 1 of 2 · Your demand'}</div>
      <h2 className="fp-h2">{account ? 'What else should we keep stocked?' : 'What does your office get through?'}</h2>
      <p className="fp-sub">Write it the way you'd tell a colleague: quantities, how often, brands you insist on, allergies. We only use things our shops actually sell.</p>
      <textarea className="fp-textarea" rows={account ? 3 : 7} value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Your demand" />
      <div className="fp-row">
        <button className="fp-btn" onClick={draftIt} disabled={!!busy}>{draft ? 'Redraft' : 'Draft my basket'}</button>
        {onCancel && <button className="fp-btn ghost" onClick={onCancel}>Cancel</button>}
        <span className="fp-muted">{busy}</span>
        {error && <span className="fp-bad">{error}</span>}
      </div>

      {draft && p && (
        <div className="fp-preview">
          <div className="fp-eyebrow">{account ? 'Preview' : 'Step 2 of 2 · Check it'}</div>
          <h3 className="fp-h3">Here&apos;s what each delivery will look like. Does this look about right?</h3>
          <div className="fp-row" style={{ alignItems: 'flex-end' }}>
            <label className="fp-field" style={{ flex: 2 }}>Name<input className="fp-input" value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
            <label className="fp-field" style={{ flex: 1 }}>How often
              <select className="fp-input" value={draft.everyWeeks} onChange={(e) => setDraft({ ...draft, everyWeeks: Number(e.target.value) })}>
                {FREQUENCIES.map((f) => <option key={f.weeks} value={f.weeks}>{f.label}</option>)}
              </select>
            </label>
          </div>
          <p className="fp-summary">
            About <strong>{gbp(p.total)}</strong> per delivery, delivery included{p.orders.length > 1 ? `, split across ${p.orders.map((o) => SHOP_NAMES[o.shop]).join(' + ')}` : p.orders[0] ? ` from ${SHOP_NAMES[p.orders[0].shop]}` : ''}
            {p.savings ? <> · <span className="fp-ok">{gbp(p.savings)} less than one supermarket + Viking</span></> : null}
            {draft.profile.allergies.length ? ` · avoiding: ${draft.profile.allergies.join(', ')}` : ''}
          </p>
          {p.total > budget && <p className="fp-bad">That&apos;s over the {gbp(budget)} weekly budget. Lower some quantities.</p>}
          <div className="fp-items">
            {draft.profile.lines.map((l) => {
              const c = p.comparison.find((x) => x.lineId === l.id)
              const cell = c?.chosenShop ? c.perShop[c.chosenShop] : null
              return (
                <div key={l.id} className="fp-item">
                  <Photo category={l.category} />
                  <div className="fp-item-name">{l.name}</div>
                  <div className="fp-row tight">
                    <input key={`${l.id}-${l.qty}`} className="fp-input qty" type="number" min={1} defaultValue={l.qty} onBlur={(e) => Number(e.target.value) !== l.qty && setQty(l.id, Math.max(1, Math.round(Number(e.target.value))))} aria-label={`Quantity of ${l.name}`} />
                    <span className="fp-muted">{l.unit}</span>
                  </div>
                  <div className="fp-muted small">{l.brand ? `${l.brand} only` : 'any brand'}</div>
                  <div className="small">{cell ? <>≈ {gbp(cell.cost)} · {SHOP_NAMES[c!.chosenShop]}</> : <span className="fp-bad">no supplier</span>}</div>
                  <button className="fp-link" onClick={() => remove(l.id)}>Remove</button>
                </div>
              )
            })}
          </div>
          {(draft.assumptions.length > 0 || draft.notCovered.length > 0) && (
            <div className="small" style={{ marginTop: 12 }}>
              {draft.assumptions.length > 0 && <div className="fp-muted">I assumed: {draft.assumptions.join('; ')}.</div>}
              {draft.notCovered.length > 0 && <div className="fp-bad">Our shops don&apos;t stock: {draft.notCovered.join(', ')}.</div>}
            </div>
          )}
          <div className="fp-row" style={{ marginTop: 16 }}>
            <button className="fp-btn" onClick={confirm} disabled={!!busy || !p.orders.length || p.total > budget}>Start this subscription</button>
          </div>
        </div>
      )}
    </section>
  )
}
