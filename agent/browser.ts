import { chromium, type Browser, type Page } from 'playwright'

// A visible Chrome window the agent drives. read_page gives the model a text snapshot plus
// numbered refs (e1, e2…) for every link/button/field. Refs are positions in a fixed query,
// so we never mutate the DOM (mutating it before React hydrates causes hydration mismatches).

const INTERACTIVE = 'a[href], button, input:not([type=hidden]), textarea, select'

// The model often sends several clicks in one turn, all using refs from one snapshot; after the
// first click the page changes and positions shift (an "Add" button becomes "Update (2 in basket)"). So ref
// numbers never repeat across snapshots: a ref says which snapshot it came from, and clickRef
// finds that element on the current page by its label, or refuses if it's gone.
let nextRef = 1
const snapshots: { url: string; first: number; labels: string[] }[] = []

function describe(sel: string) {
  return [...document.querySelectorAll(sel)].map((el) => {
    const tag = el.tagName.toLowerCase()
    const label = (el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.getAttribute('placeholder') || el.getAttribute('name') || '').trim().replace(/\s+/g, ' ').slice(0, 80)
    const href = tag === 'a' ? ` -> ${el.getAttribute('href')}` : ''
    return `${tag === 'a' ? 'link' : tag} "${label}"${href}`
  })
}

export async function openBrowser(): Promise<{ browser: Browser; page: Page }> {
  const headless = process.env.AGENT_HEADLESS === '1'
  const browser = await chromium.launch({ channel: 'chrome', headless, args: ['--window-size=1280,900', '--window-position=0,0'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 } })
  const page = await context.newPage()
  return { browser, page }
}

export async function readPage(page: Page, retry = true): Promise<string> {
  await page.waitForLoadState('domcontentloaded')
  const snap = await page.evaluate(([sel, fn]) => {
    const els = (new Function(`return (${fn})`)() as (s: string) => string[])(sel)
    const main = (document.querySelector('main') as HTMLElement | null)?.innerText ?? document.body.innerText
    return { title: document.title, text: main.replace(/\n{3,}/g, '\n\n').slice(0, 9000), els }
  }, [INTERACTIVE, describe.toString()] as const).catch(async (e: Error) => {
    // A navigation landed mid-read (e.g. a redirect finishing). Wait for it and read once more.
    if (!retry || !/context was destroyed|navigation/i.test(e.message)) throw e
    await page.waitForLoadState('load')
    return null
  })
  if (!snap) return readPage(page, false)
  const first = nextRef
  nextRef += snap.els.length
  snapshots.push({ url: page.url(), first, labels: snap.els })
  if (snapshots.length > 20) snapshots.shift()
  return `URL: ${page.url()}\nTITLE: ${snap.title}\n\nPAGE TEXT:\n${snap.text}\n\nINTERACTIVE ELEMENTS:\n${snap.els.map((e, i) => `[e${first + i}] ${e}`).join('\n')}`
}

// Find the element a ref points at on the current page, by its label in the snapshot it came from.
async function resolveRef(page: Page, ref: string) {
  const n = parseInt(ref.replace(/^e/, ''), 10)
  const snap = snapshots.find((s) => n >= s.first && n < s.first + s.labels.length)
  if (!snap) return { error: `No element ${ref} — call read_page to get fresh refs.` }
  const label = snap.labels[n - snap.first]
  const current = await page.evaluate(([sel, fn]) => (new Function(`return (${fn})`)() as (s: string) => string[])(sel), [INTERACTIVE, describe.toString()] as const)
  const idx = snap.url === page.url() ? current.indexOf(label) : -1
  if (idx < 0) return { error: `Did NOT use ${ref} (${label}): it's no longer on this page. Use the refs in the fresh snapshot below.` }
  return { el: page.locator(INTERACTIVE).nth(idx), label }
}

export async function setField(page: Page, ref: string, value: string): Promise<string> {
  const r = await resolveRef(page, ref)
  if ('error' in r) return r.error!
  await r.el.scrollIntoViewIfNeeded()
  await r.el.fill(value)
  return `Set ${ref} (${r.label}) to "${value}".`
}

export async function clickRef(page: Page, ref: string): Promise<string> {
  const r = await resolveRef(page, ref)
  if ('error' in r) return r.error!
  const el = r.el
  // Every clickable thing in the shops navigates (links, form submits). Wait for that navigation
  // to finish before returning, or the next click races the redirect and the basket cookie is lost.
  const navigated = page.waitForEvent('framenavigated', { timeout: 5000 }).catch(() => null)
  await el.scrollIntoViewIfNeeded()
  await el.click()
  await navigated
  await page.waitForLoadState('domcontentloaded')
  return `Clicked ${ref}. Now at ${page.url()}`
}
