/**
 * TypeScript adaptation of InvenTree BomItem.get_required_quantity.
 * Upstream: fa04bcc455597735e3e703148486ce9fdb2ee95b
 * src/backend/InvenTree/part/models.py, MIT, Copyright (c) 2017 InvenTree Developers.
 * Full license: docs/research/INVENTREE-LICENSE.txt.
 * Hotel adaptation: one base unit, no assembly piece count, integer thousandths.
 * Attrition is an additional procurement allowance, not a net-to-gross yield formula.
 */
function fraction(v: number): [bigint, bigint] {
  const [base, exp = "0"] = String(v).split("e");
  const decimals = base.split(".")[1]?.length ?? 0;
  const shift = Number(exp) - decimals;
  const n = BigInt(base.replace(".", ""));
  return shift >= 0
    ? [n * 10n ** BigInt(shift), 1n]
    : [n, 10n ** BigInt(-shift)];
}
function calculate(
  perPortion: number,
  portions: number,
  allowancePercent: number,
  setupQuantity: number,
  roundingMultiple: number,
  referencePortions = 1,
) {
  const [a, b] = fraction(perPortion),
    [c, d] = fraction(portions),
    [e, f] = fraction(allowancePercent),
    [g, h] = fraction(setupQuantity),
    [i, j] = fraction(roundingMultiple),
    [r, t] = fraction(referencePortions);
  const numerator = a * c * (100n * f + e) * h * t + g * b * d * 100n * f * r;
  const denominator = b * d * 100n * f * h * r;
  const steps = (numerator * j + denominator * i - 1n) / (denominator * i);
  const result = Number(steps * i) / Number(j);
  if (!Number.isSafeInteger(result))
    throw new Error("Reçete miktarı tam temel birim sınırını aşıyor.");
  return result;
}
export function requiredQuantity(
  perPortion: number,
  portions: number,
  allowancePercent = 0,
  setupQuantity = 0,
  roundingMultiple = 1,
): number {
  if (
    ![
      perPortion,
      portions,
      allowancePercent,
      setupQuantity,
      roundingMultiple,
    ].every(Number.isFinite) ||
    perPortion < 0 ||
    portions <= 0 ||
    allowancePercent < 0 ||
    allowancePercent > 100 ||
    setupQuantity < 0 ||
    roundingMultiple <= 0
  )
    throw new Error("Reçete miktarı geçersiz.");
  return calculate(
    perPortion,
    portions,
    allowancePercent,
    setupQuantity,
    roundingMultiple,
  );
}
export function recipeQuantity(
  batchQty: number,
  referencePortions: number,
  targetPortions: number,
  allowancePercent = 0,
) {
  if (
    ![batchQty, referencePortions, targetPortions].every(
      Number.isSafeInteger,
    ) ||
    batchQty < 0 ||
    referencePortions <= 0 ||
    targetPortions <= 0 ||
    !Number.isFinite(allowancePercent) ||
    allowancePercent < 0 ||
    allowancePercent > 100
  )
    throw new Error("Reçete değerleri geçersiz.");
  return calculate(
    batchQty,
    targetPortions,
    allowancePercent,
    0,
    1,
    referencePortions,
  );
}
