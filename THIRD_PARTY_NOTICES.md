# Üçüncü taraf bildirimleri

## Uyarlanan kod

InvenTree, Copyright (c) 2017 InvenTree Developers, MIT. `BomItem.get_required_quantity` davranışının TypeScript uyarlaması `src/lib/inventree-bom.ts` içinde. Tam izin ve garanti metni: `docs/research/INVENTREE-LICENSE.txt`.

## Geliştirme aracı

REA, Copyright (c) 2026 morluto, MIT. Uygulama çalışma zamanına gömülmedi. Tam lisans `docs/research/REA-LICENSE.txt`. REA'nın kendi üçüncü taraf paketleri ve native sağlayıcıları kendi lisanslarına tabidir; REA'nın MIT lisansı onları yeniden lisanslamaz. Bu çalışmada native sağlayıcı kullanılmadı.

## Çalışma zamanı

Next.js, React, PostgreSQL istemcisi, Zod ve Lucide kendi paket lisanslarıyla kullanılır. PDF.js Apache-2.0; Tesseract.js Apache-2.0; Tesseract OCR modelleri tessdata_fast deposunun Apache-2.0 lisansıyla kullanılır. PGlite Apache-2.0 ve birlikte gelen PostgreSQL kendi PostgreSQL lisansına tabidir.

Kilitli bağımlılık sürümleri `package-lock.json` içinde bulunur. Kurulu paketlerdeki lisans metinleri dağıtımda korunmalıdır. Bağımlılık listesi ve kopyalanmış doğrudan paket/OCR model lisansları `docs/research/dependency-licenses/` altında hazırlanır. Açık kaynak izinleri Mosaic Hotel markası veya üçüncü taraf faturaları için kullanım hakkı vermez.

Envanter doğrudan ve dolaylı üretim bağımlılıklarını, platforma özgü kurulu olmayan alternatiflerle birlikte kaydeder. Next.js'in dolaylı Sharp/libvips paketlerinde LGPL-3.0-or-later, caniuse-lite verisinde CC-BY-4.0 bulunur; bütün bağımlılıklar MIT olarak tanımlanamaz. Bu bileşenlerin lisans/atıfları korunmalıdır. Sharp/libvips burada değiştirilmedi ve tarayıcıya aktarılmadı. Bir sunucu paketi veya binary yeniden dağıtılırsa LGPL'nin ilgili kaynak ve yeniden bağlama koşulları ayrıca uygulanır. Kaynaklar: [libvips](https://github.com/libvips/libvips), [sharp-libvips](https://github.com/lovell/sharp-libvips), [caniuse-lite](https://github.com/browserslist/caniuse-lite).

Tarayıcıya verilen PDF/OCR işçileri ve MIT reçete portu için birleştirilmiş metin kurulumda `public/third-party-notices.txt` olarak üretilir. Kullanılan sunucu paketlerinin kendi lisans dosyaları da paketlerle birlikte korunur. Bu kayıt, tüm ticari dağıtım biçimlerine verilmiş bir hukuki garanti değildir.

OpenBoxes EPL 1.0 ve ERPNext GPLv3 lisansları karşılaştırma için belgelenmiştir; bu projeye kaynak kodları dahil edilmemiştir. Mosaic'e yeni kaynak kodu alınırsa kapsam, lisans ve atıf kayıtları güncellenmelidir.
