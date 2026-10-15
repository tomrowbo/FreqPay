// Quantity + button in one form. The quantity field is labelled per product so the agent's
// set_field/click refs stay unambiguous; submitting sets the basket quantity (idempotent).
export default async function AddButton({ id, name, inBasket }: { id: string; name: string; inBasket: number }) {
  return (
    <form action="/api/shop/basket" method="post" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <input type="hidden" name="action" value="set" />
      <input type="hidden" name="id" value={id} />
      <input name="qty" type="number" min={0} max={99} defaultValue={inBasket || 1} aria-label={`Quantity of ${name}`} style={{ width: 56, margin: 0 }} />
      <button className="btn" type="submit" aria-label={inBasket ? `Update ${name} (${inBasket} in basket)` : `Add ${name} to basket`}>{inBasket ? `Update (${inBasket} in basket)` : 'Add to basket'}</button>
    </form>
  )
}
