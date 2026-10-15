'use client'

import { useState } from 'react'
import type { Profile } from '@/lib/rules'
import type { WeekPlan } from '@/lib/plan'
import { LINE_EMOJI, LINE_IMAGES } from '@/lib/images'
import { SHOPS } from '@/lib/shops'

const gbp = (p?: number) => (p === undefined ? '—' : `£${(p / 100).toFixed(2)}`)
const SHOP_NAMES: Record<string, string> = Object.fromEntries(SHOPS.map((s) => [s.slug, s.name]))

const EXAMPLE = `Rowbo Studio, a 60-person office in London. Every week we get through:
Drinks: 72 cans of Coke Zero and 48 cans of Fanta (real brands only), 48 bottles of water
Tea and coffee: 4 kg coffee beans, 600 tea bags, 20 four-pint bottles of fresh milk, 12 litres of Oatly Barista (the baristas insist), 2 kg sugar
Fruit: 60 bananas, 60 apples, 3 kg easy peelers
Snacks: 3 kg chocolate biscuits, 80 bags of crisps, 48 chocolate bars
Washrooms and cleaning: 96 toilet rolls, 6,000 paper hand towels, 3 litres hand wash, 24 rolls of kitchen roll, 2 litres washing-up liquid, 20 dishwasher tablets, 60 bin bags, 3 litres surface spray
Two people have nut allergies. Keep it under £450 a week.`

interface Draft { profile: Profile; preview: WeekPlan; notCovered: string[]; assumptions: string[] }

function Photo({ category }: { category: string }) {
  const [failed, setFailed] = useState(false)
  const img = LINE_IMAGES[category]
  if (!img || failed) return <div style={{ fontSize: 44, height: 96, display: 'grid', placeItems: 'center' }}>{LINE_EMOJI[category] ?? '📦'}</div>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={img.url} alt="" title={img.credit} onError={() => setFailed(true)} style={{ height: 96, width: '100%', objectFit: 'contain' }} />
}

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [prompt, setPrompt] = useState(EXAMPLE)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function call(body: object, label: string) {
    setBusy(label); setError('')
    try {
      const r = await fetch('/api/onboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json())
      if (r.error) setError(r.error)
      else setDraft(r)
    } finally { setBusy('') }
  }
  const setQty = (id: string, qty: number) => {
    if (!draft) return
    const profile = { ...draft.profile, lines: draft.profile.lines.map((l) => (l.id === id ? { ...l, qty } : l)) }
    void call({ profile, notCovered: draft.notCovered, assumptions: draft.assumptions }, 'Re-pricing…')
  }
  const remove = (id: string) => {
    if (!draft) return
    const profile = { ...draft.profile, lines: draft.profile.lines.filter((l) => l.id !== id) }
    void call({ profile, notCovered: draft.notCovered, assumptions: draft.assumptions }, 'Re-pricing…')
  }
  async function confirm() {
    await fetch('/api/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile: draft!.profile }) })
    onDone()
  }

  const p = draft?.preview
  return (
    <div className="card" id="onboarding">
      <h3 style={{ marginTop: 0 }}>What does your office get through each week?</h3>
      <textarea rows={8} value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Your weekly demand" />
      <p style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn" onClick={() => call({ prompt }, 'Drafting your weekly basket…')} disabled={!!busy}>{draft ? 'Redraft' : 'Draft my weekly basket'}</button>
        <span className="muted">{busy}</span>
        {error && <span className="bad">{error}</span>}
      </p>

      {draft && p && (
        <>
          <h2 style={{ marginBottom: 4 }}>Here's what a normal week will look like. Does this look about right?</h2>
          <p style={{ marginTop: 0 }}>
            About <strong>{gbp(p.total)}</strong> a week{p.orders.length > 1 ? `, split across ${p.orders.map((o) => SHOP_NAMES[o.shop]).join(' + ')}` : p.orders[0] ? ` from ${SHOP_NAMES[p.orders[0].shop]}` : ''}
            {p.savings ? <> · <span className="ok">{gbp(p.savings)} less than one supermarket + Viking for the rest</span></> : null}
            {' '}· budget {gbp(draft.profile.budgetPence)}{draft.profile.allergies.length ? ` · avoiding: ${draft.profile.allergies.join(', ')}` : ''}
          </p>
          {p.total > draft.profile.budgetPence && <p className="bad">That's over your budget. Lower some quantities, or raise the budget.</p>}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
            {draft.profile.lines.map((l) => {
              const c = p.comparison.find((x) => x.lineId === l.id)
              const cell = c?.chosenShop ? c.perShop[c.chosenShop] : null
              return (
                <div key={l.id} className="card" style={{ padding: 10 }}>
                  <Photo category={l.category} />
                  <div style={{ fontWeight: 600, marginTop: 6 }}>{l.name}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '4px 0' }}>
                    <input key={`${l.id}-${l.qty}`} type="number" min={1} defaultValue={l.qty} onBlur={(e) => Number(e.target.value) !== l.qty && setQty(l.id, Math.max(1, Math.round(Number(e.target.value))))} style={{ width: 70, margin: 0 }} aria-label={`Weekly quantity of ${l.name}`} />
                    <span className="muted" style={{ fontSize: 13 }}>{l.unit}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>{l.brand ? `${l.brand} only` : 'any brand'}</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>{cell ? <>≈ {gbp(cell.cost)} · {SHOP_NAMES[c!.chosenShop]}</> : <span className="bad">no supplier</span>}</div>
                  <button className="btn secondary" style={{ marginTop: 6, fontSize: 12, padding: '2px 8px' }} onClick={() => remove(l.id)}>Remove</button>
                </div>
              )
            })}
          </div>
          {(draft.assumptions.length > 0 || draft.notCovered.length > 0) && (
            <div style={{ fontSize: 13, marginTop: 10 }}>
              {draft.assumptions.length > 0 && <div className="muted">I assumed: {draft.assumptions.join('; ')}.</div>}
              {draft.notCovered.length > 0 && <div className="bad">Our suppliers don't stock: {draft.notCovered.join(', ')}.</div>}
            </div>
          )}
          <p style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={confirm} disabled={!!busy || !p.orders.length || p.total > draft.profile.budgetPence}>Looks right: start weekly restocks</button>
          </p>
        </>
      )}
    </div>
  )
}
