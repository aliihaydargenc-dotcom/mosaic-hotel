import { ZodError } from "zod";
export class UserFacingError extends Error {}
export function publicError(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof ZodError)
    return "Alanları kontrol edin. Miktar, tarih ve zorunlu bilgiler geçerli olmalı.";
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  )
    return "Bu kayıt zaten var.";
  return "İşlem tamamlanamadı. Kurulum ve bağlantı ayarlarını kontrol edin.";
}
