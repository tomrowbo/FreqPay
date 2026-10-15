import http from 'http'
import { runWeek } from './run'

// The agent process: a demo clock that starts next week's run every DEMO_WEEK_MINUTES,
// plus POST /run for the dashboard's "Run next week now" button.
const APP = 'http://localhost:3000'
const WEEK_MS = Number(process.env.DEMO_WEEK_MINUTES ?? 5) * 60_000
let running = false
let nextRunAt = Date.now() + WEEK_MS

const post = (body: object) => fetch(`${APP}/api/agent/event`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {})

async function startRun() {
  if (running) return false
  // No buying until the owner has approved the preview basket.
  const ctx = await fetch(`${APP}/api/agent/context`).then((r) => r.json()).catch(() => null)
  if (!ctx?.profile?.confirmed) {
    // Restart the countdown so week 1 doesn't fire the moment the owner clicks "Looks right".
    nextRunAt = Date.now() + WEEK_MS
    await post({ runId: '', nextRunAt, running: false })
    return false
  }
  running = true
  nextRunAt = Date.now() + WEEK_MS
  const runId = `run_${Date.now().toString(36)}`
  await post({ runId, running: true, nextRunAt })
  const week = await fetch(`${APP}/api/agent/week`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'start', runId }) }).then((r) => r.json())
  const log = async (kind: string, text: string) => {
    console.log(`[${week.label}] ${kind}: ${text}`)
    await post({ runId, kind, text })
  }
  const t0 = Date.now()
  await log('step', `${week.label}: agent woke up`)
  runWeek(runId, log)
    .catch((e) => log('error', String(e)))
    .finally(async () => {
      await log('step', `Run finished in ${Math.round((Date.now() - t0) / 1000)}s`)
      running = false
      await post({ runId, running: false, nextRunAt })
    })
  return true
}

setInterval(() => { if (Date.now() >= nextRunAt && !running) void startRun() }, 1000)

http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/run') {
    const started = await startRun()
    res.writeHead(started ? 200 : 409, { 'content-type': 'application/json' })
    return res.end(JSON.stringify(started ? { started: true } : { message: running ? 'A run is already in progress' : 'Approve the restock list first' }))
  }
  res.writeHead(404).end()
}).listen(4100, () => {
  console.log(`agent listening on :4100, 1 week = ${WEEK_MS / 60000} min`)
  void post({ runId: '', nextRunAt, running: false })
})
