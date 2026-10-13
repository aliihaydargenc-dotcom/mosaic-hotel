# Mosaic — Ambar & Maliyet

Mosaic Hotel için PMS kapsamına girmeyen alım, stok, transfer, sayım, reçete ve maliyet uygulamasının çalışan ilk sürümü.

## Yerel kurulum

Node.js 24 ile doğrulandı. Mevcut checkout'u kullanın; yeni worktree gerekli değil.

```bash
cd /workspace/mosaic-hotel
npm ci --cache /tmp/mosaic-npm-cache
MOSAIC_LOCAL_MODE=true npm run dev
```

Harici DATABASE_URL ve VERCEL bulunmadığında yerel giriş ekranında Yönetici / Ambar / Rapor örnek rolleri vardır. Örnek stok ve faturalar gerçek otel verisi değildir. Veriler ve yerel oturum anahtarı `.local/` altında kalıcı tutulur; bu dizin Git'e eklenmez. Aynı uygulamayı veritabanına bağlı başka süreçle aynı anda başlatmayın. Süreci yeniden başlatınca kayıtlar korunur.

Kurulum PDF/OCR işçilerini hazırlayıp sabit commit ve SHA-256 ile doğrulanan Türkçe/İngilizce modellerini indirir. Gerekli ağ adresleri npm kayıt servisi ve `raw.githubusercontent.com` adresidir. Doğrulama kapatılmaz.

```bash
npm run test
npm run build
npm run typecheck
MOSAIC_LOCAL_MODE=true npm run start
```

Tarayıcı testleri için geliştirme veya üretim sunucusu 3000 portunda açık olmalı:

```bash
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

Testler sadece ayrı bir geliştirme/test veritabanına uygulanmalı; gerçek stok verisiyle çalıştırılmamalı.

## Vercel kurulumu

Bu depo GitHub'a gönderilip Vercel'de Next.js projesi olarak içe aktarılır. Kurulum `npm ci`, build `npm run build`. Vercel Node.js 24 seçilir. Yönetilen PostgreSQL bağlantısı ayrıca gerekir. Üretim veritabanı boş başlar.

Vercel proje ayarlarına aşağıdaki değerleri güvenli biçimde girin; değerleri kaynak koduna veya sohbete koymayın:

| Değişken                   | Amaç                                                                      |
| -------------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`             | Kalıcı PostgreSQL bağlantısı; sağlayıcının havuzlu/TLS doğrulamalı URL'si |
| `SESSION_SECRET`           | En az 32 karakter rastgele oturum imza anahtarı                           |
| `BOOTSTRAP_ADMIN_EMAIL`    | İlk yönetici e-postası                                                    |
| `BOOTSTRAP_ADMIN_PASSWORD` | İlk yöneticinin en az 12 karakter benzersiz parolası                      |

`MOSAIC_LOCAL_MODE` üretimde ayarlanmaz. İlk yönetici DB'de oluşturulduktan sonra bootstrap parolası Vercel ayarlarından kaldırılabilir. Oturum anahtarı kalır. Bağlantı bilgileri, parolalar ve oturum anahtarı Git'e girmez. Özel domain kurulumdan sonra ayrıca bağlanabilir; bu çalışmada domain satın alınmadı.

## Belgeler

- [Üç adayın araştırması ve lisans karşılaştırması](docs/research/ARASTIRMA.md)
- [İş akışları, kapsam ve yetki matrisi](docs/IS-AKISLARI.md)
- [Teknik yapı ve pilot sınırları](docs/MIMARI.md)
- [Doğrulama sonuçları](docs/DOGRULAMA.md)
- [Lisans bildirimleri](THIRD_PARTY_NOTICES.md)

InvenTree'den yalnızca belirtilen MIT reçete yöntemi uyarlanmıştır. Program InvenTree'nin tam kurulumu veya OpenBoxes/ERPNext çatallaması değildir. Sunum, çalışan program ve otel pilotu üzerinden daha sonra hazırlanacaktır.
