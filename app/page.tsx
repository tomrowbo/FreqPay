'use client'

import { useEffect, useState } from 'react'
import type { Store, Week } from '@/lib/store'
import { weekLabel } from '@/lib/week'
import { SHOPS } from '@/lib/shops'
import { FREQUENCIES, frequencyLabel, isDue, nextDue, type Subscription } from '@/lib/subscriptions'
import Onboarding, { Photo } from './Onboarding'
import Landing from './Landing'

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
          <div className="fp-logo"><img className="fp-mark-img" src="/brand/mark.svg" alt="" />FreqPay</div>
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
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const subs = s.subscriptions ?? []
  const current = s.weeks.at(-1)
  const running = !!s.agent.running
  const countdown = s.agent.nextRunAt ? Math.max(0, Math.round((s.agent.nextRunAt - now) / 1000)) : null
  const done = s.weeks.filter((m) => m.orders?.some((o) => o.status === 'paid'))
  const spent = done.reduce((n, m) => n + (m.orders ?? []).filter((o) => o.status === 'paid').reduce((x, o) => x + o.total, 0), 0)
  const saved = done.reduce((n, m) => n + (m.status === 'bought' ? m.savings ?? 0 : 0), 0)
  const upcoming = s.weekIndex + 1

  async function runNow() {
    setMsg('Starting…')
    const r = await post('/api/run')
    setMsg(r.error ?? (r.started ? 'The agent is shopping' : r.message ?? ''))
  }

  return (
    <>
      <div className="fp-section" style={{ marginTop: 8 }}>
        <div>
          <div className="fp-eyebrow">{s.profile.team}</div>
          <h2 style={{ fontSize: 30 }}>Your subscriptions</h2>
        </div>
        <div className="fp-row" style={{ marginTop: 0 }}>
          {running
            ? <span className="fp-pill run fp-live"><span className="fp-dot" /> Shopping for {current?.label}…</span>
            : <span className="fp-muted">{countdown !== null ? `Next delivery run (${weekLabel(upcoming)}) in ${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}` : ''}</span>}
          <button className="fp-btn sm" onClick={runNow} disabled={running}>Run next delivery now</button>
        </div>
      </div>
      {msg && <p className="fp-muted small" style={{ marginTop: -4 }}>{msg}</p>}

      <div className="fp-stats">
        <div className="fp-stat"><div className="k">Next delivery</div><div className="v">{running ? current?.label : weekLabel(upcoming)}</div><div className="fp-muted small">{subs.filter((x) => isDue(x, running ? s.weekIndex : upcoming)).map((x) => x.name).join(' + ') || 'nothing due'}</div></div>
        <div className="fp-stat"><div className="k">Weekly budget</div><div className="v">{gbp(s.profile.budgetPence)}</div><div className="fp-muted small">£{((s.card?.limitPence ?? 0) / 100).toFixed(0)} max per shop charge</div></div>
        <div className="fp-stat"><div className="k">Spent so far</div><div className="v">{gbp(spent)}</div><div className="fp-muted small">{done.length} {done.length === 1 ? 'delivery' : 'deliveries'}</div></div>
        <div className="fp-stat"><div className="k">Saved so far</div><div className="v" style={{ color: 'var(--good)' }}>{gbp(saved)}</div><div className="fp-muted small">vs one supermarket + Viking</div></div>
      </div>

      <div className="fp-subs">
        {subs.map((sub) => <SubCard key={sub.id} sub={sub} week={s.weekIndex} reload={reload} />)}
        {!adding && (
          <button className="fp-panel" onClick={() => setAdding(true)} style={{ cursor: 'pointer', borderStyle: 'dashed', display: 'grid', placeItems: 'center', minHeight: 180, font: 'inherit', color: 'var(--ink2)' }}>
            <span style={{ fontSize: 30 }}>＋</span><b style={{ color: 'var(--ink)' }}>Add a subscription</b><span className="small">e.g. cleaning supplies every 2 weeks</span>
          </button>
        )}
      </div>
      {adding && <div style={{ marginTop: 16 }}><Onboarding account={s.profile} onDone={() => { setAdding(false); reload() }} onCancel={() => setAdding(false)} /></div>}

      <Account s={s} reload={reload} />

      {current && <LatestWeek s={s} m={current} subs={subs} />}

      <UnderTheHood s={s} />
    </>
  )
}

function SubCard({ sub, week, reload }: { sub: Subscription; week: number; reload: () => void }) {
  const [qtys, setQtys] = useState<Record<string, string>>({})
  const [name, setName] = useState(sub.name)
  const [err, setErr] = useState('')
  useEffect(() => setName(sub.name), [sub.name])
  const dirty = Object.keys(qtys).length > 0
  const update = (fields: object) => post('/api/subscriptions', { action: 'update', id: sub.id, ...fields }).then((r) => { setErr(r.error ?? ''); reload() })
  const parsed = Object.entries(qtys).map(([k, v]) => [k, v.trim() === '' ? NaN : Number(v)] as const)
  const valid = parsed.every(([, n]) => Number.isFinite(n) && n >= 0)
  const next = nextDue(sub, week)
  return (
    <section className="fp-panel" style={{ marginBottom: 0 }}>
      <div className="fp-sub-head">
        <div style={{ flex: 1 }}>
          <input className="fp-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => (name.trim() ? name.trim() !== sub.name && update({ name: name.trim() }) : setName(sub.name))} aria-label="Subscription name" />
          <div className="fp-muted small">{sub.lines.length} items · {next ? `next delivery ${weekLabel(next)}` : 'paused'}</div>
        </div>
        <span className={`fp-pill ${sub.paused ? 'off' : 'on'}`}><span className="fp-dot" />{sub.paused ? 'Paused' : 'Active'}</span>
      </div>
      <div className="fp-row">
        <div className="fp-freq" role="group" aria-label="How often">
          {FREQUENCIES.map((f) => <button key={f.weeks} className={sub.everyWeeks === f.weeks ? 'sel' : ''} onClick={() => sub.everyWeeks !== f.weeks && update({ everyWeeks: f.weeks })} title={f.label}>{f.short}</button>)}
        </div>
      </div>
      <ul className="fp-lines">
        {sub.lines.map((l) => (
          <li key={l.id} className="fp-line">
            <Photo category={l.category} size={34} />
            <span>{l.name}<span className="fp-muted small">{l.brand ? ` · ${l.brand} only` : ''}</span></span>
            <span className="fp-row tight">
              <input className="fp-input qty" type="number" min={0} value={qtys[l.id] ?? String(l.qty)} onChange={(e) => setQtys({ ...qtys, [l.id]: e.target.value })} aria-label={`Quantity of ${l.name}`} />
              <span className="fp-muted small" style={{ width: 62 }}>{l.unit}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="fp-row">
        {dirty && <button className="fp-btn sm" disabled={!valid} title={valid ? '0 removes an item' : 'Quantities must be numbers'} onClick={() => update({ qtys: Object.fromEntries(parsed) }).then(() => setQtys({}))}>Save changes</button>}
        {dirty && <button className="fp-btn sm ghost" onClick={() => setQtys({})}>Discard</button>}
        <button className="fp-btn sm ghost" onClick={() => update({ paused: !sub.paused })}>{sub.paused ? 'Resume' : 'Pause'}</button>
        <button className="fp-link" onClick={() => post('/api/subscriptions', { action: 'remove', id: sub.id }).then(reload)}>Cancel subscription</button>
      </div>
      {err && <div className="fp-bad small" style={{ marginTop: 8 }}>{err}</div>}
      <div className="fp-muted small" style={{ marginTop: 8 }}>{frequencyLabel(sub.everyWeeks)}. Changes apply from the next delivery; 0 removes an item.</div>
    </section>
  )
}

function Account({ s, reload }: { s: State; reload: () => void }) {
  const [budget, setBudget] = useState((s.profile.budgetPence / 100).toFixed(2))
  const [allergies, setAllergies] = useState(s.profile.allergies.join(', '))
  const [address, setAddress] = useState(s.profile.address ?? '')
  const [saved, setSaved] = useState(false)
  async function save() {
    await post('/api/profile', { budgetPence: Math.round(parseFloat(budget) * 100), allergies: allergies.split(',').map((x) => x.trim()).filter(Boolean), address })
    setSaved(true); reload()
  }
  return (
    <section className="fp-panel" style={{ marginTop: 20 }}>
      <div className="fp-row" style={{ marginTop: 0, alignItems: 'flex-end' }}>
        <label className="fp-field" style={{ flex: 2 }}>Delivery address<input className="fp-input" value={address} onChange={(e) => { setAddress(e.target.value); setSaved(false) }} /></label>
        <label className="fp-field" style={{ flex: 1 }}>Weekly budget (£)<input className="fp-input" value={budget} onChange={(e) => { setBudget(e.target.value); setSaved(false) }} /></label>
        <label className="fp-field" style={{ flex: 2 }}>Team allergies (never bought, including "may contain")<input className="fp-input" value={allergies} onChange={(e) => { setAllergies(e.target.value); setSaved(false) }} /></label>
        <button className="fp-btn ghost" onClick={save}>{saved ? 'Saved' : 'Save'}</button>
      </div>
    </section>
  )
}

function LatestWeek({ s, m, subs }: { s: State; m: Week; subs: Subscription[] }) {
  const events = s.events.filter((e) => e.runId === m.runId)
  const included = m.includes ?? subs.filter((x) => isDue(x, m.index)).map((x) => x.name)
  return (
    <>
      <div className="fp-section"><h2>Latest delivery · {m.label}</h2><span className={`fp-pill ${m.status === 'bought' ? 'on' : m.status === 'running' ? 'run' : 'off'}`}>{m.status === 'bought' ? 'Bought' : m.status === 'running' ? 'Shopping' : m.status}</span></div>
      <section className="fp-panel">
        <div className="fp-row" style={{ marginTop: 0, justifyContent: 'space-between' }}>
          <span className="fp-muted">{included.length ? `Includes ${included.join(' + ')}` : ''}</span>
          {m.total !== undefined && <span>Paid <b>{gbp(m.total)}</b> incl. delivery{m.bestSingleShop && <> · <span className="fp-ok">saved {gbp(m.savings)}</span> vs {shopOf(m.bestSingleShop.shop)?.name ?? m.bestSingleShop.shop} + Viking ({gbp(m.bestSingleShop.total)})</>}</span>}
        </div>
        {m.orders ? (
          <div className="fp-week">
            {m.orders.map((o) => (
              <div key={o.shop} className="fp-order">
                <div className="fp-row" style={{ marginTop: 0, justifyContent: 'space-between' }}>
                  <img src={shopOf(o.shop)?.logo} alt={o.shopName} />
                  <span className={`fp-pill ${o.status === 'paid' ? 'on' : o.status === 'declined' ? 'off' : 'run'}`}>{o.status}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 750, marginTop: 8 }}>{gbp(o.total)}</div>
                <div className="fp-muted small">{o.items.length} items {gbp(o.subtotal)} + delivery {o.delivery ? gbp(o.delivery) : 'free'}</div>
                {o.declineReason && <div className="fp-bad small">{o.declineReason}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="log" style={{ marginTop: 12 }}>{events.slice(-12).map((e, i) => <div key={i}>{e.text}</div>)}{events.length === 0 && 'Starting…'}</div>
        )}
        {m.note && <div className="fp-note">🤖 {m.note}</div>}
      </section>
    </>
  )
}

function UnderTheHood({ s }: { s: State }) {
  const [msg, setMsg] = useState('')
  const current = s.weeks.at(-1)
  const events = current ? s.events.filter((e) => e.runId === current.runId) : []
  async function policyTest(kind: 'rogue' | 'overcharge') {
    setMsg(kind === 'rogue' ? 'Trying a £15 charge at GadgetMart (not an approved supplier)…' : 'A planned supplier tries to charge £5 more than the plan…')
    const r = await post(`/api/policy-test?kind=${kind}`)
    setMsg(r.approved ? 'Approved?!' : `Stripe declined ${r.merchant} ${gbp(r.amount)}: ${r.policyReason ?? r.reason}`)
  }
  return (
    <details className="fp-details">
      <summary>Under the hood: agent log, price comparison, card controls</summary>

      <section className="fp-panel">
        <h3 className="fp-h3">Agent log{current ? ` · ${current.label}` : ''}</h3>
        <div className="log" id="live-log">
          {events.length === 0 ? <div>Waiting for the agent…</div> : events.map((e, i) => (
            <div key={i}><span style={{ opacity: 0.5 }}>{new Date(e.t).toLocaleTimeString()}</span> <span style={{ color: e.kind === 'error' ? '#fca5a5' : e.kind === 'check' ? '#fde68a' : e.kind === 'pay' ? '#86efac' : e.kind === 'decision' ? '#93c5fd' : '#e7e5e4' }}>[{e.kind}]</span> {e.text}</div>
          ))}
        </div>
      </section>

      <section className="fp-panel">
        <h3 className="fp-h3">Company card (Stripe Issuing)</h3>
        <div className="fp-muted small">Visa ••{s.card?.last4 ?? '····'} · {gbp(s.card?.limitPence)} limit per charge (set on the card in Stripe) · approved shops only · each charge must match the agent&apos;s plan to the penny · {gbp(s.profile.budgetPence)} a week</div>
        <div className="fp-row">
          <button className="fp-btn sm ghost" onClick={() => policyTest('rogue')}>Test: unknown merchant</button>
          <button className="fp-btn sm ghost" onClick={() => policyTest('overcharge')}>Test: supplier overcharges £5</button>
          <button className="fp-btn sm ghost" onClick={() => post('/api/reset').then(() => setMsg('Demo reset'))}>Reset demo</button>
          <span className="small">{msg}</span>
        </div>
        <table className="fp-table" style={{ marginTop: 12 }}>
          <thead><tr><th>Merchant</th><th>Amount</th><th>Decision</th></tr></thead>
          <tbody>
            {s.auths.slice(0, 8).map((a) => (
              <tr key={a.id} title={a.id}><td>{a.merchant}</td><td>{gbp(a.amount)}</td><td className={a.approved ? 'fp-ok' : 'fp-bad'}>{a.approved ? 'approved' : 'declined'}{a.policyReason ? `: ${a.policyReason}` : a.reason && !a.approved ? `: ${a.reason}` : ''}</td></tr>
            ))}
            {s.auths.length === 0 && <tr><td colSpan={3} className="fp-muted">No card activity yet</td></tr>}
          </tbody>
        </table>
      </section>

      {[...s.weeks].reverse().map((m) => (
        <section className="fp-panel" key={m.runId}>
          <h3 className="fp-h3">{m.label} · {m.status}{m.total !== undefined ? ` · ${gbp(m.total)}` : ''}{m.savings ? ` · saved ${gbp(m.savings)}` : ''}</h3>
          {m.comparison && (
            <div className="fp-scroll">
              <table className="fp-table">
                <thead><tr><th>Item</th>{SHOPS.map((x) => <th key={x.slug} title={`${x.name} · ${x.kind}`} style={{ textAlign: 'center' }}><img src={x.logo} alt={x.name} style={{ height: 16, maxWidth: 60, objectFit: 'contain', display: 'block', margin: '0 auto 2px' }} /><div className="fp-muted" style={{ fontWeight: 400, fontSize: 10 }}>{x.orderable ? x.name : 'in-store only'}</div></th>)}</tr></thead>
                <tbody>
                  {m.comparison.map((c) => (
                    <tr key={c.lineId}>
                      <td>{c.line}</td>
                      {SHOPS.map((x) => {
                        const cell = c.perShop[x.slug]
                        const chosen = c.chosenShop === x.slug
                        // Price watch: same line, same product, last week
                        const prev = s.weeks.find((pm) => pm.index === m.index - 1)?.comparison?.find((pc) => pc.lineId === c.lineId)?.perShop[x.slug]
                        const change = cell && prev && prev.product === cell.product && prev.cost > 0 ? Math.round(((cell.cost - prev.cost) / prev.cost) * 100) : 0
                        return <td key={x.slug} title={cell?.product} style={chosen ? { background: 'rgba(15,157,88,0.12)', fontWeight: 700 } : undefined}>{cell ? gbp(cell.cost) : <span className="fp-muted">—</span>}{chosen ? ' ✓' : ''}{change !== 0 && <span className={change > 0 ? 'fp-bad' : 'fp-ok'} style={{ fontSize: 11 }}> {change > 0 ? '▲' : '▼'}{Math.abs(change)}%</span>}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {m.orders && (
            <div className="fp-week">
              {m.orders.map((o) => (
                <div key={o.shop} className="fp-order">
                  <b>{o.shopName}</b> · <span className={o.status === 'paid' ? 'fp-ok' : o.status === 'declined' ? 'fp-bad' : 'fp-muted'}>{o.status}</span>
                  <div className="fp-muted small">{gbp(o.subtotal)} + delivery {o.delivery ? gbp(o.delivery) : 'free'} = <b>{gbp(o.total)}</b></div>
                  <ul style={{ paddingLeft: 18, fontSize: 13, margin: '6px 0' }}>{o.items.map((i) => <li key={i.id}>{i.packs} × {i.name} @ {gbp(i.price)}</li>)}</ul>
                  {o.authorizationId && <div className="fp-muted" style={{ fontSize: 11 }}>Stripe {o.authorizationId}</div>}
                </div>
              ))}
            </div>
          )}
          {m.rejected && m.rejected.length > 0 && (
            <details style={{ marginTop: 10 }}><summary className="fp-muted small">Rejected by the rules ({m.rejected.length})</summary>
              <ul style={{ paddingLeft: 18, fontSize: 13 }}>{m.rejected.map((r) => <li key={r.id}>{r.name}: {r.reasons.join('; ')}</li>)}</ul>
            </details>
          )}
        </section>
      ))}
    </details>
  )
}
