'use client'

import { useEffect, useState } from 'react'
import type { Store } from '@/lib/store'
import { SHOPS } from '@/lib/shops'

// Operator view for the demo (not linked from the app): the agent's live log, the per-shop price
// comparison with price watch, the card's authorizations and the guardrail tests.
const gbp = (p?: number) => (p === undefined ? '—' : `£${(p / 100).toFixed(2)}`)
const post = (url: string, body?: object) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json())
type State = Store & { card?: { last4: string; limitPence: number } }

export default function Ops() {
  const [s, setS] = useState<State | null>(null)
  useEffect(() => {
    const load = () => fetch('/api/state').then((r) => r.json()).then(setS).catch(() => {})
    load()
    const t = setInterval(load, 1500)
    return () => clearInterval(t)
  }, [])
  if (!s) return <div className="fp" />
  return <div className="fp"><div className="fp-wrap"><nav className="fp-nav"><div className="fp-logo"><img className="fp-mark-img" src="/brand/mark-light.svg" alt="" />FreqPay · operator view</div><a className="fp-link" href="/">Back to the app</a></nav><UnderTheHood s={s} /></div></div>
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
    <div>

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
    </div>
  )
}
