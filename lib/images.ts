// One photo per restock category for the onboarding preview (Open Food Facts / Open Products Facts,
// CC BY-SA), with an emoji fallback where there's no good photo or one fails to load.
export const LINE_EMOJI: Record<string, string> = {
  'fanta': '🍊', 'cola-zero': '🥤', 'water': '💧', 'coffee-beans': '☕', 'tea-bags': '🫖', 'oat-barista': '🌾', 'milk-fresh': '🥛', 'sugar': '🍬',
  'bananas': '🍌', 'apples': '🍎', 'easy-peelers': '🍊', 'choc-biscuits': '🍪', 'crisps': '🥔', 'choc-bars': '🍫',
  'toilet-roll': '🧻', 'hand-wash': '🧼', 'washing-up': '🫧', 'dish-tabs': '🍽️', 'bin-bags': '🗑️', 'surface-spray': '🧴', 'kitchen-roll': '🧻', 'hand-towels': '🤲',
}

export const LINE_IMAGES: Record<string, { url: string; credit: string }> = {
  'sugar': { url: 'https://images.openfoodfacts.org/images/products/501/011/592/6404/front_en.12.400.jpg', credit: 'Open Food Facts, CC BY-SA, barcode 5010115926404' },
  'toilet-roll': { url: 'https://images.openproductsfacts.org/images/products/502/905/357/8200/front_en.3.400.jpg', credit: 'Open Products Facts, CC BY-SA, barcode 5029053578200' },
  'hand-wash': { url: 'https://images.openbeautyfacts.org/images/products/500/010/165/5579/front_en.5.400.jpg', credit: 'Open Beauty Facts, CC BY-SA, barcode 5000101655579' },
  'dish-tabs': { url: 'https://images.openproductsfacts.org/images/products/505/900/101/5297/front_en.3.400.jpg', credit: 'Open Products Facts, CC BY-SA, barcode 5059001015297' },
  'fanta': { url: 'https://images.openfoodfacts.org/images/products/500/011/255/2119/front_en.4.400.jpg', credit: 'Open Food Facts, CC BY-SA, barcode 5000112552119' },
  'cola-zero': { url: 'https://images.openfoodfacts.org/images/products/500/011/259/2054/front_en.3.400.jpg', credit: 'Open Food Facts, CC BY-SA, barcode 5000112592054' },
  'coffee-beans': { url: 'https://images.openfoodfacts.org/images/products/800/007/003/5188/front_en.29.400.jpg', credit: 'Open Food Facts, CC BY-SA, barcode 8000070035188' },
  'tea-bags': { url: 'https://images.openfoodfacts.org/images/products/872/060/803/9593/front_en.16.400.jpg', credit: 'Open Food Facts, CC BY-SA, barcode 8720608039593' },
  'oat-barista': { url: 'https://images.openfoodfacts.org/images/products/739/437/631/1482/front_en.3.400.jpg', credit: 'Open Food Facts, CC BY-SA, barcode 7394376311482' },
  'milk-fresh': { url: 'https://images.openfoodfacts.org/images/products/500/016/901/5322/front_en.8.400.jpg', credit: 'Open Food Facts, CC BY-SA, barcode 5000169015322' },
  'choc-biscuits': { url: 'https://images.openfoodfacts.org/images/products/500/016/802/8729/front_en.3.400.jpg', credit: 'Open Food Facts, CC BY-SA, barcode 5000168028729' },
  'crisps': { url: 'https://images.openfoodfacts.org/images/products/14113036/front_en.4.400.jpg', credit: 'Open Food Facts, CC BY-SA, barcode 14113036' },
  'choc-bars': { url: 'https://images.openfoodfacts.org/images/products/000/005/042/6942/front_en.7.400.jpg', credit: 'Open Food Facts, CC BY-SA, barcode 50426942' },
  'bananas': { url: 'https://images.openfoodfacts.org/images/products/01833317/front_en.15.400.jpg', credit: 'Open Food Facts, CC BY-SA, barcode 01833317' },
  'kitchen-roll': { url: 'https://images.openproductsfacts.org/images/products/031/467/016/4246/front_en.4.400.jpg', credit: 'Open Products Facts, CC BY-SA, barcode 0314670164246' },
  'water': { url: 'https://images.openfoodfacts.org/images/products/501/045/900/3496/front_en.3.400.jpg', credit: 'Open Food Facts, CC BY-SA, barcode 5010459003496' },
  'apples': { url: 'https://images.openfoodfacts.org/images/products/501/025/178/4432/front_en.21.400.jpg', credit: 'Open Food Facts, CC BY-SA, barcode 5010251784432' },
  'easy-peelers': { url: 'https://images.openfoodfacts.org/images/products/501/048/270/8207/front_en.3.400.jpg', credit: 'Open Food Facts, CC BY-SA, barcode 5010482708207' },
  'washing-up': { url: 'https://images.openproductsfacts.org/images/products/800/654/099/4511/front_en.7.400.jpg', credit: 'Open Products Facts, CC BY-SA, barcode 8006540994511' },
  'bin-bags': { url: 'https://images.openproductsfacts.org/images/products/935/669/300/0287/front_en.3.400.jpg', credit: 'Open Products Facts, CC BY-SA, barcode 9356693000287' },
  'surface-spray': { url: 'https://images.openfoodfacts.org/images/products/890/139/638/9569/front_en.3.400.jpg', credit: 'Open Food Facts, CC BY-SA, barcode 8901396389569' },
}
