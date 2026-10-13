# Doğrulama kaydı

Son giriş güncellemesi: yeni Vercel/PostgreSQL kurulumunda admin/admin hesabı oluşturulması, yanlış parolanın reddi ve panel erişimi gerçek üretim sunucusunda Chromium ile doğrulandı. Ayrı soğuk başlangıçta otomatik oturum anahtarı ve değiştirilmiş yönetici parolası korundu. 21 test ve üretim derlemesi geçti. SESSION_SECRET ve bootstrap değişkenleri artık isteğe bağlıdır; DATABASE_URL gereklidir.

13 Ekim 2026; Node.js 24.19.0, npm 11.9.0, Linux, Chromium. Kontroller gerçek otel verisiyle yapılmadı.

| Kontrol                              | Sonuç         | Kapsam                                                                                                                                                                                                                                                           |
| ------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REA `npm ci`, `npm run build:cached` | Geçti         | Kaynak kurulumu, CLI ve statik JavaScript analizi; native sağlayıcılar kurulmadı                                                                                                                                                                                 |
| Tekrarlanabilir kurulum betiği       | Geçti         | Her iki npm kurulumu kilitli; OCR modelleri SHA-256 ile doğrulanıyor; kaynak/lockfile yenilenmiyor                                                                                                                                                               |
| `npm run build`                      | Geçti         | Next.js üretim derlemesi ve üretim sunucusunun başlatılması                                                                                                                                                                                                      |
| `npm run typecheck`                  | Geçti         | Uygulama, API, domain ve testlerin TypeScript kontrolü                                                                                                                                                                                                           |
| `npm run test`                       | 20 test geçti | Ağırlıklı ortalama, transfer, sayım, kapanış, geç fatura, ters kayıt, yetki, kesin miktar hesabı ve üretimde örnek oturumunun kapalı kalması                                                                                                                     |
| `npm run test:e2e`                   | 7 test geçti  | Gerçek tarayıcıda alım–transfer–teslim–tüketim–sayım–maliyet–alım raporu–reçete; PDF/görsel; dosya arşivi; salt okunur rol; mobil düzen ve Escape                                                                                                                |
| Dış PostgreSQL 17 + üretim API'si    | Geçti         | Gerçek parola girişi, alım kalıcılığı, stok hareketi, transaction rollback, iki eşzamanlı değişiklikte birinin reddi, aynı isteğin tekrarında tek hareket, kapanış revizyonları, kullanıcı pasifleştirme, son yönetici koruması, giriş sınırı ve Origin kontrolü |
| Çalışma zamanı bağımlılık taraması   | 0 açık kayıt  | `npm audit --omit=dev`; PDF.js bildirimi nedeniyle 6.2.108'e güncellendi ve belge testleri tekrar çalıştırıldı. Bu sonuç bağımsız güvenlik denetimi değildir                                                                                                     |

## İncelenip düzeltilen sorunlar

- Next.js geliştirme sunucusunun 127.0.0.1 kaynağına erişimi açıkça tanımlandı. POST Origin kontrolü, sunucunun iç adresi yerine dış istek Host/protokolüyle eşleştirildi.
- PostgreSQL istemcisinin JSONB seri hale getirmesinde metin değerinin ikinci kez kodlandığı gerçek sunucu testinde görüldü. Her iki sürücüye JSON nesnesi gönderilerek düzeltildi; sonra bütün PostgreSQL kontrolü geçti.
- PDF.js güncellemesinde yaşam döngüsü API'si değişti; yükleme görevinin `destroy()` yöntemiyle temizleme uyarlandı. Dijital ve metinsiz/taranmış PDF yolları tekrar doğrulandı.
- Reçete yüzdesi ve stok değeri hesabında ara kayan nokta yerine rasyonel/tam sayı hesap kullanıldı. Büyük değer ve yuvarlama sınırı testleri geçti.

Kapanış snapshot'ı ürün adını, grubunu, birimini ve kişi sayısını da saklar. Sonraki kart düzenlemesi geçmiş kapanışın etiketlerini değiştirmez. Testlerdeki JSONB nesne anahtarı sırası farkı, veri eşitliğinde derin karşılaştırmayla ele alındı; kayıt değerleri ayrı ayrı doğrulandı.

## Sonuçların sınırı

Yönetilen PostgreSQL sağlayıcısına, gerçek Vercel hesabına veya özel domaine dağıtım yapılmadı. Yeni bir bulut görevinin snapshot'tan geri yüklenmesi ve yayın sonrası yeniden bağlanması doğrulanmadı. Doğrulanmış uygulama kaynakları ve belgeler GitHub deposunun `main` dalına aktarıldı; `.local/`, oturum anahtarları, örnek veritabanı ve geçici test dosyaları Git'e eklenmedi. Depo başlangıçta commit içermiyordu.

OCR testleri kontrollü fakat gerçek PDF/PNG/JPEG dosyalarıyla yapıldı. Otelin tedarikçi faturalarındaki doğruluk, eğik/karanlık fotoğraflar, ambalaj dönüşümleri ve tedarikçiye özgü tablo düzenleri pilotta ölçülmeli. Önceki dönem karşılaştırması dönem verisi varsa çalışır; otelin gerçek geçmiş verisi henüz yok.

Pilot sınırları ve yüksek hacimde ilişkisel tablo/sayfalama gereksinimi `MIMARI.md` içinde açıklanır. Test için oluşturulan Docker PostgreSQL servisi işi bitince kaldırıldı. Yerel ledger yalnızca açıkça işaretlenmiş örnek kayıtlara döndürüldü; test kayıtları `.local/research/` altında geliştirme kanıtı olarak saklandı.
