# Canva Sınıfı Rezervasyon Sistemi

**Bursa İl Millî Eğitim Müdürlüğü YEĞİTEK Birimi | BTSO Eğitim Vadisi**

Canva Sınıfı için ortak rezervasyon ve doluluk takvimi. Web sayfası **GitHub Pages** üzerinde yayınlanır; telefon, tablet ve bilgisayarda tarayıcıdan açılır. Kayıtlar arka planda bir **Google E-Tablo**'da tutulur. Böylece farklı cihazlardan girenler aynı saati seçemez.

Adres: `https://ugurcanolmez.github.io/CanvaBursa/`

## Dosya yapısı

```
CanvaBursa/
├── index.html                 ← Web sayfası (GitHub Pages bunu açar)
├── manifest.webmanifest       ← "Ana ekrana ekle" bilgisi (telefon/tablet)
├── icons/
│   ├── icon.svg               ← Sekme simgesi
│   ├── icon-192.png           ← Android ana ekran simgesi
│   ├── icon-512.png           ← Android açılış ekranı simgesi
│   └── apple-touch-icon.png   ← iPhone / iPad ana ekran simgesi
├── google-apps-script/        ← Sayfanın parçası değil, Google'a yapıştırılacak kod
│   ├── Kod.gs                 ← Veri katmanı (kayıt, çakışma kilidi, iptal, CSV)
│   └── appsscript.json        ← Proje ayarları (saat dilimi İstanbul)
├── .nojekyll                  ← GitHub Pages'in dosyaları olduğu gibi yayınlaması için
└── README.md
```

GitHub'a yüklerken bu yapıyı koruyun: `index.html` deponun **ana klasöründe** olmalı.

## Kurulum

### 1. Google tarafı (bir kez, yaklaşık 5 dakika)

1. [script.new](https://script.new) adresini açın (sayfanın sahibi olan Google hesabıyla).
2. Açılan editördeki kodu silin, `google-apps-script/Kod.gs` içeriğini yapıştırın ve kaydedin. Başka dosya gerekmez.
3. Sol menüden **Proje Ayarları (⚙)** bölümüne girin:
   - **Saat dilimi:** `(GMT+03:00) İstanbul`
   - **Komut Dosyası Özellikleri → Özellik ekle:** ad `YONETICI_PIN`, değer kendi PIN'iniz.
4. Editöre dönün, üstteki listeden `kurulum` fonksiyonunu seçip **Çalıştır**'a basın ve Google'ın istediği izinleri verin.
5. **Dağıt → Yeni dağıtım → Tür: Web uygulaması** seçin. "Şu kullanıcı olarak çalıştır: **Ben**", "Erişimi olanlar: **Herkes**" ayarlarıyla **Dağıt**'a basın ve `.../exec` ile biten linki kopyalayın.

`Kod.gs` içindeki `TABLO_ID` hazırlanmış "Canva Sınıfı Rezervasyonları" tablosunu gösterir. Başka bir tablo kullanacaksanız linkindeki `/d/` ile `/edit` arasındaki kimliği buraya yazın. Bu tablo kodu çalıştıran hesabın Drive'ında olmalı.

### 2. Sayfayı Google'a bağlama

`index.html` içinde şu satırı bulun:

```js
var API_URL = '';
```

Google'dan aldığınız linki tırnakların arasına yapıştırın. Bu satır boş kaldığı sürece sayfa **demo modunda** çalışır: kayıtlar yalnızca o cihazda kalır.

### 3. GitHub Pages'i açma

1. Dosyaları deponun ana klasörüne yükleyin.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch** seçin.
3. Dalı seçin, klasörü **/ (root)** bırakıp **Save**'e basın.
4. 1–2 dakika sonra sayfa açılır.

## Telefon ve tablet

- **Telefon:** Günler üstte sekme olarak görünür, seçilen günün saatleri alt alta listelenir.
- **Tablet ve bilgisayar:** Haftanın 5 günü yan yana görünür.
- **Ana ekrana ekleme:** Sayfa ana ekrana eklenebilir. iPhone/iPad'de Safari'de **Paylaş → Ana Ekrana Ekle**, Android'de Chrome menüsünde **Ana ekrana ekle**. Simgesiyle uygulama gibi tam ekran açılır.
- iPhone'daki çentik ve alt çubuk alanları hesaba katılmıştır.

## Özellikler

- Hafta içi (Pazartesi–Cuma), 09:00–12:00 ve 13:00–17:00 arası 1 saatlik bloklar (12:00–13:00 öğle arası).
- Birden fazla **ardışık** saat tek seferde seçilebilir.
- **Çakışma kilidi:** `LockService` aynı anda gelen istekleri sıraya alır. İlk gelen kaydedilir, diğerine "Bu saat aralığı az önce doldu" uyarısı çıkar.
- Dolu saatler kırmızı ve tıklanamaz. Üzerinde yalnızca okul/kurum ve eğitim konusu yazar; ad ve telefon gizlidir.
- Geçmiş saatler otomatik kilitlenir. Ekran her 30 saniyede bir ve sekmeye geri dönüldüğünde güncellenir.
- Kapasite kontrolü yapılır (varsayılan 30 kişi).
- **Yönetici İşlemi:** PIN ile giriş yapılır. Dolu saatlerde ad ve telefon görünür, "İptal Et / Boşalt" ve "Excel (CSV) İndir" butonları açılır. İptal edilen kayıt silinmez, tabloda "İptal" olarak işaretlenir.
- 10 dakikada 5 hatalı PIN denemesinden sonra giriş geçici olarak kapanır.

## Ayarlar (`google-apps-script/Kod.gs` başındaki `AYARLAR`)

| Ayar | Açıklama |
|---|---|
| `TABLO_ID` | Kayıtların tutulduğu Google E-Tablo |
| `YONETICI_PIN` | Yedek PIN. Asıl PIN'i Komut Dosyası Özellikleri'ne yazın |
| `KAPASITE` | En fazla katılımcı sayısı |
| `ILERI_GUN_SINIRI` | Kaç gün sonrasına kadar rezervasyon alınacağı |
| `SAATLER` | Saat blokları |

Kodda değişiklik yaparsanız: **Dağıt → Dağıtımları yönet → Düzenle (kalem) → Sürüm: Yeni sürüm → Dağıt.** Böylece link değişmez.

> ⚠️ Depo herkese açıksa gerçek PIN'i `Kod.gs` içine yazıp GitHub'a göndermeyin. Komut Dosyası Özellikleri'ni kullanın.
