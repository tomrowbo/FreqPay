import type { Allergen, Category, Product } from './shops'

// Deterministic product policy. This is code, not the model's judgement: the agent must call
// check_items, and only products that passed here become offers the order planner can use.

export interface RestockLine {
  id: string
  name: string // "Fanta Orange cans"
  category: Category
  qty: number // in `unit`
  unit: string // "cans", "kg", "bags", "litres", "bottles", "packs", "bars", "rolls"
  brand?: string // set = this brand only (the team asked for it); unset = any brand, own-brand fine
}

export interface Profile {
  team: string
  budgetPence: number // weekly cap across all suppliers
  allergies: string[] // plain words, e.g. ["nuts"]
  address?: string // delivery address for every order
  lines: RestockLine[]
  confirmed?: boolean // the owner approved the preview basket; weekly runs only start after this
}

export interface CheckResult {
  pass: boolean
  lineId?: string
  reasons: string[]
}

// Owner words -> labelled allergens + ingredient words that indicate them.
const ALLERGY_MAP: Record<string, { allergens: Allergen[]; words: string[] }> = {
  nuts: {
    allergens: ['peanuts', 'tree nuts'],
    words: ['peanut', 'groundnut', 'almond', 'hazelnut', 'walnut', 'cashew', 'pistachio', 'pecan', 'macadamia', 'brazil nut', 'praline', 'marzipan', 'gianduja', 'nut'],
  },
  peanuts: { allergens: ['peanuts'], words: ['peanut', 'groundnut'] },
  milk: { allergens: ['milk'], words: ['milk', 'butter', 'whey', 'lactose', 'cream'] },
  gluten: { allergens: ['gluten'], words: ['wheat', 'barley', 'rye'] },
}

// Ingredient words that contain "nut" but are not nuts under UK allergen rules.
const NOT_NUTS = ['nutmeg', 'coconut', 'butternut', 'doughnut', 'donut', 'nutrition']

function ingredientHits(ingredients: string, words: string[]): string[] {
  let text = ingredients.toLowerCase()
  for (const safe of NOT_NUTS) text = text.split(safe).join(' ')
  return words.filter((w) => new RegExp(`\\b${w}s?\\b`).test(text))
}

export function allergyReasons(product: Product, allergies: string[]): string[] {
  const reasons: string[] = []
  for (const raw of allergies) {
    const key = raw.trim().toLowerCase()
    if (!key) continue
    const rule = ALLERGY_MAP[key] ?? { allergens: [], words: [key] }
    for (const a of rule.allergens) {
      if (product.contains.includes(a)) reasons.push(`contains ${a} (${key} allergy)`)
      else if (product.mayContain.includes(a)) reasons.push(`may contain ${a} (${key} allergy)`)
    }
    const hits = product.ingredients ? ingredientHits(product.ingredients, rule.words) : []
    if (hits.length && !reasons.some((r) => r.includes(`(${key} allergy)`))) reasons.push(`ingredients mention ${hits.join(', ')} (${key} allergy)`)
  }
  return reasons
}

export function checkProduct(product: Product, profile: Profile): CheckResult {
  const line = profile.lines.find((l) => l.category === product.category)
  if (!line) {
    const hint = product.category === 'milk-uht' ? ' (the list asks for fresh milk; this is UHT)' : ''
    return { pass: false, reasons: [`not on the restock list${hint}`] }
  }
  const reasons = allergyReasons(product, profile.allergies)
  if (line.brand && product.brand !== line.brand) reasons.unshift(`the list asks for ${line.brand} only, this is ${product.brand}`)
  return { pass: reasons.length === 0, lineId: line.id, reasons }
}
