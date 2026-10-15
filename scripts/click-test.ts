// Deterministic test of the agent's browser tools (no model): set quantities, add, update, and
// stale refs from an old snapshot.
import { openBrowser, readPage, clickRef, setField } from '../agent/browser'
const { browser, page } = await openBrowser()
const refFor = (snap: string, label: string) => snap.split('\n').find((l) => l.includes(label))?.match(/\[(e\d+)\]/)?.[1]
const basketLine = (snap: string) => snap.split('\n').find((l) => l.includes('Basket ('))

await page.goto('http://iceland.localhost:3000/')
await page.context().clearCookies()
await page.reload()
let snap = await readPage(page)
console.log('set qty ->', await setField(page, refFor(snap, 'Quantity of Fanta Orange')!, '8'))
console.log('add ->', await clickRef(page, refFor(snap, 'Add Fanta Orange to basket')!))
snap = await readPage(page)
console.log('after add:', basketLine(snap), '|', snap.split('\n').find((l) => l.includes('Fanta Orange (8 in basket)')) ? 'button shows 8 in basket' : 'MISSING update label')

// Two actions from ONE old snapshot (what the model does when it batches): the second must still
// hit the right element, and an element whose label changed must be refused.
const old = await readPage(page)
await setField(page, refFor(old, 'Quantity of Iceland Bananas')!, '6')
console.log('batched 1 ->', await clickRef(page, refFor(old, 'Add Iceland Bananas to basket')!))
await readPage(page) // the agent's click tool re-reads after every click
console.log('batched 2 ->', await setField(page, refFor(old, 'Quantity of Little Duck Toilet Tissue')!, '3'))
console.log('batched 3 ->', await clickRef(page, refFor(old, 'Add Little Duck Toilet Tissue to basket')!))
console.log('stale     ->', await clickRef(page, refFor(old, 'Add Iceland Bananas to basket')!)) // now "Update … (6 in basket)"
snap = await readPage(page)
console.log('final:', basketLine(snap))
await browser.close()
