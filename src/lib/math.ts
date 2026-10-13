import { UserFacingError } from "./errors";
/** Integer multiply/divide with half-up rounding; no floating-point intermediate. */
export function mulDivRound(a: number, b: number, denominator: number): number {
  if (
    ![a, b, denominator].every(Number.isSafeInteger) ||
    a < 0 ||
    b < 0 ||
    denominator <= 0
  )
    throw new UserFacingError("Geçersiz maliyet hesabı.");
  const result = Number(
    (BigInt(a) * BigInt(b) + BigInt(denominator) / 2n) / BigInt(denominator),
  );
  if (!Number.isSafeInteger(result))
    throw new UserFacingError("Maliyet sınırı aşıldı.");
  return result;
}
