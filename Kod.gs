/**
 * Bursa İl Millî Eğitim Müdürlüğü YEĞİTEK Birimi
 * BTSO Eğitim Vadisi - Canva Sınıfı Rezervasyon Sistemi
 *
 * Veri katmanı (Google Apps Script). Web sayfası GitHub Pages'te durur,
 * kayıtlar bu kod aracılığıyla Google E-Tablo'daki "Rezervasyonlar"
 * sayfasına yazılır. Apps Script'e yalnızca bu dosyayı yapıştırmanız yeterlidir.
 */

var AYARLAR = {
  // Kayıtların tutulduğu Google E-Tablo'nun kimliği (linkteki /d/ ile /edit arasındaki kısım).
  // Kod doğrudan E-Tablo'nun içinden (Uzantılar > Apps Script) açıldıysa boş bırakılabilir.
  TABLO_ID: '1m8okHB0eAxoZrhW9Q-iNMniK5J25nhYOgDmCYfNh-ZI',

  SAYFA_ADI: 'Rezervasyonlar',

  // Yönetici PIN kodu. MUTLAKA DEĞİŞTİRİN.
  // Daha güvenli yol: Proje Ayarları > Komut Dosyası Özellikleri bölümüne
  // "YONETICI_PIN" adında bir özellik ekleyin; tanımlıysa bu değer yerine o kullanılır.
  YONETICI_PIN: '1234',

  // Sınıfın en fazla kaç kişi alabildiği (katılımcı sayısı üst sınırı)
  KAPASITE: 30,

  // Bugünden itibaren en fazla kaç gün sonrasına rezervasyon yapılabilir
  ILERI_GUN_SINIRI: 90,

  SAAT_DILIMI: 'Europe/Istanbul',

  // Seçilebilir saat blokları (12:00-13:00 öğle arası olduğu için listede yok)
  SAATLER: [
    '09:00-10:00',
    '10:00-11:00',
    '11:00-12:00',
    '13:00-14:00',
    '14:00-15:00',
    '15:00-16:00',
    '16:00-17:00'
  ]
};

var BASLIKLAR = [
  'Kayıt No',
  'Grup No',
  'Tarih',
  'Saat',
  'Ad Soyad',
  'Okul / Kurum',
  'Telefon',
  'Kullanım Amacı / Eğitim Konusu',
  'Katılımcı Sayısı',
  'Kayıt Zamanı',
  'Durum',
  'İptal Zamanı'
];

var SUTUN = {
  KAYIT_NO: 0,
  GRUP_NO: 1,
  TARIH: 2,
  SAAT: 3,
  AD: 4,
  KURUM: 5,
  TELEFON: 6,
  AMAC: 7,
  KATILIMCI: 8,
  KAYIT_ZAMANI: 9,
  DURUM: 10,
  IPTAL_ZAMANI: 11
};

var DURUM_AKTIF = 'Aktif';
var DURUM_IPTAL = 'İptal';

/* ------------------------------------------------------------------ */
/* Web arayüzü (GitHub Pages'teki sayfa buraya bağlanır)               */
/* ------------------------------------------------------------------ */

/** Linki tarayıcıda açınca sistemin çalıştığını gösterir. */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    durum: 'çalışıyor',
    sistem: 'BTSO Eğitim Vadisi - Canva Sınıfı Rezervasyon Sistemi',
    not: 'Bu linki index.html içindeki API_URL satırına yapıştırın.'
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * GitHub Pages gibi başka bir adresteki sayfanın kullandığı JSON arayüzü.
 * İstek gövdesi: {"islem": "haftayiGetir", "args": [...]}
 */
function doPost(e) {
  var izinli = {
    haftayiGetir: haftayiGetir,
    rezervasyonYap: rezervasyonYap,
    yoneticiGiris: yoneticiGiris,
    rezervasyonIptal: rezervasyonIptal,
    csvOlustur: csvOlustur
  };
  var cevap;
  try {
    var istek = JSON.parse(e && e.postData ? e.postData.contents : '{}');
    var fonksiyon = Object.prototype.hasOwnProperty.call(izinli, istek.islem) ? izinli[istek.islem] : null;
    if (!fonksiyon) {
      cevap = { basari: false, hata: 'Bilinmeyen işlem.' };
    } else {
      var argumanlar = Array.isArray(istek.args) ? istek.args : [];
      cevap = { basari: true, veri: fonksiyon.apply(null, argumanlar) };
    }
  } catch (hata) {
    cevap = { basari: false, hata: String(hata && hata.message ? hata.message : hata) };
  }
  return ContentService.createTextOutput(JSON.stringify(cevap))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * İlk kurulumda bir kez elle çalıştırın: sayfayı oluşturur ve
 * Google'ın izin ekranını açar.
 */
function kurulum() {
  var sayfa = sayfaGetir_();
  Logger.log('Kurulum tamam. Sayfa: ' + sayfa.getName());
}

/* ------------------------------------------------------------------ */
/* İstemciden çağrılan fonksiyonlar                                    */
/* ------------------------------------------------------------------ */

/**
 * Bir haftanın (Pazartesi-Cuma) doluluk bilgisini döndürür.
 * pin geçerliyse yönetici için gizli alanlar (ad, telefon) da eklenir.
 */
function haftayiGetir(pazartesi, pin) {
  var simdi = simdi_();

  if (tarihGecerli_(pazartesi)) {
    pazartesi = haftaninPazartesisi_(pazartesi);
  } else {
    pazartesi = varsayilanPazartesi_(simdi.tarih);
  }

  var gunler = [];
  for (var i = 0; i < 5; i++) {
    gunler.push(gunEkle_(pazartesi, i));
  }

  var yonetici = false;
  if (pin) {
    yonetici = pinKontrol_(pin).ok;
  }

  var kayitlar = {};
  tumKayitlar_(sayfaGetir_()).forEach(function (satir) {
    if (satir[SUTUN.DURUM] !== DURUM_AKTIF) return;
    if (gunler.indexOf(satir[SUTUN.TARIH]) < 0) return;

    var bilgi = {
      kayitNo: satir[SUTUN.KAYIT_NO],
      kurum: satir[SUTUN.KURUM],
      amac: satir[SUTUN.AMAC]
    };
    if (yonetici) {
      bilgi.ad = satir[SUTUN.AD];
      bilgi.telefon = satir[SUTUN.TELEFON];
      bilgi.katilimci = satir[SUTUN.KATILIMCI];
      bilgi.kayitZamani = satir[SUTUN.KAYIT_ZAMANI];
      bilgi.grupNo = satir[SUTUN.GRUP_NO];
    }
    kayitlar[satir[SUTUN.TARIH] + '|' + satir[SUTUN.SAAT]] = bilgi;
  });

  return {
    pazartesi: pazartesi,
    gunler: gunler,
    saatler: AYARLAR.SAATLER,
    bugun: simdi.tarih,
    simdiSaat: simdi.saat,
    sonTarih: gunEkle_(simdi.tarih, AYARLAR.ILERI_GUN_SINIRI),
    kapasite: AYARLAR.KAPASITE,
    kayitlar: kayitlar,
    yonetici: yonetici
  };
}

/**
 * Rezervasyon oluşturur. LockService ile aynı anda gelen istekler sıraya
 * alınır; ilk gelen kaydedilir, sonraki "az önce doldu" uyarısı alır.
 */
function rezervasyonYap(veri) {
  var temiz = formuDogrula_(veri);
  if (temiz.hata) {
    return { ok: false, mesaj: temiz.hata };
  }

  var kilit = LockService.getScriptLock();
  if (!kilit.tryLock(20000)) {
    return { ok: false, mesaj: 'Sistem şu anda yoğun. Lütfen birkaç saniye sonra tekrar deneyin.' };
  }

  try {
    // Kilit beklenirken saat geçmiş olabilir; zaman kontrolünü kilit içinde tekrarla.
    var zamanHatasi = zamanKontrol_(temiz.tarih, temiz.saatler, simdi_());
    if (zamanHatasi) {
      return { ok: false, mesaj: zamanHatasi };
    }

    var sayfa = sayfaGetir_();
    var dolu = {};
    tumKayitlar_(sayfa).forEach(function (satir) {
      if (satir[SUTUN.DURUM] === DURUM_AKTIF && satir[SUTUN.TARIH] === temiz.tarih) {
        dolu[satir[SUTUN.SAAT]] = true;
      }
    });

    var cakisan = temiz.saatler.filter(function (saat) {
      return dolu[saat];
    });
    if (cakisan.length > 0) {
      return {
        ok: false,
        doldu: true,
        cakisan: cakisan,
        mesaj: 'Bu saat aralığı az önce doldu (' + cakisan.join(', ') + '). Lütfen başka bir saat seçin.'
      };
    }

    var tz = AYARLAR.SAAT_DILIMI;
    var kayitZamani = Utilities.formatDate(new Date(), tz, 'dd.MM.yyyy HH:mm:ss');
    var grupNo = 'G' + Utilities.formatDate(new Date(), tz, 'yyMMddHHmmss') + '-' + kisaKimlik_().substring(0, 4);

    var satirlar = temiz.saatler.map(function (saat) {
      return [
        kisaKimlik_(),
        grupNo,
        temiz.tarih,
        saat,
        hucreGuvenli_(temiz.ad),
        hucreGuvenli_(temiz.kurum),
        temiz.telefon,
        hucreGuvenli_(temiz.amac),
        String(temiz.katilimci),
        kayitZamani,
        DURUM_AKTIF,
        ''
      ];
    });

    var baslangicSatiri = sayfa.getLastRow() + 1;
    var gerekenSon = baslangicSatiri + satirlar.length - 1;
    if (gerekenSon > sayfa.getMaxRows()) {
      sayfa.insertRowsAfter(sayfa.getMaxRows(), gerekenSon - sayfa.getMaxRows() + 100);
    }
    sayfa.getRange(baslangicSatiri, 1, satirlar.length, BASLIKLAR.length)
      .setNumberFormat('@')
      .setValues(satirlar);
    SpreadsheetApp.flush();

    return {
      ok: true,
      grupNo: grupNo,
      tarih: temiz.tarih,
      saatler: temiz.saatler,
      kurum: temiz.kurum
    };
  } finally {
    kilit.releaseLock();
  }
}

/** Yönetici PIN kontrolü. */
function yoneticiGiris(pin) {
  return pinKontrol_(pin);
}

/** Yönetici: tek bir saat bloğunu iptal eder (tekrar "Müsait" yapar). */
function rezervasyonIptal(pin, kayitNo) {
  var kontrol = pinKontrol_(pin);
  if (!kontrol.ok) return kontrol;

  var kilit = LockService.getScriptLock();
  if (!kilit.tryLock(20000)) {
    return { ok: false, mesaj: 'Sistem şu anda yoğun. Lütfen tekrar deneyin.' };
  }

  try {
    var sayfa = sayfaGetir_();
    var satirlar = tumKayitlar_(sayfa);
    for (var i = 0; i < satirlar.length; i++) {
      if (satirlar[i][SUTUN.KAYIT_NO] === String(kayitNo) && satirlar[i][SUTUN.DURUM] === DURUM_AKTIF) {
        var satirNo = i + 2;
        var iptalZamani = Utilities.formatDate(new Date(), AYARLAR.SAAT_DILIMI, 'dd.MM.yyyy HH:mm:ss');
        sayfa.getRange(satirNo, SUTUN.DURUM + 1, 1, 2).setValues([[DURUM_IPTAL, iptalZamani]]);
        SpreadsheetApp.flush();
        return { ok: true };
      }
    }
    return { ok: false, mesaj: 'Kayıt bulunamadı veya zaten iptal edilmiş.' };
  } finally {
    kilit.releaseLock();
  }
}

/** Yönetici: tüm kayıtları Excel uyumlu CSV metni olarak döndürür. */
function csvOlustur(pin) {
  var kontrol = pinKontrol_(pin);
  if (!kontrol.ok) return kontrol;

  var satirlar = [BASLIKLAR].concat(tumKayitlar_(sayfaGetir_()));
  var csv = satirlar.map(function (satir) {
    return satir.map(csvHucre_).join(';');
  }).join('\r\n');

  return {
    ok: true,
    csv: csv,
    dosyaAdi: 'canva-sinifi-rezervasyonlar-' + simdi_().tarih + '.csv'
  };
}

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

function sayfaGetir_() {
  var ss = AYARLAR.TABLO_ID
    ? SpreadsheetApp.openById(AYARLAR.TABLO_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  var sayfa = ss.getSheetByName(AYARLAR.SAYFA_ADI);
  if (sayfa) return sayfa;

  try {
    sayfa = ss.insertSheet(AYARLAR.SAYFA_ADI);
  } catch (e) {
    // Aynı anda başka bir istek oluşturmuş olabilir.
    sayfa = ss.getSheetByName(AYARLAR.SAYFA_ADI);
    if (sayfa) return sayfa;
    throw e;
  }
  sayfa.getRange(1, 1, sayfa.getMaxRows(), BASLIKLAR.length).setNumberFormat('@');
  sayfa.getRange(1, 1, 1, BASLIKLAR.length)
    .setValues([BASLIKLAR])
    .setFontWeight('bold')
    .setBackground('#1e3a8a')
    .setFontColor('#ffffff');
  sayfa.setFrozenRows(1);
  sayfa.autoResizeColumns(1, BASLIKLAR.length);
  return sayfa;
}

/** Tüm veri satırlarını metin olarak döndürür (başlık hariç). */
function tumKayitlar_(sayfa) {
  var son = sayfa.getLastRow();
  if (son < 2) return [];
  return sayfa.getRange(2, 1, son - 1, BASLIKLAR.length).getDisplayValues().map(function (satir) {
    return satir.map(function (hucre) {
      return String(hucre).trim();
    });
  });
}

function pinGetir_() {
  var ozellik = PropertiesService.getScriptProperties().getProperty('YONETICI_PIN');
  return ozellik ? String(ozellik) : String(AYARLAR.YONETICI_PIN);
}

/** Kaba kuvvet denemelerine karşı: 10 dakikada en fazla 5 hatalı deneme. */
function pinKontrol_(pin) {
  var onbellek = CacheService.getScriptCache();
  var hata = Number(onbellek.get('pin_hata') || 0);
  if (hata >= 5) {
    return { ok: false, mesaj: 'Çok fazla hatalı deneme yapıldı. Lütfen 10 dakika sonra tekrar deneyin.' };
  }
  if (String(pin || '') === pinGetir_()) {
    if (hata > 0) onbellek.remove('pin_hata');
    return { ok: true };
  }
  onbellek.put('pin_hata', String(hata + 1), 600);
  return { ok: false, mesaj: 'PIN kodu hatalı.' };
}

function formuDogrula_(veri) {
  if (!veri || typeof veri !== 'object') return { hata: 'Geçersiz istek.' };

  var tarih = String(veri.tarih || '');
  if (!tarihGecerli_(tarih)) return { hata: 'Geçersiz tarih.' };

  var gun = tarihParcala_(tarih).getUTCDay();
  if (gun === 0 || gun === 6) return { hata: 'Yalnızca hafta içi (Pazartesi-Cuma) günler seçilebilir.' };

  var saatler = Array.isArray(veri.saatler) ? veri.saatler.map(String) : [];
  if (saatler.length === 0) return { hata: 'En az bir saat aralığı seçmelisiniz.' };

  var tekil = {};
  for (var i = 0; i < saatler.length; i++) {
    if (AYARLAR.SAATLER.indexOf(saatler[i]) < 0) return { hata: 'Geçersiz saat aralığı: ' + saatler[i] };
    if (tekil[saatler[i]]) return { hata: 'Aynı saat birden fazla kez seçilmiş.' };
    tekil[saatler[i]] = true;
  }
  saatler.sort(function (a, b) {
    return AYARLAR.SAATLER.indexOf(a) - AYARLAR.SAATLER.indexOf(b);
  });
  for (var j = 1; j < saatler.length; j++) {
    if (saatler[j - 1].split('-')[1] !== saatler[j].split('-')[0]) {
      return { hata: 'Yalnızca ardışık saat blokları birlikte seçilebilir.' };
    }
  }

  var zamanHatasi = zamanKontrol_(tarih, saatler, simdi_());
  if (zamanHatasi) return { hata: zamanHatasi };

  var ad = metinTemizle_(veri.ad);
  var kurum = metinTemizle_(veri.kurum);
  var amac = metinTemizle_(veri.amac);
  var telefon = String(veri.telefon || '').replace(/[^\d]/g, '');
  var katilimci = Number(veri.katilimci);

  if (ad.length < 3 || ad.length > 80) return { hata: 'Lütfen geçerli bir ad soyad girin.' };
  if (kurum.length < 2 || kurum.length > 150) return { hata: 'Lütfen okul / kurum adını girin.' };
  if (telefon.length < 10 || telefon.length > 13) return { hata: 'Lütfen geçerli bir telefon numarası girin (örn. 05xx xxx xx xx).' };
  if (amac.length < 3 || amac.length > 300) return { hata: 'Lütfen kullanım amacını / eğitim konusunu girin.' };
  if (!isFinite(katilimci) || Math.floor(katilimci) !== katilimci || katilimci < 1) {
    return { hata: 'Katılımcı sayısı en az 1 olmalıdır.' };
  }
  if (katilimci > AYARLAR.KAPASITE) {
    return { hata: 'Katılımcı sayısı sınıf kapasitesini (' + AYARLAR.KAPASITE + ' kişi) aşamaz.' };
  }

  return {
    tarih: tarih,
    saatler: saatler,
    ad: ad,
    kurum: kurum,
    telefon: telefon,
    amac: amac,
    katilimci: katilimci
  };
}

function zamanKontrol_(tarih, saatler, simdi) {
  if (tarih < simdi.tarih) return 'Geçmiş bir tarih için rezervasyon yapılamaz.';
  if (tarih > gunEkle_(simdi.tarih, AYARLAR.ILERI_GUN_SINIRI)) {
    return 'En fazla ' + AYARLAR.ILERI_GUN_SINIRI + ' gün sonrası için rezervasyon yapılabilir.';
  }
  if (tarih === simdi.tarih) {
    for (var i = 0; i < saatler.length; i++) {
      if (saatler[i].split('-')[0] <= simdi.saat) {
        return 'Başlangıç saati geçmiş bir blok seçilemez (' + saatler[i] + ').';
      }
    }
  }
  return '';
}

function metinTemizle_(deger) {
  return String(deger || '').replace(/\s+/g, ' ').trim();
}

/** E-Tablo'da formül olarak yorumlanmasını engeller. */
function hucreGuvenli_(metin) {
  return /^[=+\-@]/.test(metin) ? "'" + metin : metin;
}

function csvHucre_(deger) {
  var metin = String(deger === null || deger === undefined ? '' : deger);
  if (/^[=+\-@]/.test(metin)) metin = "'" + metin;
  return '"' + metin.replace(/"/g, '""') + '"';
}

function kisaKimlik_() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase();
}

function simdi_() {
  var d = new Date();
  return {
    tarih: Utilities.formatDate(d, AYARLAR.SAAT_DILIMI, 'yyyy-MM-dd'),
    saat: Utilities.formatDate(d, AYARLAR.SAAT_DILIMI, 'HH:mm')
  };
}

/* Tarih hesapları saat diliminden bağımsız olsun diye UTC üzerinden yapılır. */

function iki_(n) {
  return (n < 10 ? '0' : '') + n;
}

function tarihParcala_(metin) {
  var p = metin.split('-');
  return new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
}

function tarihYaz_(d) {
  return d.getUTCFullYear() + '-' + iki_(d.getUTCMonth() + 1) + '-' + iki_(d.getUTCDate());
}

function tarihGecerli_(metin) {
  if (typeof metin !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(metin)) return false;
  return tarihYaz_(tarihParcala_(metin)) === metin;
}

function gunEkle_(metin, gun) {
  var d = tarihParcala_(metin);
  d.setUTCDate(d.getUTCDate() + gun);
  return tarihYaz_(d);
}

function haftaninPazartesisi_(metin) {
  var g = tarihParcala_(metin).getUTCDay();
  return gunEkle_(metin, g === 0 ? -6 : 1 - g);
}

/** Hafta sonu açılırsa bir sonraki haftayı göster. */
function varsayilanPazartesi_(bugun) {
  var g = tarihParcala_(bugun).getUTCDay();
  if (g === 6) return gunEkle_(bugun, 2);
  if (g === 0) return gunEkle_(bugun, 1);
  return haftaninPazartesisi_(bugun);
}
