'use client'

import { useEffect, useState } from 'react'
import type { Profile } from '@/lib/rules'
import type { WeekPlan } from '@/lib/plan'
import { LINE_EMOJI, LINE_IMAGES } from '@/lib/images'
import { SHOPS } from '@/lib/shops'
import { FREQUENCIES } from '@/lib/subscriptions'
import { PRODUCT_IMAGES } from '@/lib/productImages'

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

// The photo of the exact product the plan buys (from that shop), else the category photo.
export function Photo({ category, productId, size = 96 }: { category: string; productId?: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const own = productId ? PRODUCT_IMAGES[productId] : undefined
  const img = own ? { url: own, credit: 'Shop pack photo' } : LINE_IMAGES[category]
  if (!img || failed) return <div className="fp-photo" style={{ height: size, fontSize: size * 0.45 }}>{LINE_EMOJI[category] ?? '📦'}</div>
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="fp-photo" src={img.url} alt="" title={img.credit} onError={() => setFailed(true)} style={{ height: size }} />
}

// The setup flow, each thing asked once. First time: office -> needs -> basket -> wallet (Stripe
// Checkout top-up) -> start. Adding a subscription later: needs -> basket -> start.
const FIRST_STEPS = ['Your office', 'What you need', 'Your basket', 'Agent wallet']
const ADD_STEPS = ['What you need', 'Your basket']

export default function Onboarding({ account, onDone, onCancel }: { account?: Profile; onDone: () => void; onCancel?: () => void }) {
  const steps = account ? ADD_STEPS : FIRST_STEPS
  const [step, setStep] = useState(0)
  const [office, setOffice] = useState({ company: 'Rowbo Studio', headcount: '60', address: '2 Kingdom Street, London W2 6BD' })
  const [notes, setNotes] = useState(account ? '' : 'Two people have nut allergies.')
  const [sub, setSub] = useState({ name: account ? 'Washrooms & cleaning' : 'Kitchen & pantry', every: account ? 2 : 1 })
  const [rows, setRows] = useState<Row[]>(account ? CLEANING : KITCHEN)
  const [budget, setBudget] = useState('450')
  const [topup, setTopup] = useState(90000)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [wallet, setWallet] = useState<{ card: string; balancePence: number } | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const setRow = (i: number, k: keyof Row, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const name = steps[step]

  // Back from Stripe Checkout (?funded=<session>): restore the setup and credit the wallet.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('funded')
    if (!q || account) return
    window.history.replaceState({}, '', '/')
    try {
      const saved = JSON.parse(sessionStorage.getItem('fp-setup') ?? 'null')
      if (saved) { setOffice(saved.office); setSub(saved.sub); setNotes(saved.notes ?? ''); setRows(saved.rows); setBudget(saved.budget); setTopup(saved.topup); setDraft(saved.draft); setStep(3) }
    } catch {}
    if (q === 'cancel') return setError('Top-up cancelled. Your basket is still here.')
    setBusy('Confirming your top-up with Stripe…')
    fetch(`/api/billing?session_id=${encodeURIComponent(q)}`).then((r) => r.json()).then((r) => { setBusy(''); if (r.error) setError(r.error); else setWallet(r) })
  }, [account])

  async function call(body: Record<string, unknown>, label: string, next?: number) {
    setBusy(label); setError('')
    try {
      const r = await fetch('/api/onboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json())
      if (r.error) return setError(r.error)
      setDraft(r)
      if (next !== undefined) setStep(next)
    } finally { setBusy('') }
  }
  // The form becomes the plain-language demand Claude already reads reliably (quantities exact).
  function draftIt() {
    const items = rows.filter((r) => r.name.trim() && Number(r.qty) > 0).map((r) => `- ${r.qty} ${r.unit} ${r.name}${r.note.trim() ? ` (${r.note.trim()})` : ''}`).join('\n')
    const often = FREQUENCIES.find((f) => f.weeks === sub.every)?.label.toLowerCase() ?? 'every week'
    const who = account
      ? `${account.team}. Weekly budget £${(account.budgetPence / 100).toFixed(0)}. Allergies: ${account.allergies.join(', ') || 'none'}.`
      : `${office.company}, a ${office.headcount}-person office. Keep it under £${budget} a week.`
    void call({ prompt: `${who}\nSubscription "${sub.name}", delivered ${often}. Per delivery we need:\n${items}${notes.trim() ? `\nNotes: ${notes.trim()}` : ''}` }, 'Pricing your basket across the shops…', steps.indexOf('Your basket'))
  }
  const reprice = (profile: Profile) => draft && void call({ profile, notCovered: draft.notCovered, assumptions: draft.assumptions }, 'Re-pricing…')
  const setQty = (id: string, qty: number) => draft && reprice({ ...draft.profile, lines: draft.profile.lines.map((l) => (l.id === id ? { ...l, qty } : l)) })
  const remove = (id: string) => draft && reprice({ ...draft.profile, lines: draft.profile.lines.filter((l) => l.id !== id) })

  const budgetPence = account?.budgetPence ?? (Math.round(Number(budget) * 100) || 0)
  const profile = (): Profile => ({ ...draft!.profile, team: account?.team ?? `${office.company} (${office.headcount} people)`, budgetPence, allergies: account?.allergies ?? draft!.profile.allergies }) // read from the notes by Claude
  async function start() {
    setBusy('Starting…'); setError('')
    const r = await fetch('/api/subscriptions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add', name: sub.name, everyWeeks: sub.every, lines: draft!.profile.lines, profile: profile(), address: office.address }) }).then((x) => x.json())
    setBusy('')
    if (r.error) setError(r.error)
    else { try { sessionStorage.removeItem('fp-setup') } catch {} ; onDone() }
  }
  async function payWithStripe() {
    setBusy('Opening Stripe Checkout…'); setError('')
    try { sessionStorage.setItem('fp-setup', JSON.stringify({ office, sub, rows, notes, budget, topup, draft })) } catch {}
    const r = await fetch('/api/billing', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amountPence: topup }) }).then((x) => x.json())
    if (r.url) window.location.href = r.url
    else { setBusy(''); setError(r.error ?? 'Stripe is unavailable') }
  }

  const p = draft?.preview
  // Which exact product the plan buys for each line, so its card shows that shop's pack photo.
  const chosen: Record<string, string> = {}
  for (const o of p?.orders ?? []) for (const it of o.items) {
    const prod = SHOPS.find((x) => x.slug === o.shop)?.products.find((x) => x.id === it.id)
    if (prod) chosen[prod.category] = it.id
  }
  const often = FREQUENCIES.find((f) => f.weeks === sub.every)?.label.toLowerCase()
  const status = <>{busy && <span className="fp-muted">{busy}</span>}{error && <span className="fp-bad">{error}</span>}</>

  return (
    <section className="fp-panel" id="onboarding">
      <ol className="fp-stepper">
        {steps.map((t, i) => <li key={t} className={i === step ? 'on' : i < step ? 'done' : ''}><span>{i < step ? '✓' : i + 1}</span>{t}</li>)}
      </ol>

      {name === 'Your office' && <>
        <h2 className="fp-h2">Tell us about your office</h2>
        <p className="fp-sub">Where we deliver, and who we&apos;re buying for.</p>
        <div className="fp-form">
          <label className="fp-field">Company<input className="fp-input" value={office.company} onChange={(e) => setOffice({ ...office, company: e.target.value })} autoComplete="organization" /></label>
          <label className="fp-field">People in the office<input className="fp-input" type="number" min={1} value={office.headcount} onChange={(e) => setOffice({ ...office, headcount: e.target.value })} /></label>
          <label className="fp-field wide">Delivery address<input className="fp-input" value={office.address} onChange={(e) => setOffice({ ...office, address: e.target.value })} autoComplete="street-address" /></label>
        </div>
        <div className="fp-row" style={{ marginTop: 20 }}>
          <button className="fp-btn" onClick={() => setStep(1)} disabled={!office.company.trim() || !office.address.trim()}>Continue</button>
        </div>
      </>}

      {name === 'What you need' && <>
        <h2 className="fp-h2">{account ? 'Add a subscription' : 'What do you need?'}</h2>
        <p className="fp-sub">One list per delivery rhythm. Add a description for anything that matters: a brand you insist on, a size.</p>
        <div className="fp-form">
          <label className="fp-field wide">Subscription name<input className="fp-input" value={sub.name} onChange={(e) => setSub({ ...sub, name: e.target.value })} /></label>
          <label className="fp-field">Delivered<select className="fp-input" value={sub.every} onChange={(e) => setSub({ ...sub, every: Number(e.target.value) })}>{FREQUENCIES.map((f) => <option key={f.weeks} value={f.weeks}>{f.label}</option>)}</select></label>
        </div>
        <div className="fp-table-form">
          <div className="fp-tf-head"><span>Item</span><span>Quantity</span><span>Unit</span><span>Description</span><span /></div>
          {rows.map((r, i) => (
            <div key={i} className="fp-tf-row">
              <input className="fp-input" value={r.name} onChange={(e) => setRow(i, 'name', e.target.value)} placeholder="e.g. Tea bags" aria-label="Item" />
              <input className="fp-input" type="number" min={0} value={r.qty} onChange={(e) => setRow(i, 'qty', e.target.value)} aria-label="Quantity" />
              <input className="fp-input" value={r.unit} onChange={(e) => setRow(i, 'unit', e.target.value)} placeholder="bags" aria-label="Unit" />
              <input className="fp-input" value={r.note} onChange={(e) => setRow(i, 'note', e.target.value)} placeholder="Brand, size…" aria-label="Description" />
              <button className="fp-link" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Remove ${r.name}`}>✕</button>
            </div>
          ))}
          <button className="fp-btn sm ghost" style={{ marginTop: 8 }} onClick={() => setRows([...rows, row('', '', '')])}>+ Add item</button>
        </div>
        <label className="fp-field" style={{ marginTop: 18 }}>Anything else we should know?<textarea className="fp-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, brands to avoid, delivery instructions…" /></label>
        <div className="fp-row" style={{ marginTop: 20 }}>
          {step > 0 ? <button className="fp-btn ghost" onClick={() => setStep(step - 1)}>Back</button> : onCancel && <button className="fp-btn ghost" onClick={onCancel}>Cancel</button>}
          <button className="fp-btn" onClick={draftIt} disabled={!!busy || !rows.some((r) => r.name.trim() && Number(r.qty) > 0)}>Find the best prices</button>
          {status}
        </div>
      </>}

      {name === 'Your basket' && draft && p && <>
        <h2 className="fp-h2">Your basket: {sub.name}</h2>
        <p className="fp-sub">Delivered {often} to {account?.address ?? office.address}. Best prices across {SHOPS.length} shops, delivery included.</p>
        <div className="fp-basket-sum">
          <div><div className="fp-muted small">Each delivery</div><b>{gbp(p.total)}</b></div>
          <div><div className="fp-muted small">From</div><b>{p.orders.map((o) => SHOP_NAMES[o.shop]).join(' + ') || '—'}</b></div>
          {p.savings ? <div><div className="fp-muted small">You save</div><b className="fp-ok">{gbp(p.savings)}</b><div className="fp-muted small">vs one supermarket + Viking</div></div> : null}
        </div>
        <div className="fp-items">
          {draft.profile.lines.map((l) => {
            const c = p.comparison.find((x) => x.lineId === l.id)
            const cell = c?.chosenShop ? c.perShop[c.chosenShop] : null
            return (
              <div key={l.id} className="fp-item">
                <Photo category={l.category} productId={chosen[l.category]} />
                <div className="fp-item-name">{cell?.product ?? l.name}</div>
                <div className="fp-row tight">
                  <input key={`${l.id}-${l.qty}`} className="fp-input qty" type="number" min={1} defaultValue={l.qty} onBlur={(e) => Number(e.target.value) !== l.qty && setQty(l.id, Math.max(1, Math.round(Number(e.target.value))))} aria-label={`Quantity of ${l.name}`} />
                  <span className="fp-muted">{l.unit}</span>
                </div>
                <div className="small">{cell ? <>{gbp(cell.cost)} · {SHOP_NAMES[c!.chosenShop]}</> : <span className="fp-bad">not available</span>}</div>
                <button className="fp-link" onClick={() => remove(l.id)}>Remove</button>
              </div>
            )
          })}
        </div>
        {draft.profile.allergies.length > 0 && <p className="fp-muted small">Avoiding anything with: {draft.profile.allergies.join(', ')} (from your notes).</p>}
        {draft.notCovered.length > 0 && <p className="fp-bad small">Our shops don&apos;t sell: {draft.notCovered.join(', ')}.</p>}
        <div className="fp-row" style={{ marginTop: 20 }}>
          <button className="fp-btn ghost" onClick={() => setStep(step - 1)}>Edit items</button>
          {account
            ? <button className="fp-btn" onClick={start} disabled={!!busy || !p.orders.length}>Start this subscription</button>
            : <button className="fp-btn" onClick={() => setStep(step + 1)} disabled={!!busy || !p.orders.length}>Continue</button>}
          {status}
        </div>
      </>}

      {name === 'Agent wallet' && draft && p && <>
        <h2 className="fp-h2">Top up your agent&apos;s wallet</h2>
        <p className="fp-sub">Your agent pays each shop with its own Stripe card. It can only spend what&apos;s in its wallet, and never more than your weekly limit.</p>
        <div className="fp-form">
          <label className="fp-field">Weekly spending limit (£)<input className="fp-input" type="number" min={1} value={budget} onChange={(e) => setBudget(e.target.value)} /><span className="fp-muted small" style={{ fontWeight: 400 }}>This basket is about {gbp(p.total)} per delivery.</span></label>
          <div className="fp-field wide">Top up
            <div className="fp-chips">
              {[budgetPence, budgetPence * 2, budgetPence * 4].filter((x) => x >= 1000).map((x, i) => (
                <button key={i} className={`fp-chip ${topup === x ? 'sel' : ''}`} onClick={() => setTopup(x)}>{gbp(x)}<span>{['1 week', '2 weeks', '4 weeks'][i]}</span></button>
              ))}
            </div>
          </div>
        </div>
        <div className="fp-wallet">
          {wallet
            ? <><div><div className="fp-muted small">Agent wallet</div><div className="fp-wallet-bal">{gbp(wallet.balancePence)}</div><div className="fp-ok small">✓ Paid with {wallet.card} via Stripe</div></div>
                <button className="fp-btn ghost" onClick={payWithStripe} disabled={!!busy}>Top up more</button></>
            : <><div><div className="fp-muted small">Agent wallet</div><div className="fp-wallet-bal">£0.00</div><div className="fp-muted small">Secure payment by Stripe. Test mode: card 4242 4242 4242 4242, any future date, any CVC.</div></div>
                <button className="fp-btn" onClick={payWithStripe} disabled={!!busy || topup < 1000}>Top up {gbp(topup)} with Stripe</button></>}
        </div>
        <div className="fp-row" style={{ marginTop: 20 }}>
          <button className="fp-btn ghost" onClick={() => setStep(step - 1)}>Back</button>
          <button className="fp-btn" onClick={start} disabled={!!busy || !wallet || p.total > budgetPence}>Start my subscription</button>
          {p.total > budgetPence && <span className="fp-bad small">The basket is over the weekly limit.</span>}
          {status}
        </div>
      </>}
    </section>
  )
}
