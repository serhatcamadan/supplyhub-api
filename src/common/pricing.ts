export interface PriceTier {
  min_qty: number
  max_qty?: number | null
  price: number
}

export function getStartingPrice(tiers: PriceTier[]): number | null {
  if (!tiers || tiers.length === 0) return null
  return [...tiers].sort((a, b) => a.min_qty - b.min_qty)[0]?.price ?? null
}
