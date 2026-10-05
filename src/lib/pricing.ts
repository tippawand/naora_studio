/** Tarif Kie.AI : 1 crédit ≈ 0,005 $ (1 000 crédits ≈ 5 $). */
export const USD_PER_CREDIT = 0.005;

export function usd(credits: number) {
  const v = credits * USD_PER_CREDIT;
  return `${v < 0.1 ? v.toFixed(3) : v.toFixed(2)} $`;
}
