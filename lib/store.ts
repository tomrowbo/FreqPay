import type { Subscription } from './subscriptions'
import fs from 'fs'
import path from 'path'
import type { Profile } from './rules'

// Single JSON file, written only by the Next.js server (the agent process talks to it over HTTP),
// so there is exactly one writer and no locking is needed.

export interface BoxItem { id: string; name: string; price: number; packs?: number }
export interface Rejection { id: string; name: string; reasons: string[] }

// One supplier order inside a week: what the plan said, and what happened at checkout.
export interface SupplierOrder {
  shop: string // slug
  shopName: string
  items: BoxItem[] // price = per pack, packs = how many
  subtotal: number
  delivery: number
  total: number // what the card should be charged: subtotal + delivery
  status: 'planned' | 'paid' | 'declined'
  orderId?: string
  authorizationId?: string
  declineReason?: string
}

// Price comparison shown to the owner: per restock line, the best eligible cost at each shop.
export interface Comparison { lineId: string; line: string; perShop: Record<string, { cost: number; product: string } | null>; chosenShop: string }

export interface Week {
  index: number // 1 = first demo week
  label: string // "w/c 2 Nov"
  runId: string
  status: 'running' | 'bought' | 'partial' | 'nothing-bought' | 'failed'
  orders?: SupplierOrder[]
  comparison?: Comparison[]
  total?: number // agent's plan, delivery included
  bestSingleShop?: { shop: string; total: number } // what one-shop ordering would cost
  savings?: number // bestSingleShop.total - total
  rejected?: Rejection[]
  note?: string
}

export interface RunEvent { runId: string; t: number; kind: 'step' | 'tool' | 'check' | 'decision' | 'pay' | 'error' | 'done'; text: string }

export interface Order {
  id: string
  shop: string
  weekIndex: number
  items: BoxItem[]
  subtotal: number
  delivery: number
  total: number
  status: 'approved' | 'declined'
  authorizationId?: string
  declineReason?: string
  createdAt: number
}

export interface AuthLog { id: string; amount: number; merchant: string; approved: boolean; reason: string; policyReason?: string; t: number }

export interface Store {
  profile: Profile
  subscriptions?: Subscription[] // none = the profile's list, every week
  weekIndex: number // last started demo week
  weeks: Week[]
  events: RunEvent[]
  orders: Order[]
  auths: AuthLog[]
  agent: { nextRunAt?: number; running?: boolean }
}

const FILE = path.join(process.cwd(), 'data', 'store.json')

export const DEFAULT_PROFILE: Profile = {
  team: 'Rowbo Studio (60 people)',
  budgetPence: 45000,
  allergies: ['nuts'],
  lines: [
    { id: 'cola-zero', name: 'Coca-Cola Zero cans', category: 'cola-zero', qty: 72, unit: 'cans', brand: 'Coca-Cola' },
    { id: 'fanta', name: 'Fanta Orange cans', category: 'fanta', qty: 48, unit: 'cans', brand: 'Fanta' },
    { id: 'water', name: 'Bottled water (500ml)', category: 'water', qty: 48, unit: 'bottles' },
    { id: 'coffee-beans', name: 'Coffee beans', category: 'coffee-beans', qty: 4, unit: 'kg' },
    { id: 'tea-bags', name: 'Tea bags', category: 'tea-bags', qty: 600, unit: 'bags' },
    { id: 'oat-barista', name: 'Oatly Barista', category: 'oat-barista', qty: 12, unit: 'litres', brand: 'Oatly' },
    { id: 'milk-fresh', name: 'Fresh semi-skimmed milk', category: 'milk-fresh', qty: 20, unit: '4-pint bottles' },
    { id: 'sugar', name: 'Sugar', category: 'sugar', qty: 2, unit: 'kg' },
    { id: 'bananas', name: 'Bananas', category: 'bananas', qty: 60, unit: 'bananas' },
    { id: 'apples', name: 'Apples', category: 'apples', qty: 60, unit: 'apples' },
    { id: 'easy-peelers', name: 'Easy peelers', category: 'easy-peelers', qty: 3, unit: 'kg' },
    { id: 'choc-biscuits', name: 'Chocolate biscuits', category: 'choc-biscuits', qty: 3000, unit: 'g' },
    { id: 'crisps', name: 'Crisps', category: 'crisps', qty: 80, unit: 'bags' },
    { id: 'choc-bars', name: 'Chocolate bars', category: 'choc-bars', qty: 48, unit: 'bars' },
    { id: 'toilet-roll', name: 'Toilet roll', category: 'toilet-roll', qty: 96, unit: 'rolls' },
    { id: 'hand-wash', name: 'Hand wash', category: 'hand-wash', qty: 3, unit: 'litres' },
    { id: 'washing-up', name: 'Washing-up liquid', category: 'washing-up', qty: 2, unit: 'litres' },
    { id: 'dish-tabs', name: 'Dishwasher tablets', category: 'dish-tabs', qty: 20, unit: 'tablets' },
    { id: 'bin-bags', name: 'Bin bags', category: 'bin-bags', qty: 60, unit: 'bags' },
    { id: 'surface-spray', name: 'Antibacterial surface spray', category: 'surface-spray', qty: 3, unit: 'litres' },
    { id: 'kitchen-roll', name: 'Kitchen roll', category: 'kitchen-roll', qty: 24, unit: 'rolls' },
    { id: 'hand-towels', name: 'Paper hand towels', category: 'hand-towels', qty: 6000, unit: 'sheets' },
  ],
}

export const DEFAULT_STORE: Store = {
  profile: DEFAULT_PROFILE,
  weekIndex: 0,
  weeks: [],
  events: [],
  orders: [],
  auths: [],
  agent: {},
}

export function readStore(): Store {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8')) as Store
  } catch {
    return structuredClone(DEFAULT_STORE)
  }
}

export function writeStore(s: Store) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  const tmp = FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2))
  fs.renameSync(tmp, FILE)
}

export function updateStore<T>(fn: (s: Store) => T): T {
  const s = readStore()
  const out = fn(s)
  writeStore(s)
  return out
}

// Demo clock: week 1 = the week commencing START (a Monday); each run is the next week.
const START = new Date(Date.UTC(2026, 10, 2)) // Mon 2 Nov 2026
export function weekLabel(index: number) {
  const d = new Date(START)
  d.setUTCDate(START.getUTCDate() + 7 * (index - 1))
  return `w/c ${d.toLocaleString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`
}
