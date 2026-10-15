import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import type { Category } from './shops'
import { ORDERABLE, priceOf, SHOPS } from './shops'
import type { Profile } from './rules'
import { buildPlan, offersFor, type WeekPlan } from './plan'

// Onboarding: the office manager says what the office gets through each week (its weekly demand),
// in their own words; Claude turns that into a restock list made only of things our suppliers actually sell. The preview is then priced by
// the same deterministic planner the weekly agent uses.

// What the suppliers can supply, with the unit each line is counted in (must match packSize units).
export const STOCKABLE: Record<Exclude<Category, 'milk-uht' | 'stationery'>, { unit: string; brands: string[] }> = {
  'cola-zero': { unit: 'cans', brands: ['Coca-Cola'] },
  'fanta': { unit: 'cans', brands: ['Fanta'] },
  'water': { unit: 'bottles', brands: ['Highland Spring'] },
  'coffee-beans': { unit: 'kg', brands: ['Lavazza'] },
  'tea-bags': { unit: 'bags', brands: ['PG Tips', 'Tetley'] },
  'oat-barista': { unit: 'litres', brands: ['Oatly'] },
  'milk-fresh': { unit: '4-pint bottles', brands: [] },
  'sugar': { unit: 'kg', brands: ['Tate & Lyle', 'Silver Spoon'] },
  'bananas': { unit: 'bananas', brands: [] },
  'apples': { unit: 'apples', brands: [] },
  'easy-peelers': { unit: 'kg', brands: [] },
  'choc-biscuits': { unit: 'g', brands: ["McVitie's"] },
  'crisps': { unit: 'bags', brands: ['Walkers'] },
  'choc-bars': { unit: 'bars', brands: ['Nestlé'] },
  'toilet-roll': { unit: 'rolls', brands: ['Andrex', 'Cushelle'] },
  'hand-wash': { unit: 'litres', brands: ['Carex'] },
  'washing-up': { unit: 'litres', brands: ['Fairy'] },
  'dish-tabs': { unit: 'tablets', brands: ['Finish'] },
  'bin-bags': { unit: 'bags', brands: [] },
  'surface-spray': { unit: 'litres', brands: ['Dettol'] },
  'kitchen-roll': { unit: 'rolls', brands: ['Plenty'] },
  'hand-towels': { unit: 'sheets', brands: [] },
}
const categories = Object.keys(STOCKABLE) as [keyof typeof STOCKABLE, ...(keyof typeof STOCKABLE)[]]

const Draft = z.object({
  name: z.string().describe('Short name for this subscription, e.g. "Kitchen & pantry" or "Washrooms & cleaning"'),
  everyWeeks: z.union([z.literal(1), z.literal(2), z.literal(4)]).describe('How often it is delivered: 1 = every week (default), 2 = every two weeks / fortnightly, 4 = every four weeks / monthly'),
  team: z.string().describe('Short office name and headcount, e.g. "Rowbo Studio (60 people)"'),
  weeklyBudgetPounds: z.number().describe('Weekly cap in pounds. If not given, about £7.50 per person.'),
  allergies: z.array(z.string()).describe('Plain words, e.g. ["nuts"]. Empty if none mentioned.'),
  lines: z.array(z.object({
    category: z.enum(categories),
    name: z.string().describe('Short line name, e.g. "Fanta Orange cans"'),
    qty: z.number().describe('Quantity per delivery in the category unit (whole numbers except kg and litres)'),
    brand: z.string().nullable().describe('Only if they insisted on a brand; must be one of the category brands. null = any brand, own-brand fine.'),
  })),
  notCovered: z.array(z.string()).describe('Things they asked for that none of the categories cover'),
  assumptions: z.array(z.string()).describe('Quantities or rules you had to guess, in a few words each'),
})

const client = new Anthropic()

export async function draftProfile(prompt: string): Promise<{ profile: Profile; name: string; everyWeeks: 1 | 2 | 4; notCovered: string[]; assumptions: string[] }> {
  // Rough cheapest price per unit, so the model can size quantities to the budget.
  const perUnit = (c: string, brand?: string) => Math.min(...ORDERABLE.flatMap((s) => s.products.filter((p) => p.category === c && (!brand || p.brand === brand)).map((p) => priceOf(p, 1).price / p.packSize)))
  const price = (pence: number) => `£${(pence / 100).toFixed(2)}`
  const catalogue = Object.entries(STOCKABLE).map(([c, v]) => {
    const per = v.unit.replace(/s$/, '')
    const brands = v.brands.map((b) => `${b} from ${price(perUnit(c, b))}`).join(', ')
    return `- ${c}: counted in ${v.unit}; any brand from ${price(perUnit(c))} per ${per}${brands ? `; ${brands} per ${per}` : ''}`
  }).join('\n')
  const msg = await client.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    output_config: { effort: 'low', format: zodOutputFormat(Draft) },
    system: `You set up a weekly office restock list (kitchen, pantry and washrooms) from the office manager's description. Only use these categories (what our suppliers stock):\n${catalogue}\n\nThey may say how often (every week, every 2 weeks, monthly); quantities are per delivery. The quantities they give are their demand: use each one exactly, converted to the category unit (e.g. "3 kg chocolate biscuits" is 3000 g, "6,000 paper hand towels" is 6000 sheets). Only for things they name without a quantity, estimate a realistic weekly amount for the headcount (a working week is about 20 days) and list it in assumptions. Then check the whole list fits their weekly budget at these prices, plus delivery (the order goes to up to 3 suppliers, so allow about £15 in total): if it doesn't, trim only the quantities you estimated and say so in assumptions. Lock a brand only if they insisted on it. Anything else they ask for goes in notCovered.`,
    messages: [{ role: 'user', content: prompt }],
  })
  const d = msg.parsed_output
  if (!d) throw new Error('Could not read that description, try rephrasing it.')
  const profile: Profile = {
    team: d.team,
    budgetPence: Math.round(d.weeklyBudgetPounds * 100),
    allergies: d.allergies,
    // One line per category (line id = category): merge duplicates by adding their quantities.
    lines: Object.values(d.lines.reduce<Record<string, (typeof d.lines)[number]>>((acc, l) => {
      acc[l.category] = acc[l.category] ? { ...acc[l.category], qty: acc[l.category].qty + l.qty } : l
      return acc
    }, {})).map((l) => ({
      id: l.category,
      name: l.name,
      category: l.category,
      qty: Math.max(1, l.qty),
      unit: STOCKABLE[l.category].unit,
      ...(l.brand && STOCKABLE[l.category].brands.includes(l.brand) ? { brand: l.brand } : {}),
    })),
    confirmed: false,
  }
  return { profile, name: d.name, everyWeeks: d.everyWeeks, notCovered: d.notCovered, assumptions: d.assumptions }
}

// Claude sizes quantities from rough unit prices; pack sizes and delivery make the real plan
// differ. Scale quantities down (keeping at least 1 of each) until the real cheapest plan fits.
export function fitToBudget(profile: Profile, weekIndex: number): { profile: Profile; preview: WeekPlan; scaledBy?: number } {
  let p = profile
  let preview = previewPlan(p, weekIndex)
  let factor = 1
  for (let i = 0; i < 8 && preview.total > p.budgetPence; i++) {
    factor *= (p.budgetPence / preview.total) * 0.97
    p = { ...profile, lines: profile.lines.map((l) => ({ ...l, qty: Math.max(1, Math.round(l.qty * factor)) })) }
    preview = previewPlan(p, weekIndex)
  }
  return { profile: p, preview, scaledBy: factor < 1 ? factor : undefined }
}

// What a normal week would cost at this week's prices, using every product in the catalogue.
export function previewPlan(profile: Profile, weekIndex: number): WeekPlan {
  const allIds = SHOPS.flatMap((s) => s.products.map((p) => p.id))
  return buildPlan(profile, offersFor(allIds, profile, Math.max(1, weekIndex)))
}
