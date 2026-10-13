# Teknik yapı

## Çalışan bileşenler

- Next.js App Router / React / TypeScript arayüz ve Node.js Route Handlers.
- PostgreSQL: üretimde `DATABASE_URL` bağlantısı; geliştirmede aynı SQL motor ailesinden PGlite.
- Oturum: imzalı HttpOnly çerez, sekiz saat süre, sunucuda aktif kullanıcı ve rol kontrolü. Parola scrypt ile rastgele tuz kullanılarak türetilir. Başarısız girişler veritabanında sınırlanır.
- PDF.js: metin katmanını okur; metinsiz sayfa OCR'a aktarılır.
- Tesseract.js: Türkçe ve İngilizce modelleri yerel statik dosyalardan yükler; tarayıcı işçisiyle okur.
- OCR çıktısı muhasebe işlemi değil, kontrol taslağıdır. Orijinal dosya bağımsız `mosaic_documents` tablosunda erişim kontrollü tutulur.

## Kalıcılık ve işlem sınırı

İlk pilot uygulamada otelin işlem durumu `mosaic_state` tablosundaki JSONB kaydı olarak tutulur. Ürünler, yerler, bakiyeler, faturalar, transferler, hareketler, kapanışlar, reçeteler ve işlem geçmişi bu işlem bütününün içindedir. Kullanıcılar, giriş denemeleri, istek kimlikleri ve belge ikilileri ayrı tablolardır.

Her değişiklik PostgreSQL transaction içinde `SELECT ... FOR UPDATE` ile güncel durumu kilitler. İstemci sürümü uyuşmazsa değişiklik yapılmaz. İş kuralları kopya durum üzerinde doğrulanır; hata olursa ne hareket ne bakiye ne işlem geçmişi kaydedilir. Aynı isteğin yeniden gönderimi ikinci işlem yaratmaz. Kapanışlar ayrı rapor revizyonları saklar. Bu uygulama günlük bir otelin pilotu için basit ve incelemesi kolay bir temel; yüksek hacimli ERP ölçeği için ölçülmüş performans iddiası değildir.

**Ölçek sınırı:** ilk sürüm listeleri toplu yükler ve tek otelin yazma işlemlerini sıraya alır. Çok yıllık/hacimli canlı kullanım öncesinde hareket/rapor sorgularını ilişkisel tablolara ve sunucu sayfalamaya taşımak, belgeyi nesne depolamaya almak ve yük testi yapmak gerekir. Tam denetim geçmişi DB yöneticisinden bağımsız değişmez kayıt servisi değildir.

## Maliyet doğruluğu

- Miktar temel birimin binde biri, para kuruş olarak saklanır.
- Alım değerlemesi: `round(miktar × net birim fiyat / 1000)`.
- Kısmi çıkış değeri: `round(bakiye değeri × çıkış miktarı / bakiye miktarı)`.
- Son miktarın tamamı çıktığında kalan tam bakiye değeri taşınır; sıfır stokta küsurat bırakılmaz.
- Reçete portu rasyonel tam sayı aritmetiği kullanır; yüzde çarpımında kayan nokta nedeniyle fazladan gram oluşmaz.
- Kapanış raporu ürün bazlı gerçekleşen maliyet ve kişi sayısını saklar; sonraki güncel fiyat onu değiştirmez.

## Erişim ve belge sınırları

Geliştirme örnek rolleri yalnızca `MOSAIC_LOCAL_MODE=true`, DATABASE_URL olmadan ve Vercel dışında etkinleşir. Vercel'de bu değişken verilse bile yerel veritabanı veya parolasız örnek oturumu açılmaz. Üretimde PostgreSQL, en az 32 karakterlik oturum anahtarı ve ilk yönetici gereklidir. Üretim veritabanı örnek malzemelerle doldurulmaz.

POST/PATCH/DELETE işlemleri Origin ve Host/protokol eşleşmesi ister. Belge türü PDF/PNG/JPEG ile sınırlanır, dosya imzası kontrol edilir, SHA-256 sunucuda yeniden hesaplanır. Dosya 2,5 MB, görsel 16 megapiksel, PDF 20 sayfa ile sınırlıdır. Belge API'si oturum ister, indirme `attachment` başlığıyla döner. Finans verileri ve belge ikilileri halka açık statik dizinde tutulmaz.

Oturum ve veri kontrolleri pilot başlangıcını sağlar; harici güvenlik denetimi yapılmış gibi sunulmaz. Canlı işletmede HTTPS, günlük yedekleme/geri yükleme tatbikatı, kullanıcıya parola yenileme politikası, veri saklama prosedürü ve altyapı gözlemi gerekir.

## Dosya haritası

| Dosya                            | Görev                                                          |
| -------------------------------- | -------------------------------------------------------------- |
| `src/lib/domain.ts`              | Girdi doğrulaması, stok hareketi, onaylar, dönem ve ters kayıt |
| `src/lib/reporting.ts`           | Tüketim ve alım rapor hesabı                                   |
| `src/lib/inventree-bom.ts`       | MIT reçete uyarlaması                                          |
| `src/lib/db.ts`                  | PostgreSQL/PGlite, şema, ilk kurulum                           |
| `src/lib/auth.ts`                | Oturum, giriş sınırı, rol ve Origin                            |
| `src/lib/documents.ts`           | PDF/OCR ve satır adayları                                      |
| `src/app/workspace.tsx`          | Kompakt çalışma ekranları ve orta işlem pencereleri            |
| `tests/domain.test.ts`           | Finans/stok kurallarının örnekli sınamaları                    |
| `tests/browser/workflow.spec.ts` | Gerçek tarayıcı iş akışı ve belge okuma                        |

## Bir sonraki teknik adımlar

Gerçek fatura örneklerine göre sütun tanıma ve ambalaj eşleştirme; günlük kişi girdisi; tedarikçi ana kartı; iade/iskonto farkları; imzalı fiş tarama bağlantısı; ilişkisel hareket tablosu ve sayfalama; yönetilen parola yenileme/MFA; doğrudan nesne depolama; otomatik yedek geri yükleme doğrulaması. Bunlar mevcut çalışan özellikler olarak anlatılmamalıdır.
