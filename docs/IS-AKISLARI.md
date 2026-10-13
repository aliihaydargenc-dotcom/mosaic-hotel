# İş akışları ve kapsam

## Operasyon sırası

1. **Konfigürasyon:** stok kartı (kod, malzeme, alt grup, temel birim, minimum stok), depo ve lokasyon oluşturulur. Depo ve lokasyon stok taşıyabilir; depo/lokasyon ayrımı maliyet kuralını değiştirmez.
2. **Alım:** PDF/görsel yüklenir veya manuel fatura girilir. Belge tarihi, tedarikçi, fatura numarası, açık kayıt dönemi ve mal kabul yeri seçilir.
3. **Eşleştirme:** belge satırı var olan stok kartıyla eşleştirilir; gerektiğinde aynı ekran içinde yeni stok kartı açılır. kg/lt/adet temel birimi ve fiyat kontrol edilir.
4. **Kontrol taslağı:** satırlar, miktar, net birim fiyat ve KDV oranı kaydedilir. Bu aşama stoğu artırmaz.
5. **Alım onayı:** fatura stoğa işlenir; seçilen yerde miktar ve toplam stok değeri artar. İkinci kez onay engellenir.
6. **Transfer fişi:** kaynak, hedef ve miktarlar seçilir. Depodan depoya, depodan lokasyona ve lokasyondan lokasyona aktarım mümkündür. Bekleyen fiş stok rezervasyonu yapmaz.
7. **Teslim:** fiş yazdırılır, teslim eden/alan imzası alınır; teslim kabulü ve alan kişinin adı sisteme girilir. Miktar kaynaktan düşer, hedefe artar. Toplam stok ve toplam değer korunur.
8. **Gerçek tüketim:** transfer tüketim değildir. Serviste kullanılan malzeme lokasyondan tüketim çıkışıyla düşülür. Alternatif olarak sayım farkı tüketim kaydı oluşmasını sağlar; aynı tüketim ikinci kez sayılmamalıdır.
9. **Sayım:** tek stok kartı + tek lokasyon seçilir, mevcut stok görülür ve sayılan miktar girilir. Fark ve gerekçesi kaydedilir. Sıfır stokta maliyeti bilinmeyen fazla ürün için önce maliyetli alım gerekir.
10. **Kişi sayısı:** ilgili dönem yetişkin ve çocuk sayıları manuel girilir. Eşit ağırlıkla toplanır.
11. **Maliyet:** ürün ve alt grup bazında tüketim miktarı/maliyeti görülür; kg ürünleri için kişi başı gramaj hesaplanır. lt ve adet grama dönüştürülmez. Önceki dönem varsa tutar değişimi hesaplanır.
12. **Dönem kapanışı:** yönetici kapanışı yapar; bekleyen taslak/transfer ve sıfır kişi sayısı kapanışı engeller. Rapor revizyonu saklanır. Kayıt dönemi kilitlenir, yeni hareket yapılamaz.
13. **Düzeltme:** yönetici gerekçeyle son dönemi yeniden açar. Orijinal hareket silinmez; ters kayıt ve yeni doğru işlem yapılır. Tekrar kapanış yeni revizyon oluşturur. Sonraki dönem açılmışsa tarihsel yeniden değerleme bu sürümde desteklenmediği için önceki dönem açılamaz.
14. **Geç fatura:** belge tarihi eski ay olabilir; alım yeni açık kayıt dönemine girer. Eski kapanış ve eski tüketim maliyeti değişmez.
15. **Reçete:** referans porsiyon ve malzeme miktarları girilir. Planlanan kişiyle ihtiyaç ölçeklenir; ek malzeme payı uygulanır; güncel ağırlıklı ortalama stok değeriyle tahmini tutar hesaplanır. Reçete tek başına stoktan düşmez.

## İş kuralları

| Konu              | Karar                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| Stok değerleme    | Hareketli ağırlıklı ortalama; FIFO uygulanmıyor                                                        |
| Para              | Tam kuruş; fiyatlar KDV hariç ve indirim sonrası net girilmeli                                         |
| Miktar            | Temel birimin binde biri; 1 kg = 1000 iç birim, 1 lt = 1000 iç birim                                   |
| Çoklu ambalaj     | Evrensel koli/paket dönüşümü yok; operatör temel birime çevirip net fiyatı doğrular                    |
| Çocuk             | Yetişkin + çocuk; katsayı yok                                                                          |
| Sayım eksiği      | Maliyete eklenir; tüketim/fire ayrımı ayrıca yapılmıyor                                                |
| Sayım fazlası     | Dönem net farkını azaltır; maliyetin negatif olması fazla düzeltme göstergesidir, satış/gelir değildir |
| Transfer değeri   | Kaynak ağırlıklı ortalamasından taşınır; kalan son miktarda kalan tam değer taşınır                    |
| Negatif stok      | Reddedilir; istenen miktar sessizce azaltılmaz                                                         |
| Fatura tekrarı    | Tedarikçi+numara veya belge SHA-256 üzerinden engellenir                                               |
| Stok kartı        | Kod benzersizdir; belge adı tek başına otomatik yeni kart oluşturmaz                                   |
| Eşzamanlılık      | PostgreSQL işlem kilidi + sürüm denetimi; bayat ekran işlemi reddedilir                                |
| Yeniden istek     | Aynı kullanıcı/istek kimliği tekrarında ikinci stok hareketi oluşturulmaz                              |
| İmza              | Yazdırılmış fiziksel imza + sistemde teslim kaydı. Nitelikli elektronik imza değildir                  |
| Kullanıcı yetkisi | Sunucuda doğrulanır; buton gizlemek yetki kontrolünün yerine geçmez                                    |

## Yetki matrisi

| İşlem                                           | Rapor | Ambar | Yönetici |
| ----------------------------------------------- | ----- | ----- | -------- |
| Fatura, stok, transfer, reçete ve rapor görme   | Evet  | Evet  | Evet     |
| Alım, transfer, tüketim, sayım                  | Hayır | Evet  | Evet     |
| Stok kartı / depo / lokasyon / reçete oluşturma | Hayır | Evet  | Evet     |
| Kişi sayısı girişi                              | Hayır | Evet  | Evet     |
| Kapanış / yeniden açma / ters kayıt             | Hayır | Hayır | Evet     |
| Kullanıcı yönetimi                              | Hayır | Hayır | Evet     |

## İlk sürümün sınırı

Tek otel; alım, fatura arşivi, stok, transfer, teslim, sayım, tüketim, reçete, kişi bazlı maliyet, kapanış ve yetki yönetimi. PMS, SAP çekimi, e-fatura düzenleme, satış/gelir muhasebesi, rezervasyon, bordro ve muhasebe entegrasyonu kapsam dışıdır.

Tedarikçi faturalarındaki evrensel otomatik tablo tanıma, irsaliye/fatura eşleştirmesi, iade/kur farkı, çoklu para birimi, lot/SKT, gram dışındaki besin yoğunluğu dönüşümü, geçmiş ayları zincirleme yeniden değerleme ve çok otel yönetimi ayrı geliştirmedir. Bu alanları ilk ekranlara eklemek yerine gerçek kullanımda ihtiyaç doğrulanınca ele almak gerekir.

## Otelle pilotta doğrulanacaklar

- Gerçek stok kartları, alt gruplar ve temel birimler.
- Farklı tedarikçilerin en az birkaç dijital PDF, tarama ve fotoğraf faturası; manuel girişe göre kontrol süresi ve düzeltme sayısı.
- Günlük tüketim çıkışı mı, yalnızca ay sonu sayım farkı mı uygulanacağı; çift maliyet kaydını önleyen görev paylaşımı.
- KDV indirimi olmayan maliyetler ve ticari iskontonun net fiyata aktarılması.
- Fiziksel imzalı fişin saklanma ve kabul sorumluluğu.
- Kişi sayısının kaynağı ve günlük/aylık birleştirme kuralı.
- Dönem kapanış günü, sonradan fatura politikası ve yönetici düzeltme yetkisi.
- Yedekleme, geri yükleme, veri saklama süresi ve yönetilen PostgreSQL sağlayıcısı.

Bu maddeler ilk sürümün geliştirme ortamında çalışmasını engellemez; otelin canlı verisine geçiş öncesinde işletme kabulünü belirler. Sunum, programın çalışan sürümü ve pilot kapsamı üzerinden daha sonra hazırlanacaktır.

## Ziyaretçi demosu

Giriş ekranındaki **Demoyu göster** bağlantısı `/demo` alanını açar. Önceki kapalı dönem, güncel alım ve tüketimler, sayım farkı, reçeteler, bekleyen fatura ve transfer bulunur. Operasyonlar aynı stok/maliyet kurallarıyla tarayıcı belleğinde çalışır; üretim API'sine veya veritabanına yazılmaz. Sıfırla, yenileme veya yeni ziyaret başlangıç verilerini geri getirir. Kullanıcı hesaplarının yönetimi demo içinde kapalıdır. Demo açmak gerçek kullanıcı oturumunu değiştirmez.
