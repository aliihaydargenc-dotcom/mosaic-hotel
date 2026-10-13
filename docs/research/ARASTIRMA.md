# Mosaic Hotel için stok ve maliyet sistemi araştırması

İnceleme tarihi: 13 Ekim 2026. Bu çalışma üç açık kaynak uygulamanın resmi kaynakları, lisans metinleri, seçilmiş kaynak kodları ve Vercel belgelerine dayanır. Otelin gerçek faturaları, stokları veya operasyon verileri henüz sağlanmadı. Otelin maliyetinde düşüş veya yatırım geri dönüşü hakkında ölçülmüş sonuç yoktur.

## Otel bağlamı

[Mosaic Hotel'in resmi sitesi](https://mosaic-hotel.com/) oteli İstanbul, Laleli/Fatih olarak tanımlıyor. Sitede Mosaic Restoran, A'lacarte Restoran ve Lobi Bar hizmetleri listeleniyor. Bu bilgi lokasyon kavramının uygunluğunu destekler; lokasyonların gerçek stok prosedürlerini, depo sayısını veya büfe porsiyonlarını kanıtlamaz. Uygulamadaki başlangıç depoları, malzemeler ve tutarlar yalnızca yerel örnektir. Bulut üretim kurulumu boş başlar.

## Üç aday

| Aday          | Doğrulanan yapı                                                                                                     | Bu ihtiyaçtaki güçlü taraf                                                          | Uyarlama yükü                                                                                                          | Lisans / ticari kullanım                                                                                                                               | Vercel uyumu                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **InvenTree** | Django REST backend; React/TypeScript frontend; stok lokasyonları, hareket geçmişi, transfer emirleri, sayım ve BOM | Stok kartı–lokasyon ayrımı; miktar değişikliğinde kilit; reçete malzeme gereksinimi | Üretim/seri numarası alanları kaldırılmalı; otel dönem kapanışı, faturalar ve kişi bazlı maliyet ayrıca geliştirilmeli | MIT; ticari kullanım ve değişiklik mümkün; telif ve lisans bildirimi korunmalı                                                                         | Tam Django uygulaması Vercel'e taşınmaz. Seçilmiş MIT kurallarının TypeScript uyarlaması ve ayrı PostgreSQL uygun |
| **OpenBoxes** | Grails/Groovy backend; React frontend; stok hareketi, sevkiyat, teslim alma ve cycle count                          | Depolar arası hareket ve teslim süreçlerinin ayrımı                                 | Tedarik zinciri kapsamı otel ihtiyacından geniş; backend için ayrı çalışma ortamı gerekir                              | EPL 1.0; ticari kullanım mümkün. Dağıtılan program ve türev katkılarda kaynak/lisans yükümlülükleri, ticari dağıtıcı şartları var                      | Frontend tek başına işlevsel backend değildir; Grails çalışma ortamı Vercel fonksiyonuna doğrudan uygun değil     |
| **ERPNext**   | Frappe tabanlı Python/JavaScript ERP; alım, Stock Entry, Stock Reconciliation, BOM                                  | Satın alma, stok değerleme ve muhasebede geniş standart süreç                       | PMS istenmese bile geniş ERP altyapısı; otel için kapsam ve bakım yükü artar                                           | GPLv3; ticari kullanım mümkün. Dağıtılan türevlerde GPL ve karşılık gelen kaynak yükümlülükleri var; GPL tek başına AGPL'nin ağ şartıyla aynı değildir | Frappe servisleri/veritabanı ve görev işleyicileri ayrı sunucu gerektirir                                         |

**Seçim: InvenTree'nin stok ve BOM modeli + Mosaic'e özgü Next.js uygulaması.** Bu, hazır InvenTree'nin tamamını kurduğumuz anlamına gelmez. Üç projeden herhangi biri olduğu gibi Vercel üzerinde tam backend olarak çalıştırılamaz. Tek otelin alım–stok–maliyet akışını, ayrı PostgreSQL üzerinde çalışan küçük bir uygulamada karşılamak daha uygun.

## Gerçekte alınan / uyarlanan kod

InvenTree `BomItem.get_required_quantity` yöntemi TypeScript'e uyarlandı:

- Kaynak commit: `fa04bcc455597735e3e703148486ce9fdb2ee95b`.
- Kaynak dosya: `src/backend/InvenTree/part/models.py`.
- Hedef: `src/lib/inventree-bom.ts`.
- Korunan davranış: porsiyonla ölçekleme, ek malzeme payı, hazırlık miktarı, yukarı yuvarlama.
- Değişiklik: otel temel birimi, tam binde birlik miktarlar, hassas rasyonel hesap ve geçersiz girdiye açık hata.
- MIT telif ve lisans bildirimi `INVENTREE-LICENSE.txt` içinde saklandı.

Stok hareketlerinin ana fikri kaynak incelemesinden alındı: işlem sınırı, güncel miktar kilidi, kaynak/hedef ayrımı ve hareket geçmişi. Mosaic'in dönem, fatura, yetkilendirme ve rapor kodu bu proje için yazıldı. InvenTree'nin endüstriyel stok azaltımında bazı yollar fazla talebi mevcut miktara sınırlıyor; Mosaic bu davranışı almadı, yetersiz stoğu açık hata ile reddediyor.

OpenBoxes ve ERPNext'ten uygulama kodu veya arayüz varlığı kopyalanmadı. Lisans metinleri inceleme kanıtı olarak saklandı. Ticari kullanım izni ile bütün yükümlülüklerin yerine getirilmesi ayrı değerlendirmelerdir; burada yalnızca alınan MIT bileşen için atıf ve lisans korunmuştur. Otelin markası üçüncü kişilere yeniden lisanslanmış sayılmaz.

## REA kurulumu ve inceleme

`morluto/rea`, MIT lisanslı yerel analiz aracıdır. Kaynak commit `ded199abcde611a0ba4739ecb536e0ede0075670`, sürüm 6.4.0. Kilitli npm kurulumu ve `npm run build:cached` başarıyla çalıştı. CLI analizi kullanıldı; bu sohbetin çalışan araç listesine bir MCP sunucusu sonradan eklenmiş gibi davranılmadı. Ghidra/Hopper/IDA kurulmadı; seçilen hedef kaynak kodu açık bir web uygulamasıdır.

OpenBoxes frontend'i REA ile statik olarak incelendi. Büyük tarama 9.243 düğüm ve 9.994 ilişki üretti; kapsam **kısmi**. Araç genişletilmiş ilişkiler için sonuç bütçesi sınırlamalarını bildirdi. Bu sonuç backend doğruluğunu veya bütün ürünün incelendiğini kanıtlamaz. Özet `rea-openboxes-summary.json` içinde; tam ilk çıktı geçici çalışma alanında tutuldu. Transfer, stok hareketi ve sayım API dosyaları ayrıca hedefli tarandı; özet `rea-focused-summary.json` içinde, tam kanıt geliştirme ortamında `.local/research/rea-focused-evidence.json` içinde tutuluyor. Hedefli taramanın bağımlılık sınırları da kısmi olarak raporlandı.

Bu hedefte tersine mühendisliğin getirisi davranışı ve sınırları anlamaktır. Kaynak kodu mevcutken lisans dışı bir ticari uygulamanın kapalı kodunu çıkarmak gerekli değildir. REA çıktısı herhangi bir hedefin telif veya lisans koşullarını değiştirmez.

## Belge okuma yaklaşımı

| Yaklaşım                     | Kullanım                                                     | Sınır / karar                                                                                                           |
| ---------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| PDF metin katmanı            | Dijital üretilmiş faturadan metin çıkarma; PDF.js            | İlk tercih; hızlı, ek bulut ücreti yok. Satır düzeni tedarikçiye göre değişebilir                                       |
| Tesseract Türkçe + İngilizce | PNG/JPEG ve metinsiz PDF sayfası; tarayıcı içi OCR           | Bu sürümde çalışır. Okunan metin ve satır adayları operatör kontrolünden geçer. Evrensel fatura alan tanıma iddiası yok |
| Yönetilen belge servisi      | Gerekirse karmaşık tedarikçi faturalarında tablo/alan tanıma | Bu sürüme bağlanmadı; gerçek belgelerde doğruluk ve kullanım maliyeti ölçülmeden satın alma kararı verilmez             |

OCR modelleri resmi `tesseract-ocr/tessdata_fast` deposunun sabit commit'inden indirilir; SHA-256 kontrolü yapılır. İşlemde fatura üçüncü taraf bir okuma API'sine gönderilmez. Fatura kaydedildiğinde orijinal dosya uygulamanın veritabanında erişim kontrollü tutulur. Doğru stok eşleştirmesi onaylanmadan stok hareketi oluşmaz.

## Vercel kararı

Next.js arayüzü ve Node.js API fonksiyonları Vercel'e uygundur. Kalıcı PostgreSQL bağlantısı dışarıda tutulur; dosya sistemine yazılan veritabanı üretim çözümü değildir. OCR tarayıcıda çalıştığı için uzun OCR işi Vercel fonksiyonunda tutulmaz. İlk sürüm 2,5 MB belge sınırı koyar; base64 ve alan verileriyle istek Vercel'in 4,5 MB fonksiyon gövdesi sınırının altında tutulur. Daha büyük belgelerde doğrudan nesne depolama yüklemesi ayrı geliştirmedir.

PostgreSQL için Neon, Supabase veya başka yönetilen sağlayıcı seçilebilir; sözleşme, bölge, yedekleme ve maliyet henüz seçilmedi. Bu çalışma Vercel'de dağıtım yapmış veya domain bağlamış değildir. Yerel gömülü PostgreSQL yalnızca geliştirme içindir. Dış PostgreSQL yolu ayrıca yerel PostgreSQL sunucusuyla doğrulanır; yönetilen sağlayıcı bağlantısı ayrı kontrol gerektirir.

## Kaynaklar

- [Mosaic Hotel resmi site](https://mosaic-hotel.com/) — işletme bağlamı; 13 Ekim 2026 tarihinde erişildi.
- [InvenTree](https://github.com/inventree/InvenTree/tree/fa04bcc455597735e3e703148486ce9fdb2ee95b), [MIT lisansı](https://github.com/inventree/InvenTree/blob/fa04bcc455597735e3e703148486ce9fdb2ee95b/LICENSE), [stok modeli](https://github.com/inventree/InvenTree/blob/fa04bcc455597735e3e703148486ce9fdb2ee95b/src/backend/InvenTree/stock/models.py), [BOM modeli](https://github.com/inventree/InvenTree/blob/fa04bcc455597735e3e703148486ce9fdb2ee95b/src/backend/InvenTree/part/models.py).
- [InvenTree stok dokümanı](https://github.com/inventree/InvenTree/blob/fa04bcc455597735e3e703148486ce9fdb2ee95b/docs/docs/stock/index.md), [transfer](https://github.com/inventree/InvenTree/blob/fa04bcc455597735e3e703148486ce9fdb2ee95b/docs/docs/stock/transfer_order.md), [BOM](https://github.com/inventree/InvenTree/blob/fa04bcc455597735e3e703148486ce9fdb2ee95b/docs/docs/manufacturing/bom.md).
- [OpenBoxes](https://github.com/openboxes/openboxes/tree/38daf68f4a90f30eb8373b7db1054f8e32957354), [EPL 1.0 lisansı](https://github.com/openboxes/openboxes/blob/38daf68f4a90f30eb8373b7db1054f8e32957354/LICENSE.md).
- [ERPNext](https://github.com/frappe/erpnext), [GPLv3 lisansı](https://github.com/frappe/erpnext/blob/develop/license.txt), [Stock Entry](https://docs.frappe.io/erpnext/user/manual/en/stock-entry). ERPNext değerlendirmesi resmi doküman/README/lisansla sınırlıdır; bütün kaynak kodu kurulmadı ve test edilmedi.
- [REA](https://github.com/morluto/rea/tree/ded199abcde611a0ba4739ecb536e0ede0075670), [lisans](https://github.com/morluto/rea/blob/ded199abcde611a0ba4739ecb536e0ede0075670/LICENSE).
- [Vercel kalıcı depolama](https://vercel.com/docs/storage), [fonksiyon limitleri](https://vercel.com/docs/functions/limitations).
- [PDF.js](https://github.com/mozilla/pdf.js), [Tesseract.js](https://github.com/naptha/tesseract.js), [Türkçe/İngilizce OCR modelleri](https://github.com/tesseract-ocr/tessdata_fast/tree/87416418657359cb625c412a48b6e1d6d41c29bd).

Bu araştırma yerel kaynak incelemesidir; Derin Araştırma uygulaması bu oturumda çağrılabilir olmadığı için bir Derin Araştırma raporu olarak sunulmaz.
