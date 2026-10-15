'use client'

import { useEffect, useState } from 'react'
import type { Store, Week, SupplierOrder } from '@/lib/store'
import { weekLabel } from '@/lib/week'
import { SHOPS } from '@/lib/shops'
import { FREQUENCIES, frequencyLabel, isDue, nextDue, type Subscription } from '@/lib/subscriptions'
import Onboarding from './Onboarding'
import Landing from './Landing'
import { LeafIcon, ReceiptIcon, TruckIcon, WalletIcon } from './Icons'

const gbp = (p?: number) => (p === undefined ? '—' : `£${(p / 100).toFixed(2)}`)
const shopOf = (slug: string) => SHOPS.find((x) => x.slug === slug)
type State = Store & { card?: { last4: string; limitPence: number }; user: string | null }
const post = (url: string, body?: object) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json())

export default function Home() {
  const [s, setS] = useState<State | null>(null)
  const load = () => fetch('/api/state').then((r) => r.json()).then(setS).catch(() => {})
  useEffect(() => {
    load()
    const a = setInterval(load, 1500)
    return () => clearInterval(a)
  }, [])
  if (!s) return <div className="fp" />
  return (
    <div className="fp">
      <div className="fp-wrap">
        <nav className="fp-nav">
          <div className="fp-logo"><img className="fp-mark-img" src="/brand/mark-light.svg" alt="" />FreqPay</div>
          {s.user && <div className="fp-user">{s.user}<button className="fp-link" onClick={() => fetch('/api/login', { method: 'DELETE' }).then(load)}>Sign out</button></div>}
        </nav>
        {!s.user ? <Landing onIn={load} /> : !s.profile.confirmed ? <Onboarding onDone={load} /> : <App s={s} reload={load} />}
      </div>
    </div>
  )
}

function App({ s, reload }: { s: State; reload: () => void }) {
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')
  const [receipt, setReceipt] = useState<{ week: Week; order: SupplierOrder } | null>(null)
  const [topping, setTopping] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const subs = s.subscriptions ?? []
  const openSub = subs.find((x) => x.id === open)
  const running = !!s.agent.running
  const current = s.weeks.at(-1)
  const done = s.weeks.filter((m) => m.orders?.some((o) => o.status === 'paid'))
  const spent = done.reduce((n, m) => n + (m.orders ?? []).filter((o) => o.status === 'paid').reduce((x, o) => x + o.total, 0), 0)
  const saved = done.reduce((n, m) => n + (m.status === 'bought' ? m.savings ?? 0 : 0), 0)
  const upcoming = s.weekIndex + 1
  const wallet = s.wallet?.balancePence ?? 0

  // Back from a Stripe top-up on the dashboard (?funded=<session>): credit the wallet.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('funded')
    if (!q) return
    window.history.replaceState({}, '', '/')
    if (q === 'cancel') return setMsg('Top-up cancelled.')
    fetch(`/api/billing?session_id=${encodeURIComponent(q)}`).then((r) => r.json()).then((r) => { setMsg(r.error ?? `Wallet topped up with ${gbp(r.amount)} (${r.card}).`); reload() })
  }, [])

  async function simulate() {
    setMsg('')
    const r = await post('/api/run')
    setMsg(r.error ? 'The agent isn’t running in this demo environment.' : r.started ? '' : r.message ?? '')
  }
  async function topUp(amount: number) {
    setTopping(true)
    const r = await post('/api/billing', { amountPence: amount })
    if (r.url) window.location.href = r.url
    else { setTopping(false); setMsg(r.error ?? 'Stripe is unavailable') }
  }
  const activity = [
    ...(s.wallet?.topups ?? []).map((t) => ({ t: t.t, label: `Top-up · ${t.card}`, amount: t.amount })),
    ...s.orders.filter((o) => o.status === 'approved').map((o) => ({ t: o.createdAt, label: `${shopOf(o.shop)?.name ?? o.shop} · ${weekLabel(o.weekIndex)}`, amount: -o.total })),
  ].sort((a, b) => b.t - a.t).slice(0, 8)

  return (
    <>
      <div className="fp-section" style={{ marginTop: 8 }}>
        <div>
          <div className="fp-eyebrow">{s.profile.team}</div>
          <h2 style={{ fontSize: 30 }}>Dashboard</h2>
        </div>
        <div className="fp-row" style={{ marginTop: 0 }}>
          {running && <span className="fp-pill run fp-live"><span className="fp-dot" /> Placing {current?.label} orders…</span>}
          <button className="fp-btn" onClick={simulate} disabled={running}>Simulate next week</button>
        </div>
      </div>
      {msg && <p className="fp-muted small" style={{ marginTop: -4 }}>{msg}</p>}

      <div className="fp-banner"><img src="/brand/delivery.jpg" alt="A grocery delivery arriving at an office reception" /><div>{running ? `Placing the ${current?.label} orders now` : `Next delivery ${weekLabel(upcoming)}${subs.filter((x) => isDue(x, upcoming)).length ? ': ' + subs.filter((x) => isDue(x, upcoming)).map((x) => x.name).join(' + ') : ''}`}</div></div>

      <div className="fp-dash-top">
        <div className="fp-wallet" style={{ marginTop: 0 }}>
          <div>
            <div className="fp-muted small fp-ico-row"><span className="fp-ico-c light"><WalletIcon /></span>Agent wallet</div>
            <div className="fp-wallet-bal">{gbp(wallet)}</div>
            <div className="fp-muted small">Limit {gbp(s.profile.budgetPence)} a week · £{((s.card?.limitPence ?? 30000) / 100).toFixed(0)} max per charge · card ••{s.card?.last4 ?? '0005'}</div>
          </div>
          <div className="fp-row" style={{ marginTop: 0 }}>
            {[s.profile.budgetPence, s.profile.budgetPence * 2].map((x) => <button key={x} className="fp-btn ghost" onClick={() => topUp(x)} disabled={topping}>Top up {gbp(x)}</button>)}
          </div>
        </div>
        <div className="fp-stats" style={{ margin: 0 }}>
          <div className="fp-stat"><div className="k fp-ico-row"><span className="fp-ico-c"><TruckIcon /></span>Next delivery</div><div className="v">{running ? current?.label : weekLabel(upcoming)}</div><div className="fp-muted small">{subs.filter((x) => isDue(x, running ? s.weekIndex : upcoming)).map((x) => x.name).join(' + ') || 'nothing due'}</div></div>
          <div className="fp-stat"><div className="k fp-ico-row"><span className="fp-ico-c"><ReceiptIcon /></span>Spent</div><div className="v">{gbp(spent)}</div><div className="fp-muted small">{done.length} {done.length === 1 ? 'week' : 'weeks'}, delivery included</div></div>
          <div className="fp-stat"><div className="k fp-ico-row"><span className="fp-ico-c"><LeafIcon /></span>Saved</div><div className="v" style={{ color: 'var(--good)' }}>{gbp(saved)}</div><div className="fp-muted small" title="What you'd pay ordering everything from the single cheapest supermarket, with office supplies it doesn't sell (like Z-fold hand towels) topped up from Viking, delivery included.">vs buying from one supermarket ⓘ</div></div>
        </div>
      </div>

      <div className="fp-section"><h2>Your subscriptions</h2></div>
      <section className="fp-panel fp-list">
        {subs.map((sub) => {
          const next = nextDue(sub, s.weekIndex)
          return (
            <button key={sub.id} className="fp-list-row" onClick={() => setOpen(sub.id)}>
              <span><b>{sub.name}</b><span className="fp-muted small">{sub.lines.length} items</span></span>
              <span className="fp-muted">{frequencyLabel(sub.everyWeeks)}</span>
              <span className="fp-muted">{next ? `Next ${weekLabel(next)}` : '—'}</span>
              <span className={`fp-pill ${sub.paused ? 'off' : 'on'}`}><span className="fp-dot" />{sub.paused ? 'Paused' : 'Active'}</span>
              <span className="fp-muted" aria-hidden>›</span>
            </button>
          )
        })}
      </section>
      <div className="fp-row"><button className="fp-btn ghost" onClick={() => setAdding(true)}>+ Add a subscription</button></div>
      {adding && <div className="fp-modal" onClick={() => setAdding(false)}><div className="fp-modal-body wide" onClick={(e) => e.stopPropagation()}><Onboarding account={s.profile} onDone={() => { setAdding(false); reload() }} onCancel={() => setAdding(false)} /></div></div>}
      {openSub && <SubModal sub={openSub} week={s.weekIndex} reload={reload} onClose={() => setOpen(null)} />}

      <div className="fp-section"><h2>Deliveries</h2></div>
      {s.weeks.length === 0 && <section className="fp-panel"><p className="fp-muted" style={{ margin: 0 }}>No deliveries yet. Press <b>Simulate next week</b> to watch the agent place this week&apos;s orders.</p></section>}
      {[...s.weeks].reverse().map((m) => <Delivery key={m.runId} s={s} m={m} onReceipt={(order) => setReceipt({ week: m, order })} />)}

      <div className="fp-two">
        <section className="fp-panel">
          <h3 className="fp-h3">Wallet activity</h3>
          {activity.length === 0 ? <p className="fp-muted small">No activity yet.</p> : (
            <table className="fp-table"><tbody>
              {activity.map((a, i) => <tr key={i}><td className="fp-muted">{new Date(a.t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td>{a.label}</td><td style={{ textAlign: 'right', fontWeight: 650 }} className={a.amount > 0 ? 'fp-ok' : ''}>{a.amount > 0 ? '+' : '−'}{gbp(Math.abs(a.amount))}</td></tr>)}
            </tbody></table>
          )}
        </section>
        <Settings s={s} reload={reload} />
      </div>

      {receipt && <Receipt s={s} week={receipt.week} order={receipt.order} onClose={() => setReceipt(null)} />}
    </>
  )
}

function Delivery({ s, m, onReceipt }: { s: State; m: Week; onReceipt: (o: SupplierOrder) => void }) {
  const live = m.status === 'running'
  const last = s.events.filter((e) => e.runId === m.runId && (e.kind === 'pay' || e.kind === 'decision' || e.kind === 'step')).at(-1)
  return (
    <section className="fp-panel">
      <div className="fp-row" style={{ marginTop: 0, justifyContent: 'space-between' }}>
        <div>
          <b style={{ fontSize: 18 }}>{m.label}</b> <span className="fp-muted small">{m.includes?.join(' + ')}</span>
        </div>
        <div className="fp-row" style={{ marginTop: 0 }}>
          {m.total !== undefined && <span>Paid <b>{gbp(m.total)}</b> incl. delivery{m.savings ? <> · <span className="fp-ok">saved {gbp(m.savings)}</span></> : null}</span>}
          <span className={`fp-pill ${m.status === 'bought' ? 'on' : live ? 'run fp-live' : 'off'}`}><span className="fp-dot" />{m.status === 'bought' ? 'Delivered' : live ? 'Ordering' : m.status === 'nothing-bought' ? 'Nothing due' : m.status}</span>
        </div>
      </div>
      {live && last && <div className="fp-muted small" style={{ marginTop: 8 }}>{last.text}</div>}
      {m.orders && (
        <div className="fp-week">
          {m.orders.map((o) => (
            <div key={o.shop} className="fp-order">
              <div className="fp-row" style={{ marginTop: 0, justifyContent: 'space-between' }}>
                <img src={shopOf(o.shop)?.logo} alt={o.shopName} />
                <span className={`fp-pill ${o.status === 'paid' ? 'on' : o.status === 'declined' ? 'off' : 'run'}`}>{o.status === 'planned' ? 'ordering' : o.status}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 750, marginTop: 8 }}>{gbp(o.total)}</div>
              <div className="fp-muted small">{o.items.reduce((n, i) => n + (i.packs ?? 1), 0)} packs · delivery {o.delivery ? gbp(o.delivery) : 'free'}</div>
              {o.declineReason && <div className="fp-bad small">{o.declineReason}</div>}
              {o.status === 'paid' && <button className="fp-link" style={{ marginTop: 6 }} onClick={() => onReceipt(o)}>View receipt</button>}
            </div>
          ))}
        </div>
      )}
      {m.note && <div className="fp-note">{m.note}</div>}
    </section>
  )
}

function Receipt({ s, week, order, onClose }: { s: State; week: Week; order: SupplierOrder; onClose: () => void }) {
  const shop = shopOf(order.shop)
  const rec = s.orders.find((o) => o.weekIndex === week.index && o.shop === order.shop && o.status === 'approved')
  return (
    <div className="fp-modal" onClick={onClose}>
      <div className="fp-receipt" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Receipt from ${order.shopName}`}>
        <div className="fp-row" style={{ marginTop: 0, justifyContent: 'space-between' }}>
          <img src={shop?.logo} alt={order.shopName} style={{ height: 30, maxWidth: 130, objectFit: 'contain' }} />
          <button className="fp-link" onClick={onClose}>Close</button>
        </div>
        <h3 className="fp-h3" style={{ marginTop: 14, marginBottom: 2 }}>Receipt</h3>
        <div className="fp-muted small">{order.shopName} · order {rec?.id ?? order.orderId ?? '—'} · {rec ? new Date(rec.createdAt).toLocaleString('en-GB') : week.label}</div>
        <div className="fp-muted small">Deliver to {s.profile.address ?? s.profile.team}</div>
        <table className="fp-table" style={{ marginTop: 12 }}>
          <tbody>
            {order.items.map((i) => <tr key={i.id}><td>{i.packs ?? 1} × {i.name}</td><td style={{ textAlign: 'right' }}>{gbp(i.price * (i.packs ?? 1))}</td></tr>)}
            <tr><td className="fp-muted">Subtotal</td><td style={{ textAlign: 'right' }}>{gbp(order.subtotal)}</td></tr>
            <tr><td className="fp-muted">Delivery</td><td style={{ textAlign: 'right' }}>{order.delivery ? gbp(order.delivery) : 'Free'}</td></tr>
            <tr><td><b>Total</b></td><td style={{ textAlign: 'right' }}><b>{gbp(order.total)}</b></td></tr>
          </tbody>
        </table>
        <div className="fp-note small">Paid from the agent wallet with Stripe Issuing card ••{s.card?.last4 ?? '0005'}. Authorization {order.authorizationId ?? rec?.authorizationId ?? '—'}: approved in real time because it matched the plan to the penny.</div>
        <div className="fp-row"><button className="fp-btn sm ghost" onClick={() => window.print()}>Print</button></div>
      </div>
    </div>
  )
}

function SubModal({ sub, week, reload, onClose }: { sub: Subscription; week: number; reload: () => void; onClose: () => void }) {
  const [qtys, setQtys] = useState<Record<string, string>>({})
  const [name, setName] = useState(sub.name)
  const [err, setErr] = useState('')
  useEffect(() => setName(sub.name), [sub.name])
  const update = (fields: object) => post('/api/subscriptions', { action: 'update', id: sub.id, ...fields }).then((r) => { setErr(r.error ?? ''); reload() })
  const parsed = Object.entries(qtys).map(([k, v]) => [k, v.trim() === '' ? NaN : Number(v)] as const)
  const valid = parsed.every(([, n]) => Number.isFinite(n) && n >= 0)
  const dirty = Object.keys(qtys).length > 0
  const next = nextDue(sub, week)
  return (
    <div className="fp-modal" onClick={onClose}>
      <div className="fp-modal-body wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={sub.name}>
        <div className="fp-row" style={{ marginTop: 0, justifyContent: 'space-between' }}>
          <input className="fp-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => (name.trim() ? name.trim() !== sub.name && update({ name: name.trim() }) : setName(sub.name))} aria-label="Subscription name" style={{ maxWidth: 420 }} />
          <button className="fp-link" onClick={onClose}>Close</button>
        </div>
        <div className="fp-muted small">{sub.paused ? 'Paused' : `Next delivery ${next ? weekLabel(next) : '—'}`} · {sub.lines.length} items</div>
        <div className="fp-row">
          <div className="fp-freq" role="group" aria-label="How often">
            {FREQUENCIES.map((f) => <button key={f.weeks} className={sub.everyWeeks === f.weeks ? 'sel' : ''} onClick={() => sub.everyWeeks !== f.weeks && update({ everyWeeks: f.weeks })}>{f.label}</button>)}
          </div>
        </div>
        <table className="fp-table" style={{ marginTop: 14 }}>
          <thead><tr><th>Item</th><th style={{ width: 110 }}>Quantity</th><th style={{ width: 130 }}>Unit</th><th>Notes</th></tr></thead>
          <tbody>
            {sub.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td><input className="fp-input qty" type="number" min={0} value={qtys[l.id] ?? String(l.qty)} onChange={(e) => setQtys({ ...qtys, [l.id]: e.target.value })} aria-label={`Quantity of ${l.name}`} /></td>
                <td className="fp-muted">{l.unit}</td>
                <td className="fp-muted">{l.brand ? `${l.brand} only` : 'Any brand'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {err && <div className="fp-bad small" style={{ marginTop: 8 }}>{err}</div>}
        <div className="fp-row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
          <div className="fp-row" style={{ marginTop: 0 }}>
            <button className="fp-btn" disabled={!dirty || !valid} onClick={() => update({ qtys: Object.fromEntries(parsed) }).then(() => setQtys({}))}>Save changes</button>
            {dirty && <button className="fp-btn ghost" onClick={() => setQtys({})}>Discard</button>}
          </div>
          <div className="fp-row" style={{ marginTop: 0 }}>
            <button className="fp-btn ghost" onClick={() => update({ paused: !sub.paused })}>{sub.paused ? 'Resume' : 'Pause'}</button>
            <button className="fp-btn ghost danger" onClick={() => post('/api/subscriptions', { action: 'remove', id: sub.id }).then(() => { reload(); onClose() })}>Cancel subscription</button>
          </div>
        </div>
        <div className="fp-muted small" style={{ marginTop: 10 }}>Changes apply from the next delivery. Set a quantity to 0 to remove an item.</div>
      </div>
    </div>
  )
}

function Settings({ s, reload }: { s: State; reload: () => void }) {
  const [address, setAddress] = useState(s.profile.address ?? '')
  const [budget, setBudget] = useState((s.profile.budgetPence / 100).toFixed(2))
  const [allergies, setAllergies] = useState(s.profile.allergies.join(', '))
  const [saved, setSaved] = useState(false)
  async function save() {
    await post('/api/profile', { budgetPence: Math.round(parseFloat(budget) * 100), allergies: allergies.split(',').map((x) => x.trim()).filter(Boolean), address })
    setSaved(true); reload()
  }
  const edit = <T,>(f: (v: T) => void) => (v: T) => { f(v); setSaved(false) }
  return (
    <details className="fp-panel fp-settings">
      <summary><b>Account settings</b><span className="fp-muted small"> · delivery address, weekly limit, allergies</span></summary>
      <label className="fp-field" style={{ marginTop: 12 }}>Delivery address<input className="fp-input" value={address} onChange={(e) => edit(setAddress)(e.target.value)} /></label>
      <label className="fp-field" style={{ marginTop: 10 }}>Weekly spending limit (£)<input className="fp-input" value={budget} onChange={(e) => edit(setBudget)(e.target.value)} /></label>
      <label className="fp-field" style={{ marginTop: 10 }}>Allergies<input className="fp-input" value={allergies} onChange={(e) => edit(setAllergies)(e.target.value)} /></label>
      <div className="fp-row"><button className="fp-btn sm" onClick={save}>{saved ? 'Saved' : 'Save'}</button></div>
    </details>
  )
}
