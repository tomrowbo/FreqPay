// Real UK retailers with real shelf prices, seen 15 Oct 2026 (docs/research/real-prices-*.md:
// trolley.co.uk and the retailers' own pages). The stores themselves are local mock sites for the
// demo: no real order is placed and no real retailer is charged.
//   Only shops that deliver to a London office are listed (scratchpad delivery research, 15 Oct 2026):
//   Supermarkets: Tesco, Sainsbury's, Asda, Ocado, Iceland, Waitrose, Morrisons, Co-op (own delivery, shelf prices)
//   Costco (online, members, non-perishables) and Viking (office supplier): cases, cleaning, washroom
//   Left out: Lidl (no delivery of any kind in the UK) and Aldi (its Deliveroo trial doesn't cover
//   London). Tesco, Sainsbury's and Asda are also on Deliveroo/Uber Eats, but at 19-45% over shelf
//   price, so their own delivery is always cheaper for an order this size.
// Prices in pence per pack, inc VAT. Promotions (Clubcard/Nectar prices, rollbacks ending, a quiet
// price creep) change prices week to week (see PROMOS) so the cheapest split changes.
// Allergens use UK-style labelling: `contains` = in the recipe, `mayContain` = cross-contamination.

import type { DeliveryTerms } from './optimise'

export type Allergen = 'peanuts' | 'tree nuts' | 'milk' | 'gluten' | 'soy' | 'egg' | 'sesame'

// What a product is, for matching against the restock list. Products whose category is on no
// list line (e.g. UHT milk, printer paper) are visible in the shop but can never be bought.
export type Category =
  | 'cola-zero' | 'fanta' | 'water' | 'coffee-beans' | 'tea-bags' | 'oat-barista' | 'milk-fresh' | 'milk-uht' | 'sugar'
  | 'bananas' | 'apples' | 'easy-peelers' | 'choc-biscuits' | 'crisps' | 'choc-bars'
  | 'toilet-roll' | 'hand-wash' | 'washing-up' | 'dish-tabs' | 'bin-bags' | 'surface-spray' | 'kitchen-roll' | 'hand-towels'
  | 'stationery'

export interface Product {
  id: string
  name: string
  brand: string
  category: Category
  packSize: number // units per pack, in the restock line's unit (cans, kg, bags, litres, rolls…)
  packLabel: string // what the shelf label says, e.g. "24 x 330ml"
  price: number // pence per pack, before promotions
  ingredients?: string
  contains: Allergen[]
  mayContain: Allergen[]
}

export interface Shop {
  slug: string
  name: string
  kind: string
  tagline: string
  logo: string // /logos/… (Wikimedia Commons copies, saved locally so the demo works offline)
  city: string
  country: string
  host: string
  accent: string
  orderable: boolean // false = in-store only: shown in the price comparison, never ordered from
  delivery: DeliveryTerms
  deliveryNote: string
  priceNote?: string
  products: Product[]
}

const P = (id: string, name: string, brand: string, category: Category, packSize: number, packLabel: string, price: number, contains: Allergen[] = [], mayContain: Allergen[] = [], ingredients?: string): Product =>
  ({ id, name, brand, category, packSize, packLabel, price, contains, mayContain, ingredients })

// Shared allergen labels
const BISCUIT: Allergen[] = ['gluten', 'milk']
const KITKAT: Allergen[] = ['gluten', 'milk']
const SNICKERS: Allergen[] = ['peanuts', 'milk', 'egg', 'soy']
const COOKIE_NUT: Allergen[] = ['gluten', 'milk', 'tree nuts']

export const SHOPS: Shop[] = [
  {
    slug: 'tesco', name: 'Tesco', kind: 'Supermarket', tagline: 'Every little helps',
    logo: '/logos/tesco.svg', city: 'Welwyn Garden City', country: 'GB', host: 'tesco.localhost', accent: '#00539F', orderable: true,
    delivery: { tiers: [{ from: 0, fee: 950 }, { from: 5000, fee: 450 }] },
    deliveryNote: 'Delivery £4.50 (mid-week slot, est.). Under £50: +£5 basket charge.',
    products: [
      P('ts-coke-zero-24', 'Coca-Cola Zero Sugar', 'Coca-Cola', 'cola-zero', 24, '24 x 330ml', 1200),
      P('ts-diet-cola-8', 'Tesco Diet Cola', 'Tesco', 'cola-zero', 8, '8 x 330ml', 260),
      P('ts-fanta-24', 'Fanta Orange', 'Fanta', 'fanta', 24, '24 x 330ml', 1100),
      P('ts-highland-12', 'Highland Spring Still Water', 'Highland Spring', 'water', 12, '12 x 500ml', 370),
      P('ts-water-12', 'Tesco Still Water', 'Tesco', 'water', 12, '12 x 500ml', 225),
      P('ts-lavazza-1kg', 'Lavazza Qualità Rossa Beans', 'Lavazza', 'coffee-beans', 1, '1kg', 2250),
      P('ts-beans-1kg', 'Tesco Espresso Coffee Beans', 'Tesco', 'coffee-beans', 1, '1kg', 1425),
      P('ts-pg-400', 'PG Tips Pyramid Tea Bags', 'PG Tips', 'tea-bags', 400, '400 bags', 1050),
      P('ts-tea-240', 'Tesco Original Tea Bags', 'Tesco', 'tea-bags', 240, '240 bags', 350),
      P('ts-oatly-1l', 'Oatly Barista Edition', 'Oatly', 'oat-barista', 1, '1L', 220),
      P('ts-oat-1l', 'Tesco Barista Oat Drink', 'Tesco', 'oat-barista', 1, '1L', 155),
      P('ts-milk-4pt', 'Tesco British Semi-Skimmed Milk', 'Tesco', 'milk-fresh', 1, '4 pints (2.272L)', 165, ['milk']),
      P('ts-uht-6', 'Tesco UHT Semi-Skimmed Milk', 'Tesco', 'milk-uht', 6, '6 x 1L', 615, ['milk']),
      P('ts-sugar-1kg', 'Silver Spoon Granulated Sugar', 'Silver Spoon', 'sugar', 1, '1kg', 109),
      P('ts-bananas-5', 'Tesco Bananas', 'Tesco', 'bananas', 5, '5 pack', 78),
      P('ts-apples-5', 'Tesco Gala Apples', 'Tesco', 'apples', 5, '5 pack', 180),
      P('ts-peelers-600', 'Tesco Easy Peelers', 'Tesco', 'easy-peelers', 0.6, '600g', 150),
      P('ts-mcv-266', "McVitie's Milk Chocolate Digestives", "McVitie's", 'choc-biscuits', 266, '266g', 225, BISCUIT),
      P('ts-dig-300', 'Tesco Milk Chocolate Digestives', 'Tesco', 'choc-biscuits', 300, '300g', 125, BISCUIT),
      P('ts-finest-cookies', 'Tesco Finest Chocolate Caramel & Hazelnut Cookies', 'Tesco', 'choc-biscuits', 200, '4 pack', 225, COOKIE_NUT, [], 'wheat flour, milk chocolate, caramel pieces, butter, sugar, hazelnuts, egg'),
      P('ts-walkers-20', 'Walkers Classic Variety Crisps', 'Walkers', 'crisps', 20, '20 x 25g', 485, ['milk']),
      P('ts-crisps-12', 'Tesco Variety Crisps', 'Tesco', 'crisps', 12, '12 x 25g', 205, ['milk']),
      P('ts-kitkat-4', 'KitKat 4 Finger', 'Nestlé', 'choc-bars', 4, '4 x 41.5g', 225, KITKAT),
      P('ts-snickers-8', 'Snickers', 'Mars', 'choc-bars', 8, '8 x 34.5g', 320, SNICKERS),
      P('ts-andrex-24', 'Andrex Gentle Clean Toilet Tissue', 'Andrex', 'toilet-roll', 24, '24 rolls', 1175),
      P('ts-loo-12', 'Tesco Quilted Toilet Tissue', 'Tesco', 'toilet-roll', 12, '12 long rolls', 600),
      P('ts-carex-1l', 'Carex Original Hand Wash Refill', 'Carex', 'hand-wash', 1, '1L', 350),
      P('ts-handwash-500', 'Tesco Essentials Hand Wash', 'Tesco', 'hand-wash', 0.5, '500ml', 45),
      P('ts-fairy-1450', 'Fairy Original Washing Up Liquid', 'Fairy', 'washing-up', 1.45, '1450ml', 395),
      P('ts-wul-500', 'Tesco Washing Up Liquid', 'Tesco', 'washing-up', 0.5, '500ml', 62),
      P('ts-finish-100', 'Finish Quantum Dishwasher Tablets', 'Finish', 'dish-tabs', 100, '100 tablets', 1700),
      P('ts-tabs-40', 'Tesco All in One Dishwasher Tablets', 'Tesco', 'dish-tabs', 40, '40 tablets', 370),
      P('ts-bins-30', 'Tesco Kitchen Bin Liners 50L', 'Tesco', 'bin-bags', 30, '30 x 50L', 225),
      P('ts-dettol-750', 'Dettol Antibacterial Surface Spray', 'Dettol', 'surface-spray', 0.75, '750ml', 270),
      P('ts-spray-750', 'Tesco Antibacterial Surface Spray', 'Tesco', 'surface-spray', 0.75, '750ml', 79),
      P('ts-plenty-4', 'Plenty Ultrasorb Kitchen Roll', 'Plenty', 'kitchen-roll', 4, '4 rolls', 825),
      P('ts-towel-4', 'Tesco Kitchen Towel', 'Tesco', 'kitchen-roll', 4, '4 rolls', 390),
    ],
  },
  {
    slug: 'sainsburys', name: "Sainsbury's", kind: 'Supermarket', tagline: 'Good food for all of us',
    logo: '/logos/sainsburys.svg', city: 'London', country: 'GB', host: 'sainsburys.localhost', accent: '#F06C00', orderable: true,
    delivery: { tiers: [{ from: 2500, fee: 750 }, { from: 5000, fee: 350 }] },
    deliveryNote: 'Minimum order £25. Under £50: £7.50 delivery. From £50: £3.50 (mid-week slot, est.).',
    products: [
      P('sb-coke-zero-24', 'Coca-Cola Zero Sugar', 'Coca-Cola', 'cola-zero', 24, '24 x 330ml', 1200),
      P('sb-coke-zero-18', 'Coca-Cola Zero Sugar', 'Coca-Cola', 'cola-zero', 18, '18 x 330ml', 950),
      P('sb-cola-zero-6', "Sainsbury's Cola Zero", "Sainsbury's", 'cola-zero', 6, '6 x 330ml', 200),
      P('sb-fanta-18', 'Fanta Orange', 'Fanta', 'fanta', 18, '18 x 330ml', 850),
      P('sb-water-12', "Sainsbury's Still Spring Water", "Sainsbury's", 'water', 12, '12 x 500ml', 250),
      P('sb-lavazza-1kg', 'Lavazza Qualità Rossa Beans', 'Lavazza', 'coffee-beans', 1, '1kg', 2250),
      P('sb-beans-1kg', "Sainsbury's Fairtrade Espresso Beans", "Sainsbury's", 'coffee-beans', 1, '1kg', 1425),
      P('sb-pg-240', 'PG Tips Pyramid Tea Bags', 'PG Tips', 'tea-bags', 240, '240 bags', 650),
      P('sb-tea-240', "Sainsbury's Red Label Tea Bags", "Sainsbury's", 'tea-bags', 240, '240 bags', 350),
      P('sb-oatly-1l', 'Oatly Barista Edition', 'Oatly', 'oat-barista', 1, '1L', 220),
      P('sb-oat-1l', "Sainsbury's Barista Oat", "Sainsbury's", 'oat-barista', 1, '1L', 155),
      P('sb-milk-4pt', "Sainsbury's British Semi-Skimmed Milk", "Sainsbury's", 'milk-fresh', 1, '4 pints (2.27L)', 165, ['milk']),
      P('sb-uht-6', "Sainsbury's UHT Semi-Skimmed Milk", "Sainsbury's", 'milk-uht', 6, '6 x 1L', 615, ['milk']),
      P('sb-sugar-1kg', "Sainsbury's White Granulated Sugar", "Sainsbury's", 'sugar', 1, '1kg', 109),
      P('sb-bananas-5', "Sainsbury's Bananas", "Sainsbury's", 'bananas', 5, '5 pack', 78),
      P('sb-apples-6', "Sainsbury's Royal Gala Apples", "Sainsbury's", 'apples', 6, '6 pack', 180),
      P('sb-peelers-600', "Sainsbury's Easy Peelers", "Sainsbury's", 'easy-peelers', 0.6, '600g', 150),
      P('sb-mcv-433', "McVitie's Milk Chocolate Digestives", "McVitie's", 'choc-biscuits', 433, '433g', 350, BISCUIT),
      P('sb-dig-300', "Sainsbury's Milk Chocolate Digestives", "Sainsbury's", 'choc-biscuits', 300, '300g', 125, BISCUIT),
      P('sb-ttd-cookies', "Sainsbury's Belgian Chocolate & Hazelnut Cookies, Taste the Difference", "Sainsbury's", 'choc-biscuits', 200, '200g', 295, COOKIE_NUT, [], 'wheat flour, Belgian milk chocolate, butter, sugar, hazelnuts (8%), egg'),
      P('sb-walkers-20', 'Walkers Classic Variety Crisps', 'Walkers', 'crisps', 20, '20 x 25g', 525, ['milk']),
      P('sb-crisps-22', "Sainsbury's Variety Crisps", "Sainsbury's", 'crisps', 22, '22 x 25g', 350, ['milk']),
      P('sb-kitkat-4', 'KitKat 4 Finger', 'Nestlé', 'choc-bars', 4, '4 x 41.5g', 200, KITKAT),
      P('sb-snickers-8', 'Snickers', 'Mars', 'choc-bars', 8, '8 x 34.5g', 320, SNICKERS),
      P('sb-andrex-24', 'Andrex Family Soft Toilet Tissue', 'Andrex', 'toilet-roll', 24, '24 rolls', 1175),
      P('sb-loo-24', "Sainsbury's Super Soft Quilted Toilet Tissue", "Sainsbury's", 'toilet-roll', 24, '24 rolls', 995),
      P('sb-carex-1l', 'Carex Original Hand Wash Refill', 'Carex', 'hand-wash', 1, '1L', 350),
      P('sb-handwash-500', "Sainsbury's Hand Wash", "Sainsbury's", 'hand-wash', 0.5, '500ml', 47),
      P('sb-fairy-1450', 'Fairy Original Washing Up Liquid', 'Fairy', 'washing-up', 1.45, '1450ml', 395),
      P('sb-wul-500', "Sainsbury's Washing Up Liquid", "Sainsbury's", 'washing-up', 0.5, '500ml', 62),
      P('sb-finish-100', 'Finish Quantum Dishwasher Tablets', 'Finish', 'dish-tabs', 100, '100 tablets', 1700),
      P('sb-tabs-60', "Sainsbury's All in One Dishwasher Tablets", "Sainsbury's", 'dish-tabs', 60, '60 tablets', 500),
      P('sb-bins-30', "Sainsbury's Kitchen Bin Liners 50L", "Sainsbury's", 'bin-bags', 30, '30 x 50L', 225),
      P('sb-dettol-750', 'Dettol Antibacterial Surface Spray', 'Dettol', 'surface-spray', 0.75, '750ml', 270),
      P('sb-spray-750', "Sainsbury's Antibacterial Spray", "Sainsbury's", 'surface-spray', 0.75, '750ml', 79),
      P('sb-plenty-4', 'Plenty Ultrasorb Kitchen Roll', 'Plenty', 'kitchen-roll', 4, '4 rolls', 825),
      P('sb-towel-4', "Sainsbury's Kitchen Towel", "Sainsbury's", 'kitchen-roll', 4, '4 rolls', 400),
    ],
  },
  {
    slug: 'asda', name: 'Asda', kind: 'Supermarket', tagline: 'Asda Price',
    logo: '/logos/asda.svg', city: 'Leeds', country: 'GB', host: 'asda.localhost', accent: '#5A9E1C', orderable: true,
    delivery: { tiers: [{ from: 0, fee: 850 }, { from: 4000, fee: 450 }] },
    deliveryNote: 'Delivery £4.50 (mid-week slot, est.). Under £40: +£4 basket charge.',
    products: [
      P('as-coke-zero-24', 'Coca-Cola Zero Sugar', 'Coca-Cola', 'cola-zero', 24, '24 x 330ml', 1200),
      P('as-fanta-18', 'Fanta Orange', 'Fanta', 'fanta', 18, '18 x 330ml', 700),
      P('as-highland-12', 'Highland Spring Still Water', 'Highland Spring', 'water', 12, '12 x 500ml', 300),
      P('as-water-12', 'ASDA Still Water', 'ASDA', 'water', 12, '12 x 500ml', 225),
      P('as-lavazza-1kg', 'Lavazza Qualità Rossa Beans', 'Lavazza', 'coffee-beans', 1, '1kg', 2250),
      P('as-beans-1kg', 'ASDA Italian Style Coffee Beans', 'ASDA', 'coffee-beans', 1, '1kg', 1098),
      P('as-pg-240', 'PG Tips Pyramid Tea Bags', 'PG Tips', 'tea-bags', 240, '240 bags', 480),
      P('as-tea-240', 'ASDA Everyday Tea Bags', 'ASDA', 'tea-bags', 240, '240 bags', 317),
      P('as-oatly-1l', 'Oatly Barista Edition', 'Oatly', 'oat-barista', 1, '1L', 220),
      P('as-oat-1l', 'Plant Based by ASDA Oat Barista', 'ASDA', 'oat-barista', 1, '1L', 155),
      P('as-milk-4pt', 'ASDA British Semi-Skimmed Milk', 'ASDA', 'milk-fresh', 1, '4 pints (2.272L)', 165, ['milk']),
      P('as-uht-6', 'ASDA Long Life Semi Skimmed Milk', 'ASDA', 'milk-uht', 6, '6 x 1L', 600, ['milk']),
      P('as-sugar-1kg', 'Silver Spoon Granulated Sugar', 'Silver Spoon', 'sugar', 1, '1kg', 109),
      P('as-bananas-6', 'ASDA Bananas', 'ASDA', 'bananas', 6, '6 pack', 94),
      P('as-apples-6', 'ASDA Royal Gala Apples', 'ASDA', 'apples', 6, '6 pack', 167),
      P('as-satsumas-600', 'ASDA Satsumas', 'ASDA', 'easy-peelers', 0.6, '600g', 118),
      P('as-mcv-433', "McVitie's Milk Chocolate Digestives", "McVitie's", 'choc-biscuits', 433, '433g', 200, BISCUIT),
      P('as-dig-300', 'ASDA Milk Chocolate Digestives', 'ASDA', 'choc-biscuits', 300, '300g', 125, ['gluten', 'milk', 'soy']),
      P('as-es-cookies', 'ASDA Extra Special Double Chocolate & Hazelnut Cookies', 'ASDA', 'choc-biscuits', 200, '8 x 25g', 197, COOKIE_NUT, ['peanuts'], 'wheat flour, milk chocolate, sugar, butter, hazelnuts, dark chocolate, egg'),
      P('as-walkers-20', 'Walkers Classic Variety Crisps', 'Walkers', 'crisps', 20, '20 x 25g', 400, ['milk']),
      P('as-crisps-24', 'ASDA Variety Crisps', 'ASDA', 'crisps', 24, '24 x 25g', 382, ['milk']),
      P('as-kitkat-8', 'KitKat 4 Finger', 'Nestlé', 'choc-bars', 8, '8 x 41.5g', 297, KITKAT),
      P('as-snickers-9', 'Snickers', 'Mars', 'choc-bars', 9, '9 x 35.5g', 298, SNICKERS),
      P('as-double-snap-8', 'ASDA Double Snap Chocolate Wafer Fingers', 'ASDA', 'choc-bars', 8, '8 x 21.5g', 155, ['gluten', 'milk'], ['peanuts', 'tree nuts']),
      P('as-andrex-24', 'Andrex Family Soft Toilet Tissue', 'Andrex', 'toilet-roll', 24, '24 rolls', 900),
      P('as-loo-24', 'ASDA Shades So Soft Toilet Tissue', 'ASDA', 'toilet-roll', 24, '24 rolls', 950),
      P('as-carex-1l', 'Carex Original Hand Wash Refill', 'Carex', 'hand-wash', 1, '1L', 347),
      P('as-handwash-500', 'ASDA Hand Wash', 'ASDA', 'hand-wash', 0.5, '500ml', 48),
      P('as-fairy-1450', 'Fairy Original Washing Up Liquid', 'Fairy', 'washing-up', 1.45, '1.45L', 400),
      P('as-wul-1l', 'ASDA Washing Up Liquid', 'ASDA', 'washing-up', 1, '1L', 132),
      P('as-finish-100', 'Finish Quantum Dishwasher Tablets', 'Finish', 'dish-tabs', 100, '100 tablets', 1500),
      P('as-tabs-50', 'ASDA Ultimate Dishwasher Tablets', 'ASDA', 'dish-tabs', 50, '50 tablets', 700),
      P('as-bins-20', 'ASDA Tall Kitchen Bin Liners 50L', 'ASDA', 'bin-bags', 20, '20 x 50L', 400),
      P('as-dettol-500', 'Dettol Antibacterial Surface Spray', 'Dettol', 'surface-spray', 0.5, '500ml', 174),
      P('as-spray-750', 'ASDA Antibacterial Surface Spray', 'ASDA', 'surface-spray', 0.75, '750ml', 88),
      P('as-plenty-4', 'Plenty Original Kitchen Roll', 'Plenty', 'kitchen-roll', 4, '4 rolls', 824),
      P('as-towel-4', 'ASDA Shades Kitchen Roll', 'ASDA', 'kitchen-roll', 4, '4 rolls', 370),
    ],
  },
  {
    slug: 'ocado', name: 'Ocado', kind: 'Online supermarket', tagline: 'M&S food and the big brands, delivered',
    logo: '/logos/ocado.svg', city: 'Hatfield', country: 'GB', host: 'ocado.localhost', accent: '#4F1F68', orderable: true,
    delivery: { tiers: [{ from: 4000, fee: 550 }, { from: 6000, fee: 450 }, { from: 7500, fee: 350 }] },
    deliveryNote: 'Minimum order £40. Delivery £3.50 (mid-week slot, est.) + small-order charge: £2 up to £60, £1 up to £75.',
    products: [
      P('oc-coke-zero-24', 'Coca-Cola Zero Sugar', 'Coca-Cola', 'cola-zero', 24, '24 x 330ml', 1250),
      P('oc-coke-zero-30', 'Coca-Cola Zero Sugar', 'Coca-Cola', 'cola-zero', 30, '30 x 330ml', 1675),
      P('oc-fanta-24', 'Fanta Orange', 'Fanta', 'fanta', 24, '24 x 330ml', 850),
      P('oc-highland-12', 'Highland Spring Still Water', 'Highland Spring', 'water', 12, '12 x 500ml', 370),
      P('oc-water-12', 'M&S Still Water', 'M&S', 'water', 12, '12 x 500ml', 260),
      P('oc-lavazza-1kg', 'Lavazza Qualità Rossa Beans', 'Lavazza', 'coffee-beans', 1, '1kg', 2250),
      P('oc-beans-454', 'M&S Italian Style Coffee Beans', 'M&S', 'coffee-beans', 0.454, '454g', 700),
      P('oc-pg-240', 'PG Tips Pyramid Tea Bags', 'PG Tips', 'tea-bags', 240, '240 bags', 500),
      P('oc-pg-400', 'PG Tips Pyramid Tea Bags', 'PG Tips', 'tea-bags', 400, '400 bags', 1099),
      P('oc-oatly-1l', 'Oatly Barista Edition', 'Oatly', 'oat-barista', 1, '1L', 220),
      P('oc-oat-1l', 'M&S Oat Barista', 'M&S', 'oat-barista', 1, '1L', 220),
      P('oc-milk-4pt', 'Ocado British Semi-Skimmed Milk', 'Ocado', 'milk-fresh', 1, '4 pints (2.272L)', 165, ['milk']),
      P('oc-uht-6', 'Candia UHT Semi-Skimmed Milk', 'Candia', 'milk-uht', 6, '6 x 1L', 835, ['milk']),
      P('oc-sugar-1kg', 'Ocado Granulated Sugar', 'Ocado', 'sugar', 1, '1kg', 120),
      P('oc-bananas-5', 'Ocado Bananas', 'Ocado', 'bananas', 5, '5 pack', 95),
      P('oc-apples-6', 'Ocado Royal Gala Apples', 'Ocado', 'apples', 6, '6 pack', 135),
      P('oc-peelers-600', 'Ocado Easy Peelers', 'Ocado', 'easy-peelers', 0.6, '600g', 150),
      P('oc-mcv-433', "McVitie's Milk Chocolate Digestives", "McVitie's", 'choc-biscuits', 433, '433g', 250, BISCUIT),
      P('oc-dig-300', 'M&S Milk Chocolate Digestives', 'M&S', 'choc-biscuits', 300, '300g', 125, BISCUIT),
      P('oc-ms-cookies', 'M&S Chocolate Chunk & Hazelnut Cookies', 'M&S', 'choc-biscuits', 200, '8 cookies', 270, COOKIE_NUT, ['peanuts'], 'wheat flour, milk chocolate chunks, butter, sugar, roasted hazelnuts, egg'),
      P('oc-walkers-20', 'Walkers Classic Variety Crisps', 'Walkers', 'crisps', 20, '20 x 25g', 525, ['milk']),
      P('oc-crisps-6', 'Ocado Variety Crisps', 'Ocado', 'crisps', 6, '6 x 25g', 110, ['milk']),
      P('oc-kitkat-4', 'KitKat 4 Finger', 'Nestlé', 'choc-bars', 4, '4 x 41.5g', 195, KITKAT),
      P('oc-snickers-8', 'Snickers', 'Mars', 'choc-bars', 8, '8 x 34.5g', 300, SNICKERS),
      P('oc-ms-take4', 'M&S Take 4 Finger Wafer Bars', 'M&S', 'choc-bars', 4, '4 x 45g', 300, ['gluten', 'milk'], ['peanuts', 'tree nuts']),
      P('oc-andrex-24', 'Andrex Complete Clean Toilet Tissue', 'Andrex', 'toilet-roll', 24, '24 rolls', 1400),
      P('oc-loo-16', 'M&S Quilted Toilet Tissue', 'M&S', 'toilet-roll', 16, '16 rolls', 700),
      P('oc-carex-1l', 'Carex Original Hand Wash Refill', 'Carex', 'hand-wash', 1, '1L', 350),
      P('oc-handwash-250', 'M&S Hand Wash', 'M&S', 'hand-wash', 0.25, '250ml', 75),
      P('oc-fairy-1450', 'Fairy Original Washing Up Liquid', 'Fairy', 'washing-up', 1.45, '1450ml', 400),
      P('oc-wul-500', 'M&S Washing Up Liquid', 'M&S', 'washing-up', 0.5, '500ml', 65),
      P('oc-finish-115', 'Finish Ultimate Dishwasher Tablets', 'Finish', 'dish-tabs', 115, '115 tablets', 1600),
      P('oc-tabs-90', 'Ocado All in One Dishwasher Tablets', 'Ocado', 'dish-tabs', 90, '90 tablets', 800),
      P('oc-bins-15', 'Ocado Tall Kitchen Bin Liners 50L', 'Ocado', 'bin-bags', 15, '15 x 50L', 320),
      P('oc-dettol-750', 'Dettol Antibacterial Surface Spray', 'Dettol', 'surface-spray', 0.75, '750ml', 240),
      P('oc-spray-750', 'Ocado Antibacterial Surface Spray', 'Ocado', 'surface-spray', 0.75, '750ml', 90),
      P('oc-plenty-4', 'Plenty Ultrasorb Kitchen Roll', 'Plenty', 'kitchen-roll', 4, '4 rolls', 825),
      P('oc-towel-4', 'Ocado Kitchen Towel', 'Ocado', 'kitchen-roll', 4, '4 rolls', 425),
    ],
  },
  {
    slug: 'iceland', name: 'Iceland', kind: 'Supermarket', tagline: 'Power of Frozen',
    logo: '/logos/iceland.svg', city: 'Deeside', country: 'GB', host: 'iceland.localhost', accent: '#D2212E', orderable: true,
    delivery: { tiers: [{ from: 2500, fee: 300 }, { from: 4000, fee: 0 }] },
    deliveryNote: 'Minimum order £25. Free delivery from £40; £3 small-basket charge below (est.).',
    products: [
      P('ic-coke-zero-24', 'Coca-Cola Zero Sugar', 'Coca-Cola', 'cola-zero', 24, '24 x 330ml', 1200),
      P('ic-pepsi-max-24', 'Pepsi Max', 'Pepsi', 'cola-zero', 24, '24 x 330ml', 1250),
      P('ic-fanta-24', 'Fanta Orange', 'Fanta', 'fanta', 24, '24 x 330ml', 1150),
      P('ic-white-rock-24', 'White Rock Still Water', 'White Rock', 'water', 24, '24 x 500ml', 395),
      P('ic-pg-400', 'PG Tips Pyramid Tea Bags', 'PG Tips', 'tea-bags', 400, '400 bags', 850),
      P('ic-easytea-240', 'Easytea Tea Bags', 'Easytea', 'tea-bags', 240, '240 bags', 300),
      P('ic-alpro-oat-1l', 'Alpro Oat Drink', 'Alpro', 'oat-barista', 1, '1L', 210),
      P('ic-viva-uht-1l', 'Viva UHT Semi-Skimmed Milk', 'Viva', 'milk-uht', 1, '1L', 130, ['milk']),
      P('ic-sugar-1kg', 'Whitworths Granulated Sugar', 'Whitworths', 'sugar', 1, '1kg', 120),
      P('ic-bananas-5', 'Iceland Bananas', 'Iceland', 'bananas', 5, '5 pack', 100),
      P('ic-apples-6', 'Royal Gala Apples', 'Iceland', 'apples', 6, '6 pack', 150),
      P('ic-peelers-600', 'Easy Peelers', 'Iceland', 'easy-peelers', 0.6, '600g', 155),
      P('ic-mcv-266', "McVitie's Milk Chocolate Digestives", "McVitie's", 'choc-biscuits', 266, '266g', 225, BISCUIT),
      P('ic-walkers-20', 'Walkers Classic Variety Crisps', 'Walkers', 'crisps', 20, '20 x 25g', 485, ['milk']),
      P('ic-walkers-60', 'Walkers Classic Variety Crisps', 'Walkers', 'crisps', 60, '60 x 25g', 1200, ['milk']),
      P('ic-kitkat-8', 'KitKat 4 Finger', 'Nestlé', 'choc-bars', 8, '8 x 41.5g', 275, KITKAT),
      P('ic-snickers-8', 'Snickers', 'Mars', 'choc-bars', 8, '8 x 41.7g', 275, SNICKERS),
      P('ic-blue-riband-12', 'Blue Riband Chocolate Wafers', 'Nestlé', 'choc-bars', 12, '12 pack', 175, ['gluten', 'milk'], ['tree nuts']),
      P('ic-andrex-24', 'Andrex Toilet Tissue', 'Andrex', 'toilet-roll', 24, '24 rolls', 1000),
      P('ic-little-duck-24', 'Little Duck Toilet Tissue', 'Little Duck', 'toilet-roll', 24, '24 rolls', 700),
      P('ic-astonish-600', 'Astonish Hand Wash', 'Astonish', 'hand-wash', 0.6, '600ml', 100),
      P('ic-fairy-1450', 'Fairy Original Washing Up Liquid', 'Fairy', 'washing-up', 1.45, '1450ml', 400),
      P('ic-wul-740', 'HOME Washing Up Liquid', 'Iceland', 'washing-up', 0.74, '740ml', 100),
      P('ic-fairy-tabs-56', 'Fairy Platinum Dishwasher Tablets', 'Fairy', 'dish-tabs', 56, '56 tablets', 800),
      P('ic-bins-50', 'HOME Bin Bags 50L', 'Iceland', 'bin-bags', 50, '50 x 50L', 350),
      P('ic-spray-750', 'HOME Antibacterial Surface Spray', 'Iceland', 'surface-spray', 0.75, '750ml', 100),
      P('ic-plenty-8', 'Plenty Kitchen Roll', 'Plenty', 'kitchen-roll', 8, '8 rolls', 1200),
      P('ic-little-duck-roll-8', 'Little Duck Kitchen Roll', 'Little Duck', 'kitchen-roll', 8, '8 rolls', 475),
    ],
  },
  {
    slug: 'waitrose', name: 'Waitrose', kind: 'Supermarket', tagline: 'Waitrose & Partners',
    logo: '/logos/waitrose.svg', city: 'London', country: 'GB', host: 'waitrose.localhost', accent: '#5C8A1E', orderable: true,
    delivery: { tiers: [{ from: 4000, fee: 400 }] },
    deliveryNote: 'Waitrose.com home delivery: £40 minimum grocery order (below that the order is refused here), £4 for a fixed 1-hour slot (£2 for a flexible 4-hour slot; Delivery Pass £8/month waives it). No free-delivery threshold confirmed. Deliveroo/Uber Eats not used: Which? (Oct 2025) found Waitrose prices about 25% / 33% higher on those apps.',
    priceNote: 'Shelf prices from trolley.co.uk Waitrose listings and waitrose.com product pages, checked 15 Oct 2026. Waitrose sells mostly small packs, so quantities are bought as several packs.',
    products: [
      P('wr-coke-zero-24', 'Coca-Cola Zero Sugar Cans', 'Coca-Cola', 'cola-zero', 24, '24 x 330ml', 1000),
      P('wr-fanta-8', 'Fanta Orange Cans', 'Fanta', 'fanta', 8, '8 x 330ml', 410),
      P('wr-volvic-6', 'Volvic Still Mineral Water', 'Volvic', 'water', 6, '6 x 1.5L', 530),
      P('wr-water-4x2l', 'Essential Waitrose Still Natural Mineral Water', 'Essential Waitrose', 'water', 4, '4 x 2L', 210),
      P('wr-lavazza-1kg', 'Lavazza Qualità Rossa Coffee Beans', 'Lavazza', 'coffee-beans', 1, '1kg', 2250),
      P('wr-lofbergs-1kg', 'Löfbergs Brazil Single Origin Coffee Beans', 'Löfbergs', 'coffee-beans', 1, '1kg', 1550),
      P('wr-pg-240', 'PG Tips Original Tea Bags', 'PG Tips', 'tea-bags', 240, '240 bags', 680),
      P('wr-tetley-240', 'Tetley Original Tea Bags', 'Tetley', 'tea-bags', 240, '240 bags', 749),
      P('wr-tea-160', 'Essential Waitrose Original Blend Tea Bags', 'Essential Waitrose', 'tea-bags', 160, '160 bags', 280),
      P('wr-oatly-1l', 'Oatly Barista Edition Chilled Oat Drink', 'Oatly', 'oat-barista', 1, '1L', 230),
      P('wr-oato-1l', 'Oato Barista Fresh Oat Drink', 'Oato', 'oat-barista', 1, '1L', 185),
      P('wr-milk-4pt', 'Essential Waitrose British Free Range Semi-Skimmed Milk', 'Essential Waitrose', 'milk-fresh', 1, '4 pints (2.272L)', 175, ['milk']),
      P('wr-uht-1l', 'Essential Waitrose Long Life Semi-Skimmed Milk', 'Essential Waitrose', 'milk-uht', 1, '1L', 130, ['milk']),
      P('wr-sugar-1kg', 'Tate & Lyle Granulated Sugar', 'Tate & Lyle', 'sugar', 1, '1kg', 135),
      P('wr-bananas-5', 'Essential Waitrose Fairtrade Bananas', 'Essential Waitrose', 'bananas', 5, '5 pack', 100),
      P('wr-apples-6', 'Waitrose Royal Gala Apples', 'Waitrose', 'apples', 6, '6 pack', 180),
      P('wr-peelers-600', 'Waitrose Queen Easy Peelers', 'Waitrose', 'easy-peelers', 0.6, '600g', 260),
      P('wr-mcv-266', "McVitie's Milk Chocolate Digestives", "McVitie's", 'choc-biscuits', 266, '266g', 225, BISCUIT),
      P('wr-dig-300', 'Essential Waitrose Milk Chocolate Digestive Biscuits', 'Essential Waitrose', 'choc-biscuits', 300, '300g', 125, ['gluten', 'milk', 'soy']),
      P('wr-cookies-200', 'Waitrose Belgian Chocolate & Hazelnut All Butter Cookies', 'Waitrose', 'choc-biscuits', 200, '8 cookies (200g)', 270, COOKIE_NUT),
      P('wr-walkers-6', 'Walkers Classic Variety Crisps', 'Walkers', 'crisps', 6, '6 x 25g', 175, ['milk']),
      P('wr-kitkat-4f-4', 'KitKat 4 Finger Milk Chocolate Bar Multipack', 'Nestlé', 'choc-bars', 4, '4 x 41.5g', 290, KITKAT),
      P('wr-kitkat-2f-12', 'KitKat 2 Finger Milk Chocolate Biscuit Bar Multipack', 'Nestlé', 'choc-bars', 12, '12 x 2 finger', 350, KITKAT),
      P('wr-andrex-9', 'Andrex Supreme Quilts Toilet Tissue', 'Andrex', 'toilet-roll', 9, '9 rolls', 710),
      P('wr-andrex-12', 'Andrex Complete Clean Toilet Tissue Mega Rolls', 'Andrex', 'toilet-roll', 12, '12 mega rolls', 833),
      P('wr-loo-9', 'Waitrose Quilted Toilet Tissue Coconut', 'Waitrose', 'toilet-roll', 9, '9 rolls', 550),
      P('wr-carex-250', 'Carex Advanced Care Shea Butter Antibacterial Hand Wash', 'Carex', 'hand-wash', 0.25, '250ml', 200),
      P('wr-handwash-250', 'Essential Waitrose Antibacterial Moisture Hand Wash', 'Essential Waitrose', 'hand-wash', 0.25, '250ml', 80),
      P('wr-fairy-640', 'Fairy Max Power Lemon Washing Up Liquid', 'Fairy', 'washing-up', 0.64, '640ml', 450),
      P('wr-wul-500', 'Essential Waitrose Washing Up Liquid Original', 'Essential Waitrose', 'washing-up', 0.5, '500ml', 80),
      P('wr-finish-55', 'Finish Ultimate All in One Dishwasher Tablets', 'Finish', 'dish-tabs', 55, '55 tablets', 1000),
      P('wr-bins-10', 'Beast Super Strong Drawstring Bin Bags 70L', 'Beast', 'bin-bags', 10, '10 x 70L', 395),
      P('wr-dettol-750', 'Dettol Antibacterial Surface Cleansing Spray', 'Dettol', 'surface-spray', 0.75, '750ml', 330),
      P('wr-plenty-2', 'Plenty Max The Extra Big One Kitchen Towel', 'Plenty', 'kitchen-roll', 2, '2 rolls', 515),
      P('wr-towel-4', 'Essential Waitrose Kitchen Rolls', 'Essential Waitrose', 'kitchen-roll', 4, '4 x 100 sheets', 430),
    ],
  },
  {
    slug: 'morrisons', name: 'Morrisons', kind: 'Supermarket', tagline: 'Morrisons online delivery',
    logo: '/logos/morrisons.svg', city: 'Bradford', country: 'GB', host: 'morrisons.localhost', accent: '#00624B', orderable: true,
    delivery: { tiers: [{ from: 2500, fee: 800 }, { from: 4000, fee: 500 }] },
    deliveryNote: 'Morrisons home delivery at shelf prices: £25 minimum order, 1-hour slot fee about £1.50-£7 (est. £5 for a typical weekday slot), plus a £3 small-order charge under £40. No free-delivery threshold without Delivery Pass.',
    priceNote: 'Prices from groceries.morrisons.com product pages, checked 15 Oct 2026.',
    products: [
      P('mo-coke-zero-30', 'Coca-Cola Zero Sugar', 'Coca-Cola', 'cola-zero', 30, '30 x 330ml', 1425),
      P('mo-fanta-18', 'Fanta Orange', 'Fanta', 'fanta', 18, '18 x 330ml', 700),
      P('mo-highland-12', 'Highland Spring Still Water', 'Highland Spring', 'water', 12, '12 x 500ml', 360),
      P('mo-water-12', 'Morrisons Yorkshire Vale Still Water', 'Morrisons', 'water', 12, '12 x 500ml', 225),
      P('mo-lavazza-1kg', 'Lavazza Qualità Rossa Beans', 'Lavazza', 'coffee-beans', 1, '1kg', 2250),
      P('mo-beans-1kg', 'Morrisons Espresso Blend Coffee Beans', 'Morrisons', 'coffee-beans', 1, '1kg', 1425),
      P('mo-pg-240', 'PG Tips Original Tea Bags', 'PG Tips', 'tea-bags', 240, '240 bags', 625),
      P('mo-tetley-240', 'Tetley Original Tea Bags', 'Tetley', 'tea-bags', 240, '240 bags', 425),
      P('mo-tea-240', 'Morrisons Everyday Tea Bags', 'Morrisons', 'tea-bags', 240, '240 bags', 325),
      P('mo-oatly-1l', 'Oatly Barista Edition Oat Drink', 'Oatly', 'oat-barista', 1, '1L', 220),
      P('mo-oat-1l', 'Morrisons Long Life Oat Barista Drink', 'Morrisons', 'oat-barista', 1, '1L', 155),
      P('mo-milk-4pt', 'Morrisons British Semi Skimmed Milk', 'Morrisons', 'milk-fresh', 1, '4 pints (2.272L)', 165, ['milk']),
      P('mo-uht-6', 'Morrisons Long Life Semi Skimmed Milk', 'Morrisons', 'milk-uht', 6, '6 x 1L', 600, ['milk']),
      P('mo-sugar-1kg', 'Tate & Lyle Granulated Sugar', 'Tate & Lyle', 'sugar', 1, '1kg', 109),
      P('mo-bananas-5', 'Fyffes Bananas', 'Fyffes', 'bananas', 5, '5 pack', 78),
      P('mo-apples-6', 'Morrisons Royal Gala Apples', 'Morrisons', 'apples', 6, '6 pack', 180),
      P('mo-satsumas-600', 'Morrisons Sweetclems Easy Peelers', 'Morrisons', 'easy-peelers', 0.6, '600g', 150),
      P('mo-mcv-532', "McVitie's Milk Chocolate Digestives Twin Pack", "McVitie's", 'choc-biscuits', 532, '2 x 266g', 350, ['gluten', 'milk', 'soy']),
      P('mo-dig-300', 'Morrisons Milk Chocolate Digestives', 'Morrisons', 'choc-biscuits', 300, '300g', 120, ['gluten', 'milk', 'soy']),
      P('mo-pecan-200', 'Morrisons The Best Spiced Maple & Pecan Cookies', 'Morrisons', 'choc-biscuits', 200, '200g', 250, ['gluten', 'milk', 'soy', 'tree nuts']),
      P('mo-walkers-20', 'Walkers Classic Variety Crisps', 'Walkers', 'crisps', 20, '20 x 25g', 525, ['milk'], ['gluten', 'soy']),
      P('mo-crisps-20', 'Morrisons Variety Mix Crisps', 'Morrisons', 'crisps', 20, '20 x 25g', 330, ['milk']),
      P('mo-kitkat-8', 'KitKat 4 Finger', 'Nestlé', 'choc-bars', 8, '8 x 41.5g', 350, KITKAT),
      P('mo-snickers-8', 'Snickers Peanut Multipack', 'Mars', 'choc-bars', 8, '8 x 34.5g', 320, SNICKERS, ['tree nuts']),
      P('mo-andrex-24', 'Andrex Family Soft Toilet Tissue', 'Andrex', 'toilet-roll', 24, '24 rolls', 1185),
      P('mo-loo-9', 'Morrisons White Toilet Tissue', 'Morrisons', 'toilet-roll', 9, '9 rolls', 300),
      P('mo-carex-500', 'Carex Complete Original Hand Wash', 'Carex', 'hand-wash', 0.5, '500ml', 190),
      P('mo-handwash-500', 'Morrisons Essentials White Blossom Hand Wash', 'Morrisons Savers', 'hand-wash', 0.5, '500ml', 44),
      P('mo-fairy-1450', 'Fairy Original Washing Up Liquid', 'Fairy', 'washing-up', 1.45, '1.45L', 400),
      P('mo-wul-450', 'Morrisons Original Washing Up Liquid', 'Morrisons', 'washing-up', 0.45, '450ml', 55),
      P('mo-finish-100', 'Finish Quantum Dishwasher Tablets', 'Finish', 'dish-tabs', 100, '100 tablets', 1700),
      P('mo-tabs-40', 'Morrisons Ultimate All In One Dishwasher Tablets', 'Morrisons', 'dish-tabs', 40, '40 tablets', 510),
      P('mo-bins-20', 'Morrisons 50L Tie Top Refuse Sacks', 'Morrisons', 'bin-bags', 20, '20 x 50L', 275),
      P('mo-dettol-750', 'Dettol Antibacterial Surface Cleanser Spray', 'Dettol', 'surface-spray', 0.75, '750ml', 270),
      P('mo-spray-750', 'Morrisons Citrus Anti-Bacterial Multi-Purpose Cleaner', 'Morrisons', 'surface-spray', 0.75, '750ml', 90),
      P('mo-plenty-4', 'Plenty Ultrasorb Kitchen Roll', 'Plenty', 'kitchen-roll', 4, '4 rolls', 825),
      P('mo-towel-2', 'Morrisons Tough Towels Kitchen Roll', 'Morrisons', 'kitchen-roll', 2, '2 rolls', 280),
    ],
  },
  {
    slug: 'coop', name: 'Co-op', kind: 'Supermarket', tagline: 'Co-op Food: local stores, delivered',
    logo: '/logos/coop.svg', city: 'London', country: 'GB', host: 'coop.localhost', accent: '#00B1E7', orderable: true,
    delivery: { tiers: [{ from: 1500, fee: 300 }, { from: 2500, fee: 0 }] },
    deliveryNote: 'Co-op store delivery: £15 minimum order; £3 delivery under £25, free from £25 (terms from coop.co.uk shop-and-deliver / home-delivery pages as reported in search snippets, 15 Oct 2026; not confirmed for W2 or for a £100-£250 basket). Limited own-delivery range: no hand wash, bin bags, UHT milk or granulated sugar listed.',
    priceNote: 'Co-op online shelf prices as listed on trolley.co.uk, 15 Oct 2026 (assumed equal to Co-op own-delivery prices; app channels such as Deliveroo not used). Convenience-store pricing, mostly dearer than the big supermarkets.',
    products: [
      P('cp-coke-zero-18', 'Coca-Cola Zero Sugar', 'Coca-Cola', 'cola-zero', 18, '18 x 330ml', 995),
      P('cp-highland-6', 'Highland Spring Still Spring Water', 'Highland Spring', 'water', 6, '6 x 1.5L', 530),
      P('cp-water-12', 'Nestle Pure Life Still Spring Water', 'Nestle', 'water', 12, '12 x 500ml', 295),
      P('cp-lavazza-250', 'Lavazza Qualita Rossa Coffee', 'Lavazza', 'coffee-beans', 0.25, '250g', 750),
      P('cp-pg-160', 'PG Tips Original Tea Bags', 'PG Tips', 'tea-bags', 160, '160 bags', 625),
      P('cp-tetley-240', 'Tetley Original Tea Bags', 'Tetley', 'tea-bags', 240, '240 bags', 635),
      P('cp-tetley-160', 'Tetley Original Tea Bags', 'Tetley', 'tea-bags', 160, '160 bags', 350),
      P('cp-oatly-1l', 'Oatly Barista Edition Oat Drink', 'Oatly', 'oat-barista', 1, '1L', 270, ['gluten']),
      P('cp-oat-1l', 'Co-op Plant Based Oat Drink', 'Co-op', 'oat-barista', 1, '1L', 190, ['gluten']),
      P('cp-milk-4pt', 'Co-op Fresh Semi-skimmed Milk', 'Co-op', 'milk-fresh', 1, '4 pints (2.27L)', 165, ['milk']),
      P('cp-bananas-5', 'Co-op Fairtrade Organic Bananas', 'Co-op', 'bananas', 5, '5 pack', 180),
      P('cp-apples-6', 'Co-op Royal Gala Apples', 'Co-op', 'apples', 6, '6 pack', 159),
      P('cp-peelers-600', 'Co-op Easy Peelers', 'Co-op', 'easy-peelers', 0.6, '600g', 175),
      P('cp-mcv-266', "McVitie's Milk Chocolate Digestives", "McVitie's", 'choc-biscuits', 266, '266g', 280, BISCUIT),
      P('cp-walkers-14', 'Walkers Ready Salted Multipack Crisps', 'Walkers', 'crisps', 14, '14 x 25g', 375),
      P('cp-kitkat-4', 'KitKat 4 Finger', 'Nestlé', 'choc-bars', 4, '4 x 41.5g', 290, KITKAT),
      P('cp-snickers-4', 'Snickers', 'Mars', 'choc-bars', 4, '4 x 40g', 245, SNICKERS),
      P('cp-andrex-9', 'Andrex Classic Clean Toilet Tissue', 'Andrex', 'toilet-roll', 9, '9 rolls', 675),
      P('cp-loo-4', 'Co-op Super Soft White Bathroom Tissue', 'Co-op', 'toilet-roll', 4, '4 rolls', 225),
      P('cp-fairy-545', 'Fairy Max Power Washing Up Liquid', 'Fairy', 'washing-up', 0.545, '545ml', 385),
      P('cp-wul-450', 'Co-op Lemon Washing Up Liquid', 'Co-op', 'washing-up', 0.45, '450ml', 56),
      P('cp-finish-32', 'Finish Quantum Dishwasher Tablets Lemon', 'Finish', 'dish-tabs', 32, '32 tablets', 935),
      P('cp-finish-55', 'Finish Ultimate All In One Dishwasher Tablets', 'Finish', 'dish-tabs', 55, '55 tablets', 1525),
      P('cp-dettol-750', 'Dettol Antibacterial Surface Cleansing Spray', 'Dettol', 'surface-spray', 0.75, '750ml', 320),
      P('cp-plenty-2', 'Plenty White Kitchen Roll', 'Plenty', 'kitchen-roll', 2, '2 rolls', 565),
      P('cp-regina-2', 'Regina XXL Absorb Kitchen Roll', 'Regina', 'kitchen-roll', 2, '2 rolls', 525),
    ],
  },
  {
    slug: 'costco', name: 'Costco', kind: 'Wholesale (online)', tagline: 'Wholesale prices, delivered',
    logo: '/logos/costco.svg', city: 'Watford', country: 'GB', host: 'costco.localhost', accent: '#E31837', orderable: true,
    delivery: { tiers: [{ from: 0, fee: 599 }] },
    deliveryNote: 'Delivery £5.99 per order, no minimum. Members only; non-perishables, about 2 working days.',
    products: [
      P('co-fanta-24', 'Fanta Orange', 'Fanta', 'fanta', 24, '24 x 330ml', 1549),
      P('co-lavazza-1kg', 'Lavazza Qualità Rossa Beans', 'Lavazza', 'coffee-beans', 1, '1kg', 1689),
      P('co-pg-840', 'PG Tips Pyramid Tea Bags', 'PG Tips', 'tea-bags', 840, '4 x 210 bags', 2049),
      P('co-tetley-1100', 'Tetley One Cup Tea Bags', 'Tetley', 'tea-bags', 1100, '1100 bags', 1949),
      P('co-plenish-8', 'Plenish Organic Oat Drink', 'Plenish', 'oat-barista', 8, '8 x 1L', 1149),
      P('co-sugar-5kg', 'Tate & Lyle Caster Sugar', 'Tate & Lyle', 'sugar', 5, '5kg', 729),
      P('co-mcv-6', "McVitie's Milk Chocolate Digestives", "McVitie's", 'choc-biscuits', 1596, '6 x 266g', 919, BISCUIT),
      P('co-andrex-48', 'Andrex Ultimate Quilts Toilet Tissue', 'Andrex', 'toilet-roll', 48, '3 x 16 rolls', 2499),
      P('co-cushelle-32', 'Cushelle Quilted Toilet Tissue', 'Cushelle', 'toilet-roll', 32, '4 x 8 rolls', 2349),
      P('co-kirkland-loo-40', 'Kirkland Signature 3-Ply Toilet Tissue', 'Kirkland Signature', 'toilet-roll', 40, '40 rolls', 2649),
      P('co-carex-5l', 'Carex Professional Hand Wash', 'Carex', 'hand-wash', 5, '5L', 1399),
      P('co-carex-3l', 'Carex Hand Wash Refill', 'Carex', 'hand-wash', 3, '3 x 1L', 799),
      P('co-fairy-6', 'Fairy Original Washing Up Liquid', 'Fairy', 'washing-up', 5.4, '6 x 900ml', 1459),
      P('co-finish-200', 'Finish Quantum Dishwasher Tablets', 'Finish', 'dish-tabs', 200, '2 x 100 tablets', 1699),
      P('co-bins-100', 'Banquet Tall Kitchen Bin Liners', 'Banquet', 'bin-bags', 100, '100 bags', 1099),
      P('co-dettol-4', 'Dettol Antibacterial Surface Spray', 'Dettol', 'surface-spray', 3, '4 x 750ml', 889),
      P('co-kirkland-roll-12', 'Kirkland Signature Kitchen Towel', 'Kirkland Signature', 'kitchen-roll', 12, '12 rolls', 2799),
    ],
  },
  {
    slug: 'viking', name: 'Viking', kind: 'Office supplier', tagline: 'Office supplies, delivered next day',
    logo: '/logos/viking.png', city: 'Leicester', country: 'GB', host: 'viking.localhost', accent: '#E4002C', orderable: true,
    delivery: { tiers: [{ from: 0, fee: 714 }, { from: 10680, fee: 0 }] },
    deliveryNote: 'No minimum order. Delivery £5.95 + VAT (£7.14), free from £89 + VAT (£106.80). Next working day.',
    products: [
      P('vk-coke-zero-24', 'Coca-Cola Zero Sugar Cans', 'Coca-Cola', 'cola-zero', 24, '24 x 330ml', 2075),
      P('vk-fanta-24', 'Fanta Orange Cans', 'Fanta', 'fanta', 24, '24 x 330ml', 2075),
      P('vk-radnor-24', 'Radnor Hills Still Water', 'Radnor Hills', 'water', 24, '24 x 500ml', 1055),
      P('vk-lavazza-1kg', 'Lavazza Crema e Aroma Beans', 'Lavazza', 'coffee-beans', 1, '1kg', 2329),
      P('vk-pg-1100', 'PG Tips One Cup Tea Bags', 'PG Tips', 'tea-bags', 1100, '1100 bags', 2939),
      P('vk-tetley-1100', 'Tetley One Cup Tea Bags', 'Tetley', 'tea-bags', 1100, '1100 bags', 2839),
      P('vk-uht-12', 'Lakeland Semi-Skimmed UHT Milk', 'Lakeland', 'milk-uht', 12, '12 x 1L', 2099, ['milk']),
      P('vk-sugar-sticks', 'Tate & Lyle White Sugar Sticks', 'Tate & Lyle', 'sugar', 2.5, '1000 x 2.5g', 1589),
      P('vk-mcv-80', "McVitie's Milk Chocolate Digestives Minis", "McVitie's", 'choc-biscuits', 80, '80g pouch', 347, BISCUIT),
      P('vk-walkers-32', 'Walkers Cheese & Onion Crisps', 'Walkers', 'crisps', 32, '32 x 32.5g', 3215, ['milk']),
      P('vk-kitkat-24', 'KitKat 4 Finger', 'Nestlé', 'choc-bars', 24, '24 x 41.5g', 3599, KITKAT),
      P('vk-cushelle-32', 'Cushelle 2-Ply Toilet Tissue', 'Cushelle', 'toilet-roll', 32, '32 rolls', 2039),
      P('vk-andrex-24', 'Andrex Complete Clean Toilet Tissue', 'Andrex', 'toilet-roll', 24, '24 rolls', 1859),
      P('vk-loo-48', 'Viking 2-Ply Toilet Tissue', 'Viking', 'toilet-roll', 48, '48 rolls', 2159),
      P('vk-carex-5l', 'Carex Hand Wash Refill', 'Carex', 'hand-wash', 5, '5L', 1439),
      P('vk-fairy-5l', 'Fairy Professional Washing Up Liquid', 'Fairy', 'washing-up', 5, '5L', 2099),
      P('vk-finish-125', 'Finish Quantum Powerball Dishwasher Tablets', 'Finish', 'dish-tabs', 125, '125 tablets', 3359),
      P('vk-bins-100', 'Paclan Bin Liners 35L', 'Paclan', 'bin-bags', 100, '100 x 35L', 431),
      P('vk-roll-24', 'Bliss 2-Ply Kitchen Roll', 'Bliss', 'kitchen-roll', 24, '24 rolls', 1679),
      P('vk-towels-c', 'Essentials C-Fold Hand Towels', 'Essentials', 'hand-towels', 2880, '12 x 240 sheets', 2759),
      P('vk-towels-z', 'Essentials Z-Fold Hand Towels', 'Essentials', 'hand-towels', 3000, '12 x 250 sheets', 2855),
      P('vk-a4-paper', 'Viking Everyday A4 Copier Paper', 'Viking', 'stationery', 2500, '5 reams', 2274),
    ],
  },
]

// Week-by-week promotions, cycling. Real mechanics from the research: Clubcard and Nectar member
// prices, Iceland's 3-for-£27 multibuy, an Asda rollback ending, Ocado's half-price Finish ending,
// and the cheap toilet roll the plan buys every week creeping up quietly (no badge): the kind of
// rise on a repeat item a person reordering wouldn't notice (docs/research/retail-margin-tactics.md).
type Promo = Record<string, { price: number; label: string }>
export const PROMOS: Promo[] = [
  {}, // week 1: shelf prices as seen 15 Oct 2026
  {
    'ic-coke-zero-24': { price: 900, label: 'Multibuy: 3 for £27' },
    'ts-fanta-24': { price: 850, label: 'Clubcard Price' },
    'ts-andrex-24': { price: 900, label: 'Clubcard Price' },
    'sb-andrex-24': { price: 900, label: 'Nectar Price' },
    'ic-little-duck-24': { price: 750, label: '' },
  },
  {
    'sb-coke-zero-18': { price: 750, label: 'Nectar Price' },
    'as-fanta-18': { price: 848, label: 'Rollback ended' },
    'oc-finish-115': { price: 3200, label: 'Offer ended' },
    'ic-little-duck-24': { price: 825, label: '' },
  },
]

export function priceOf(product: Product, weekIndex: number): { price: number; was?: number; label?: string } {
  const promo = PROMOS[(Math.max(weekIndex, 1) - 1) % PROMOS.length][product.id]
  return promo ? { price: promo.price, was: product.price, label: promo.label } : { price: product.price }
}

// Stock-outs, on the same 3-week cycle as PROMOS: the shop page shows "Out of stock", the agent's
// check rejects it with that reason, and the planner buys the line elsewhere.
export const OUT_OF_STOCK: string[][] = [
  [], // week 1
  ['as-oatly-1l'], // week 2: Asda has run out of Oatly Barista
  ['ic-little-duck-24'], // week 3: Iceland has run out of its 24-roll toilet tissue
]
export const inStock = (productId: string, weekIndex: number) => !OUT_OF_STOCK[(Math.max(weekIndex, 1) - 1) % OUT_OF_STOCK.length].includes(productId)

export const ORDERABLE = SHOPS.filter((s) => s.orderable)
export const shopBySlug = (slug: string) => SHOPS.find((s) => s.slug === slug)
// tesco.localhost locally, tesco.freqpay.app on the public demo: the first label picks the shop.
export const shopByHost = (host: string) => {
  const h = host.split(':')[0]
  return SHOPS.find((s) => h === s.host || (h.includes('.') && h.split('.')[0] === s.slug && !h.endsWith('.localhost')))
}
export const shopByName = (name: string) => SHOPS.find((s) => s.name === name)
export const shopUrl = (shop: Shop) => `http://${shop.host}:3000`

export function findProduct(id: string): { shop: Shop; product: Product } | undefined {
  for (const shop of SHOPS) {
    const product = shop.products.find((p) => p.id === id)
    if (product) return { shop, product }
  }
}

export const formatGBP = (pence: number) => `£${(pence / 100).toFixed(2)}`
