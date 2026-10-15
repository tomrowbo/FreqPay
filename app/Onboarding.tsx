'use client'

import { useState } from 'react'
import type { Profile } from '@/lib/rules'
import type { WeekPlan } from '@/lib/plan'
import { LINE_EMOJI, LINE_IMAGES } from '@/lib/images'
import { SHOPS } from '@/lib/shops'
import { FREQUENCIES } from '@/lib/subscriptions'

const gbp = (p?: number) => (p === undefined ? '—' : `£${(p / 100).toFixed(2)}`)
const SHOP_NAMES: Record<string, string> = Object.fromEntries(SHOPS.map((s) => [s.slug, s.name]))

type Row = { name: string; qty: string; unit: string; note: string }
const row = (name: string, qty: number | string, unit: string, note = ''): Row => ({ name, qty: String(qty), unit, note })

// Pre-filled with the 60-person example (the demo's verified weekly demand).
const KITCHEN: Row[] = [
  row('Coke Zero', 72, 'cans', 'Coca-Cola only, the real brand'), row('Fanta Orange', 48, 'cans', 'Fanta only'), row('Bottled water', 48, 'bottles', '500ml'),
  row('Coffee beans', 4, 'kg', 'for the bean-to-cup machine'), row('Tea bags', 600, 'bags'), row('Fresh milk', 20, 'four-pint bottles', 'semi-skimmed'),
  row('Oatly Barista', 12, 'litres', 'Oatly only, the baristas insist'), row('Sugar', 2, 'kg'), row('Bananas', 60, 'bananas'), row('Apples', 60, 'apples'),
  row('Easy peelers', 3, 'kg'), row('Chocolate biscuits', 3, 'kg'), row('Crisps', 80, 'bags'), row('Chocolate bars', 48, 'bars'),
]
const CLEANING: Row[] = [
  row('Toilet rolls', 96, 'rolls'), row('Paper hand towels', 6000, 'sheets'), row('Hand wash', 3, 'litres'), row('Kitchen roll', 24, 'rolls'),
  row('Washing-up liquid', 2, 'litres'), row('Dishwasher tablets', 20, 'tablets'), row('Bin bags', 60, 'bags'), row('Surface spray', 3, 'litres', 'antibacterial'),
]

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
  const [form, setForm] = useState({ company: 'Rowbo Studio', headcount: '60', address: '2 Kingdom Street, London W2 6BD', budget: '450', allergies: 'nuts (two people)', name: account ? 'Washrooms & cleaning' : 'Kitchen & pantry', every: account ? 2 : 1 })
  const [rows, setRows] = useState<Row[]>(account ? CLEANING : KITCHEN)
  const set = (k: keyof typeof form, v: string | number) => setForm({ ...form, [k]: v })
  const setRow = (i: number, k: keyof Row, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function call(body: Record<string, unknown>, label: string) {
    setBusy(label); setError('')
    try {
      const r = await fetch('/api/onboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json())
      if (r.error) setError(r.error)
      else setDraft((d) => {
        const fresh = 'prompt' in body
        const profile = fresh && !account ? { ...r.profile, team: `${form.company} (${form.headcount} people)`, budgetPence: Math.round(Number(form.budget) * 100) || r.profile.budgetPence } : r.profile
        return { ...r, profile, name: fresh ? form.name : r.name ?? d?.name, everyWeeks: fresh ? form.every : r.everyWeeks ?? d?.everyWeeks ?? 1 }
      })
    } finally { setBusy('') }
  }
  // The form becomes the same plain-language demand Claude already reads reliably.
  function draftIt() {
    const items = rows.filter((r) => r.name.trim() && Number(r.qty) > 0).map((r) => `- ${r.qty} ${r.unit} ${r.name}${r.note.trim() ? ` (${r.note.trim()})` : ''}`).join('\n')
    const often = FREQUENCIES.find((f) => f.weeks === form.every)?.label.toLowerCase() ?? 'every week'
    const who = account
      ? `${account.team}. Weekly budget £${(account.budgetPence / 100).toFixed(0)}. Allergies: ${account.allergies.join(', ') || 'none'}.`
      : `${form.company}, a ${form.headcount}-person office. Allergies: ${form.allergies || 'none'}. Keep it under £${form.budget} a week.`
    void call({ prompt: `${who}\nSubscription "${form.name}", delivered ${often}. Per delivery we need:\n${items}` }, 'Drafting your basket…')
  }
  const reprice = (profile: Profile) => draft && void call({ profile, notCovered: draft.notCovered, assumptions: draft.assumptions }, 'Re-pricing…')
  const setQty = (id: string, qty: number) => draft && reprice({ ...draft.profile, lines: draft.profile.lines.map((l) => (l.id === id ? { ...l, qty } : l)) })
  const remove = (id: string) => draft && reprice({ ...draft.profile, lines: draft.profile.lines.filter((l) => l.id !== id) })
  async function confirm() {
    const d = draft!
    const r = await fetch('/api/subscriptions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add', name: d.name, everyWeeks: d.everyWeeks, lines: d.profile.lines, profile: d.profile, address: form.address }) }).then((x) => x.json())
    if (r.error) setError(r.error)
    else onDone()
  }

  const p = draft?.preview
  const budget = account?.budgetPence ?? draft?.profile.budgetPence ?? 0
  return (
    <section className="fp-panel" id="onboarding">
      <div className="fp-eyebrow">{account ? 'New subscription' : 'Step 1 of 2 · Your office'}</div>
      <h2 className="fp-h2">{account ? 'What else should we keep stocked?' : 'Set up your office restock'}</h2>
      <p className="fp-sub">List what you need per delivery. Add a note for anything that matters: a brand you insist on, a size, nut-free. We only buy things our shops actually sell.</p>
      {!account && (
        <div className="fp-form">
          <label className="fp-field">Company<input className="fp-input" value={form.company} onChange={(e) => set('company', e.target.value)} /></label>
          <label className="fp-field">People in the office<input className="fp-input" type="number" min={1} value={form.headcount} onChange={(e) => set('headcount', e.target.value)} /></label>
          <label className="fp-field wide">Delivery address<input className="fp-input" value={form.address} onChange={(e) => set('address', e.target.value)} autoComplete="street-address" /></label>
          <label className="fp-field">Weekly budget (£)<input className="fp-input" type="number" min={1} value={form.budget} onChange={(e) => set('budget', e.target.value)} /></label>
          <label className="fp-field">Allergies<input className="fp-input" value={form.allergies} onChange={(e) => set('allergies', e.target.value)} placeholder="e.g. nuts, gluten" /></label>
        </div>
      )}
      <div className="fp-form" style={{ marginTop: 14 }}>
        <label className="fp-field wide">Subscription name<input className="fp-input" value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
        <label className="fp-field">How often<select className="fp-input" value={form.every} onChange={(e) => set('every', Number(e.target.value))}>{FREQUENCIES.map((f) => <option key={f.weeks} value={f.weeks}>{f.label}</option>)}</select></label>
      </div>
      <div className="fp-table-form">
        <div className="fp-tf-head"><span>Item</span><span>Quantity</span><span>Unit</span><span>Description</span><span /></div>
        {rows.map((r, i) => (
          <div key={i} className="fp-tf-row">
            <input className="fp-input" value={r.name} onChange={(e) => setRow(i, 'name', e.target.value)} placeholder="e.g. Tea bags" aria-label="Item" />
            <input className="fp-input" type="number" min={0} value={r.qty} onChange={(e) => setRow(i, 'qty', e.target.value)} aria-label="Quantity needed" />
            <input className="fp-input" value={r.unit} onChange={(e) => setRow(i, 'unit', e.target.value)} placeholder="bags" aria-label="Unit" />
            <input className="fp-input" value={r.note} onChange={(e) => setRow(i, 'note', e.target.value)} placeholder="Brand, size, nut-free…" aria-label="Description" />
            <button className="fp-link" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Remove ${r.name}`}>✕</button>
          </div>
        ))}
        <button className="fp-btn sm ghost" style={{ marginTop: 8 }} onClick={() => setRows([...rows, row('', '', '')])}>+ Add item</button>
      </div>
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
