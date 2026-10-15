'use client'

import { useEffect, useState } from 'react'
import type { Store } from '@/lib/store'
import { SHOPS } from '@/lib/shops'
import Onboarding from './Onboarding'

const gbp = (p?: number) => (p === undefined ? '—' : `£${(p / 100).toFixed(2)}`)

export default function Dashboard() {
  const [s, setS] = useState<(Store & { card?: { last4: string; limitPence: number } }) | null>(null)
  const [now, setNow] = useState(Date.now())
  const [msg, setMsg] = useState('')
  const [draft, setDraft] = useState<{ budget: string; allergies: string; qtys: Record<string, string> } | null>(null)

  useEffect(() => {
    const load = () => fetch('/api/state').then((r) => r.json()).then(setS).catch(() => {})
    load()
    const a = setInterval(load, 1500)
    const b = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearInterval(a); clearInterval(b) }
  }, [])

  useEffect(() => {
    if (s && !draft) setDraft({ budget: (s.profile.budgetPence / 100).toFixed(2), allergies: s.profile.allergies.join(', '), qtys: Object.fromEntries(s.profile.lines.map((l) => [l.id, String(l.qty)])) })
  }, [s, draft])

  if (!s || !draft) return <div className="wrap">Loading…</div>

  const current = s.weeks.at(-1)
  const events = current ? s.events.filter((e) => e.runId === current.runId) : []
  const countdown = s.agent.nextRunAt ? Math.max(0, Math.round((s.agent.nextRunAt - now) / 1000)) : null
  const done = s.weeks.filter((m) => m.orders?.some((o) => o.status === 'paid'))
  const spent = done.reduce((n, m) => n + (m.orders ?? []).filter((o) => o.status === 'paid').reduce((x, o) => x + o.total, 0), 0)
  const saved = done.reduce((n, m) => n + (m.status === 'bought' ? m.savings ?? 0 : 0), 0)

  async function runNow() {
    setMsg('Starting…')
    const r = await fetch('/api/run', { method: 'POST' }).then((x) => x.json())
    setMsg(r.error ?? (r.started ? 'Agent started' : r.message ?? ''))
  }
  async function saveProfile() {
    await fetch('/api/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ budgetPence: Math.round(parseFloat(draft!.budget) * 100), allergies: draft!.allergies.split(',').map((x) => x.trim()).filter(Boolean), qtys: draft!.qtys }) })
    setMsg('Saved')
  }
  async function policyTest(kind: 'rogue' | 'overcharge') {
    setMsg(kind === 'rogue' ? 'Trying a £15 charge at GadgetMart (not an approved supplier)…' : 'A planned supplier tries to charge £5 more than the plan…')
    const r = await fetch(`/api/policy-test?kind=${kind}`, { method: 'POST' }).then((x) => x.json())
    setMsg(r.approved ? 'Approved?!' : `Stripe declined ${r.merchant} ${gbp(r.amount)}: ${r.policyReason ?? r.reason}`)
  }
  async function changeList() {
    await fetch('/api/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmed: false }) })
  }
  async function reset() {
    await fetch('/api/reset', { method: 'POST' })
    setMsg('Reset')
  }

  return (
    <div className="wrap">
      <h1 style={{ marginBottom: 0 }}>FreqPay</h1>
      <p className="muted" style={{ marginTop: 4 }}>An AI agent restocks the office every week: it checks Tesco, Sainsbury's, Asda, Ocado, Iceland, Aldi, Lidl, Costco and Viking, splits the order across up to 3 deliveries where that's cheaper after delivery charges, and pays each one with its own Stripe card, inside your rules. Sandbox: a week lasts a few minutes.</p>

      {done.length > 0 && (
        <div className="card" style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 14 }}>
          <div><div className="muted">Spent on restocks</div><strong style={{ fontSize: 22 }}>{gbp(spent)}</strong></div>
          <div><div className="muted">Saved vs one supermarket + Viking</div><strong style={{ fontSize: 22 }} className="ok">{gbp(saved)}</strong></div>
        </div>
      )}

      {!s.profile.confirmed ? <Onboarding onDone={() => { setDraft(null); setMsg('Restock list saved. The agent takes it from here.') }} /> : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Weekly demand · {s.profile.team}</h3>
          <table>
            <tbody>
              {s.profile.lines.map((l) => (
                <tr key={l.id}>
                  <td style={{ width: 70 }}><input value={draft.qtys[l.id] ?? ''} onChange={(e) => setDraft({ ...draft, qtys: { ...draft.qtys, [l.id]: e.target.value } })} style={{ margin: 0, width: 60 }} aria-label={`Quantity of ${l.name}`} /></td>
                  <td>{l.unit} · {l.name}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{l.brand ? `${l.brand} only` : 'any brand'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label>Weekly budget (£)</label><input value={draft.budget} onChange={(e) => setDraft({ ...draft, budget: e.target.value })} /></div>
            <div style={{ flex: 2 }}><label>Team allergies</label><input value={draft.allergies} onChange={(e) => setDraft({ ...draft, allergies: e.target.value })} /></div>
          </div>
          <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn secondary" onClick={saveProfile}>Save rules</button>
            <button className="btn" onClick={runNow} disabled={s.agent.running}>{s.agent.running ? 'Agent shopping…' : 'Run next week now'}</button>
            <button className="btn secondary" onClick={reset}>Reset demo</button>
            <button className="btn secondary" onClick={changeList}>Change the list</button>
          </p>
          <div className="muted">{countdown !== null && !s.agent.running ? `Next week starts automatically in ${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}` : ''} {msg}</div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Agent card (Stripe Issuing)</h3>
          <div className="muted">Visa ••{s.card?.last4 ?? '····'} · {gbp(s.card?.limitPence)} limit per charge (on the card in Stripe) · approved suppliers only · each charge must match the agent's plan to the penny · {gbp(s.profile.budgetPence)} a week</div>
          <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn secondary" onClick={() => policyTest('rogue')}>Test: unknown merchant</button>
            <button className="btn secondary" onClick={() => policyTest('overcharge')}>Test: supplier overcharges £5</button>
          </p>
          <table>
            <thead><tr><th>Merchant</th><th>Amount</th><th>Decision</th></tr></thead>
            <tbody>
              {s.auths.slice(0, 7).map((a) => (
                <tr key={a.id} title={a.id}>
                  <td>{a.merchant}</td><td>{gbp(a.amount)}</td>
                  <td className={a.approved ? 'ok' : 'bad'}>{a.approved ? 'approved' : 'declined'}{a.policyReason ? `: ${a.policyReason}` : a.reason && !a.approved ? `: ${a.reason}` : ''}</td>
                </tr>
              ))}
              {s.auths.length === 0 && <tr><td colSpan={3} className="muted">No card activity yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      )}

      <h2>Live: {current ? `${current.label} — ${current.status}` : 'no runs yet'}</h2>
      <div className="log" id="live-log">
        {events.length === 0 ? <div>Waiting for the agent…</div> : events.map((e, i) => (
          <div key={i}><span style={{ opacity: 0.5 }}>{new Date(e.t).toLocaleTimeString()}</span> <span style={{ color: e.kind === 'error' ? '#fca5a5' : e.kind === 'check' ? '#fde68a' : e.kind === 'pay' ? '#86efac' : e.kind === 'decision' ? '#93c5fd' : '#e7e5e4' }}>[{e.kind}]</span> {e.text}</div>
        ))}
      </div>

      <h2>Weeks</h2>
      {[...s.weeks].reverse().map((m) => (
        <div className="card" key={m.runId} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0 }}>{m.label} · <span className={m.status === 'bought' ? 'ok' : m.status === 'running' ? '' : 'bad'}>{m.status}</span></h3>
            {m.total !== undefined && (
              <div>
                Paid <strong>{gbp(m.total)}</strong>
                {m.bestSingleShop && <> · {SHOPS.find((x) => x.slug === m.bestSingleShop!.shop)?.name ?? m.bestSingleShop.shop} + Viking would be {gbp(m.bestSingleShop.total)} · <span className="ok">saved {gbp(m.savings)}</span></>}
              </div>
            )}
          </div>

          {m.comparison && (
            <table style={{ marginTop: 8, fontSize: 14 }}>
              <thead><tr><th>Line</th>{SHOPS.map((x) => <th key={x.slug} title={`${x.name} · ${x.kind}`} style={{ textAlign: 'center' }}><img src={x.logo} alt={x.name} style={{ height: 18, maxWidth: 64, objectFit: 'contain', display: 'block', margin: '0 auto 2px' }} /><div className="muted" style={{ fontWeight: 400, fontSize: 10 }}>{x.orderable ? x.name : 'in-store only'}</div></th>)}</tr></thead>
              <tbody>
                {m.comparison.map((c) => (
                  <tr key={c.lineId}>
                    <td>{c.line}</td>
                    {SHOPS.map((x) => {
                      const cell = c.perShop[x.slug]
                      const chosen = c.chosenShop === x.slug
                      // Price watch: same line, same product, last week
                      const prevWeek = s.weeks.find((pm) => pm.index === m.index - 1)
                      const prev = prevWeek?.comparison?.find((pc) => pc.lineId === c.lineId)?.perShop[x.slug]
                      const change = cell && prev && prev.product === cell.product && prev.cost > 0 ? Math.round(((cell.cost - prev.cost) / prev.cost) * 100) : 0
                      return <td key={x.slug} title={cell?.product} style={chosen ? { background: 'rgba(22,163,74,0.15)', fontWeight: 700 } : undefined}>{cell ? gbp(cell.cost) : <span className="muted">—</span>}{chosen ? ' ✓' : ''}{change !== 0 && <span className={change > 0 ? 'bad' : 'ok'} style={{ fontSize: 11 }}> {change > 0 ? '▲' : '▼'}{Math.abs(change)}%</span>}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {m.orders && (
            <div className="grid" style={{ marginTop: 10 }}>
              {m.orders.map((o) => (
                <div key={o.shop} className="card" style={{ background: 'transparent' }}>
                  <strong>{o.shopName}</strong> · <span className={o.status === 'paid' ? 'ok' : o.status === 'declined' ? 'bad' : 'muted'}>{o.status}</span>
                  <div className="muted" style={{ fontSize: 13 }}>{gbp(o.subtotal)} + delivery {o.delivery ? gbp(o.delivery) : 'free'} = <strong>{gbp(o.total)}</strong></div>
                  <ul style={{ paddingLeft: 18, fontSize: 13, margin: '6px 0' }}>{o.items.map((i) => <li key={i.id}>{i.packs} × {i.name} @ {gbp(i.price)}</li>)}</ul>
                  {o.declineReason && <div className="bad" style={{ fontSize: 13 }}>{o.declineReason}</div>}
                  {o.authorizationId && <div className="muted" style={{ fontSize: 11 }}>Stripe {o.authorizationId}</div>}
                </div>
              ))}
            </div>
          )}
          {m.note && <p style={{ fontSize: 14 }}>{m.note}</p>}
          {m.rejected && m.rejected.length > 0 && (
            <details><summary className="muted">Rejected by the rules ({m.rejected.length})</summary>
              <ul style={{ paddingLeft: 18, fontSize: 13 }}>{m.rejected.map((r) => <li key={r.id}>{r.name}: {r.reasons.join('; ')}</li>)}</ul>
            </details>
          )}
        </div>
      ))}
    </div>
  )
}
