# Yük testi ve işletme maliyeti

13 Ekim 2026. İncelenen hedef: tek otelde günlük alım, transfer, sayım, tüketim ve rapor kullanımı; satıcıya kontrolsüz bakım yükü bırakmayan teslim modeli.

## Ölçülen sonuç

Üretim Next.js sunucusu ve ayrı, geçici PostgreSQL 17 veritabanı kullanıldı. Canlı Neon verisine işlem yapılmadı. 120 stok kartı, 5 yer ve 100 / 2.500 / 10.000 hareketle 1, 5, 10 paralel işlem akışı denendi. 480 ayrı okuma isteği ve her biri güncel durum okumasını da içeren 240 kayıt denemesinde beklenmeyen API hatası ve test edilen stok miktarında tutarsızlık görülmedi. Kayıt denemelerinin 49'u kabul edildi, 191'i sürüm uyuşmazlığı nedeniyle reddedildi. Reddetmeler hatalı stok yazılmasını engelliyor; yoğun eşzamanlı kullanımda kullanıcıya fazla tekrar işi çıkarıyor.

| Hareket sayısı | 10 paralel okumada p95 | API yanıt boyutu | 10 paralel kayıt akışında kabul / deneme | Okuma + kayıt çevrimi p95 |
| -------------- | ---------------------: | ---------------: | ---------------------------------------: | ------------------------: |
| 100            |                  60 ms |            64 KB |                                   5 / 50 |                    218 ms |
| 2.500          |                 310 ms |          1,05 MB |                                   6 / 50 |                    569 ms |
| 10.000         |               1.051 ms |          4,12 MB |                                   6 / 50 |                  2.187 ms |

Kayıt süresi başarılı ve reddedilmiş denemeleri birlikte içerir. Eşzamanlı test kasıtlı olarak aynı stok üzerinde çakışan işlemler üretir. Tek test hesabı kullanıldı; bu ölçüm 50 ayrı kullanıcının doğrulanmış kapasitesi değildir. Şu anki tek durum/sürüm yaklaşımı farklı ürünlere yapılan işlemleri de çakıştırabilir.

Aynı 10.000 hareketli veride Chromium ekran ölçümü:

| Ekran geçişi                   |                         Önce | 50 kayıtlık listeyle sonra |
| ------------------------------ | ---------------------------: | -------------------------: |
| Sayım & tüketim                | 4.511 ms, 9.999 tablo satırı |    136 ms, 50 tablo satırı |
| Ardından işlem geçmişine geçiş |                    29.485 ms |                     169 ms |

Bunlar aynı yerel ortamda tekil tarayıcı ölçümleridir; dağılım/üretim garantisi değildir. İlk sayfa yüklemesi ayrı ölçülür ve hızlanma iddiasına dahil edilmez. API hâlâ tüm işlem durumunu gönderir; ekran sayfalaması API yanıt boyutunu azaltmaz. Rapor hesabı bütün kayıtları kullanmaya devam eder. Hareket listesine önceki/sonraki sayfa kontrolleri eklendi.

## Canlı kullanım için tamamlanacak işler

1. Hareketleri indeksli ilişkisel tablolarda saklamak; dönem, yer ve malzemeye göre sunucuda filtre ve sayfalama yapmak. Ekran, yalnızca istediği sayfayı almalı.
2. Alım/maliyet raporlarını sunucuda toplulaştırmak; tam CSV raporunu ayrı istekle üretmek. Gerekirse büyük raporu arka planda hazırlamak.
3. Güncel bakiyeyi veritabanı transaction'ında doğrulayan, ilgili kaydı kilitleyen işlem modeline geçmek. Bağımsız işlemler otelin tamamının sürümüne bağlı olmamalı. Sayım ve ters kayıt gibi hassas işlemler güncel değer kontrolünü korumalı; kör otomatik tekrar yapılmamalı.
4. PDF/görselleri ayrı dosya deposuna almak. Yedekleme, gerçek geri yükleme denemesi ve hata bildirimi eklemek.
5. Gerçek tedarikçi faturalarıyla OCR kontrol süresini ve yanlış eşleşmeleri ölçmek. Fatura kontrolü, teslim kabulü ve sayım görevlerini personele kısa bir eğitimle anlatmak.
6. Bu değişikliklerin ardından otelin gerçek işlem hacmine uygun süreli testi tekrarlamak. Vercel/Neon ağ gecikmesi, soğuk başlangıç, yavaş cihaz ve eşzamanlı belge yüklemesi ayrıca ölçülmeli.

Yerel test ağ gecikmesini, Vercel kaynak sınırlarını, PDF yükünü, OCR'ı, elektrik/internet kesintisini ve günler süren testi kapsamaz. Çökme gözlenmemesi kesintisiz çalışma garantisi değildir. Pro'ya geçmek yazılımın veri/sürüm modelini tek başına düzeltmez.

Tekrarlama: ayrı yerel `mosaicload` PostgreSQL veritabanı ve onunla çalışan üretim sunucusu gerekir. `LOAD_TEST_DATABASE_URL` ve gerekirse `LOAD_TEST_BASE` verilerek `npx tsx scripts/load-test.mts` çalıştırılır. Betik yalnızca localhost/127.0.0.1 adreslerini kabul eder; test veritabanının durumunu değiştirir. Sonuçlar Git dışında `.local/research/load-test.json` altında tutulur.

## Teklif ve bakım modeli

100–150 bin TL teklif, yalnızca hosting maliyetine bakılarak kârlı ilan edilemez. Geliştirme, eğitim, veri hazırlığı, sonradan istenen özellikler, destek süresi, vergi ve tahsilat hesaba katılmalı.

Önerilen teklif ayrımı:

| Kalem             | Teklifte yazılacak sınır                                                                |
| ----------------- | --------------------------------------------------------------------------------------- |
| Kurulum ve teslim | Mevcut modüller, bir otel, mutabık kalınan veri aktarımı, eğitim ve kabul senaryosu     |
| Hata düzeltme     | Örneğin teslimden sonraki 60 gün; kabul edilen kapsamın hataları. Yeni özellik ayrı iş  |
| Altyapı           | Vercel, veritabanı, belge deposu, domain ve yedekler müşteri tarafından doğrudan ödenir |
| Bakım/destek      | Ayrı aylık/yıllık paket; çalışma saatleri, dahil süre ve ek saat bedeli belirlenir      |
| Yeni geliştirme   | Yazılı kapsam, ayrı fiyat ve teslim tarihi                                              |

Sınırsız ömür boyu destek veya günün her saatinde müdahale sözü verilmemeli. Otelde bir sorumlu kişi talepleri toplamalı. Arıza ile eğitim sorusu ayrı takip edilmeli. Yanıt süresi ile çözüm süresi aynı taahhüt değildir. Tahsilatı başlangıç, çalışan sürüm ve kabul aşamalarına bölmek önerilir.

Altyapı için önceki 35–50 USD/ay çalışma bütçesi **tahmindir**, sabit teklif değildir: yılda 420–600 USD; üç yılda 1.260–1.800 USD. Bu rakamları tek seferlik satışa süresiz dahil etmek kur ve kullanım riskini satıcıya bırakır. Örneğin yalnızca hesap göstermek için 45 TL/USD kullanılırsa yıllık 18.900–27.000 TL eder; 45 TL güncel kur iddiası değildir. Destek emeği ve vergiler bu tutara dahil değildir.

13 Ekim 2026'da kontrol edilen sağlayıcı bilgileri: Vercel Pro başlangıç 20 USD/ay, kullanım aşımı ayrıca; Neon Launch kullanıma göre ücretli ve yayımlanan örnek senaryo 15 USD/ay. Neon ücretsiz planın yayımlanan kapasitesi 1 GB/proje ve 100 CU-saat/ay; gerçek hesap kullanımını ve kota geçişlerini panelden izlemek gerekir. Domain için standart premium olmayan `.com` adına 15–30 USD/yıl yalnızca bütçe varsayımıdır; seçilen adın kayıt ve yenileme bedeli ayrıca kontrol edilir. Hobby kişisel/ticari olmayan kullanım içindir.

Kaynaklar: https://vercel.com/pricing , https://vercel.com/docs/plans/hobby , https://neon.com/pricing . Ücretli plan veya domain satın alma işlemi yapılmadı.
