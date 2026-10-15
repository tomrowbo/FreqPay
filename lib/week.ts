// Demo clock: week 1 = the week commencing START (a Monday); each run is the next week.
const START = new Date(Date.UTC(2026, 10, 2)) // Mon 2 Nov 2026
export function weekLabel(index: number) {
  const d = new Date(START)
  d.setUTCDate(START.getUTCDate() + 7 * (index - 1))
  return `w/c ${d.toLocaleString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`
}
