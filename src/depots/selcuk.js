const axios = require('axios');

const BASE_URL = 'https://webdepo.selcukecza.com.tr';

const COMMON_HEADERS = {
  'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
};

const AJAX_HEADERS = {
  ...COMMON_HEADERS,
  'accept': 'application/json, text/javascript, */*; q=0.01',
  'x-requested-with': 'XMLHttpRequest',
};

class SelcukDepot {
  constructor(credentials) {
    // credentials: { hesapKodu, kullaniciAdi, sifre }
    this.name = 'Selçuk Ecza';
    this.credentials = credentials;
    this.cookies = null;
  }

  /**
   * Cookie string'inden belirli bir cookie değerini çıkarır
   */
  _extractCookies(setCookieHeaders) {
    if (!setCookieHeaders) return '';
    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    return headers.map(c => c.split(';')[0]).join('; ');
  }

  /**
   * ASP.NET login formu ile giriş yap.
   * 1) GET /Login.aspx → session cookie + __VIEWSTATE al
   * 2) POST /Login.aspx → form data gönder → auth cookie'leri al
   */
  async login() {
    if (this.cookies) return { success: true };

    const { hesapKodu, kullaniciAdi, sifre } = this.credentials;
    if (!hesapKodu || !kullaniciAdi || !sifre) {
      return { success: false, error: 'Hesap kodu, kullanıcı adı ve şifre gerekli' };
    }

    try {
      // 1) Login sayfasını al → session cookie + __VIEWSTATE
      const pageRes = await axios.get(`${BASE_URL}/Login.aspx`, {
        headers: { 'user-agent': COMMON_HEADERS['user-agent'] },
        timeout: 6000,
      });

      const sessionCookies = this._extractCookies(pageRes.headers['set-cookie']);
      const html = pageRes.data;

      // __VIEWSTATE ve __VIEWSTATEGENERATOR'ı HTML'den çek
      const vsMatch = html.match(/name="__VIEWSTATE"[^>]*value="([^"]*)"/);
      const vsgMatch = html.match(/name="__VIEWSTATEGENERATOR"[^>]*value="([^"]*)"/);

      if (!vsMatch) {
        return { success: false, error: 'Login sayfası parse edilemedi' };
      }

      // 2) Login POST
      const formData = new URLSearchParams({
        __VIEWSTATE: vsMatch[1],
        __VIEWSTATEGENERATOR: vsgMatch ? vsgMatch[1] : '',
        txtEczaneKodu: hesapKodu,
        txtKullaniciAdi: kullaniciAdi,
        txtSifre: sifre,
        btnGiris: 'Giriş',
      }).toString();

      const loginRes = await axios.post(`${BASE_URL}/Login.aspx`, formData, {
        headers: {
          ...COMMON_HEADERS,
          cookie: sessionCookies,
          origin: BASE_URL,
          referer: `${BASE_URL}/Login.aspx`,
        },
        maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 400,
        timeout: 6000,
      });

      const loginCookies = this._extractCookies(loginRes.headers['set-cookie']);

      if (!loginCookies || !loginCookies.includes('BoyutAuth')) {
        return { success: false, error: 'Giriş başarısız — kullanıcı adı veya şifre hatalı olabilir' };
      }

      // Cookie'leri birleştir
      this.cookies = sessionCookies + '; ' + loginCookies;
      return { success: true };
    } catch (err) {
      return { success: false, error: `Login hatası: ${err.message}` };
    }
  }

  /**
   * Manuel cookie set etme (DevTools'tan kopyalanan cookie string)
   */
  setCookies(cookieString) {
    this.cookies = cookieString;
  }

  /**
   * Cookie'leri temizle (re-login için)
   */
  clearCookies() {
    this.cookies = null;
  }

  /**
   * İlaç arama — barkod veya isim ile
   */
  async search(query) {
    if (!this.cookies) {
      const loginResult = await this.login();
      if (!loginResult.success) {
        return { depot: this.name, error: loginResult.error, results: [] };
      }
    }

    try {
      const res = await axios.post(
        `${BASE_URL}/Siparis/hizlisiparis-ajax.aspx`,
        new URLSearchParams({
          action: 'GetUrunler',
          searchText: query,
          isInculude: 'false',
          isStoktakiler: 'false',
          siralama: 'ilacASC',
          marka: '',
          baslangicSayfasi: '0',
          topRowNum: '0',
          sayfaMaxRowAdet: '20',
          s: 's',
        }).toString(),
        {
          headers: {
            ...AJAX_HEADERS,
            cookie: this.cookies,
            origin: BASE_URL,
            referer: `${BASE_URL}/Siparis/hizlisiparis.aspx`,
          },
          timeout: 6000,
        }
      );

      const data = res.data;

      // Session expire olmuşsa re-login dene
      if (data.hataId && data.hataId !== 0) {
        // İlk denemede hata aldıysa cookie'leri temizleyip tekrar login dene
        this.clearCookies();
        const loginResult = await this.login();
        if (!loginResult.success) {
          return { depot: this.name, error: loginResult.error, results: [] };
        }
        // Tekrar arama yap
        return this._doSearch(query);
      }

      const parsed = this._parseResults(data);
      return await this._fetchMFAndReturn(parsed.results);
    } catch (err) {
      return { depot: this.name, error: err.message, results: [] };
    }
  }

  async _doSearch(query) {
    try {
      const res = await axios.post(
        `${BASE_URL}/Siparis/hizlisiparis-ajax.aspx`,
        new URLSearchParams({
          action: 'GetUrunler',
          searchText: query,
          isInculude: 'false',
          isStoktakiler: 'false',
          siralama: 'ilacASC',
          marka: '',
          baslangicSayfasi: '0',
          topRowNum: '0',
          sayfaMaxRowAdet: '20',
          s: 's',
        }).toString(),
        {
          headers: {
            ...AJAX_HEADERS,
            cookie: this.cookies,
            origin: BASE_URL,
            referer: `${BASE_URL}/Siparis/hizlisiparis.aspx`,
          },
          timeout: 6000,
        }
      );
      const parsed = this._parseResults(res.data);
      return await this._fetchMFAndReturn(parsed.results);
    } catch (err) {
      return { depot: this.name, error: err.message, results: [] };
    }
  }

  /**
   * Gerçek fiyat hesaplama — IlacFiyatHesapla action'u ile net tutar al
   * Etiket fiyatı değil, iskontolar+KDV dahil eczacının gerçek maliyetini döndürür
   */
  async calculatePrice(kod, ilacTip, etiketFiyati, satisSekli = 'A6') {
    if (!this.cookies) return null;
    try {
      // etiketFiyati Turkish format: "99,93" veya "1.299,93"
      // onerilenFiyat dot format: "99.93" veya "1299.93"
      const onerilenFiyat = etiketFiyati.replace(/\./g, '').replace(',', '.');
      console.log(`[SELÇUK calculatePrice] kod=${kod} satisSekli=${satisSekli} etiket=${etiketFiyati} onerilen=${onerilenFiyat}`);
      const res = await axios.post(
        `${BASE_URL}/Ilac/IlacGetir-ajax.aspx`,
        new URLSearchParams({
          action: 'IlacFiyatHesapla',
          kod: kod,
          miktar: '1',
          satisSekli: satisSekli,
          etiketFiyati: etiketFiyati,
          miad: 'undefined',
          onerilenFiyat: onerilenFiyat,
          ILACTIP: ilacTip || 'B',
          ekstraMf: '',
          ekstraIskonto: '',
        }).toString(),
        {
          headers: {
            ...AJAX_HEADERS,
            cookie: this.cookies,
            origin: BASE_URL,
            referer: `${BASE_URL}/Siparis/hizlisiparis.aspx`,
          },
          timeout: 6000,
        }
      );
      console.log(`[SELÇUK calculatePrice] response hataId=${res.data.hataId} netTutar=${res.data.obj?.netTutar}`);
      if (res.data.hataId === 0 && res.data.obj) {
        return {
          netTutar: res.data.obj.netTutar,
          birimFiyat: res.data.obj.birimFiyat,
          depocuFiyati: res.data.obj.depocuFiyati,
        };
      }
      return null;
    } catch (err) {
      console.error(`[SELÇUK calculatePrice] HATA:`, err.message);
      return null;
    }
  }

  async _fetchMFAndReturn(resultsArray) {
      const topItems = resultsArray.slice(0, 10);

      // AŞAMA 1: GetIlacDetay — MF verisi + satisSekli al
      const detailPromises = topItems.map(item => {
         return this.getProductDetail(item.kodu, item.ilacTip).catch(e => null);
      });
      const details = await Promise.all(detailPromises);

      // MF ve Barkod verisi doldur
      details.forEach((d, i) => {
         if (d) {
            if (d.barkod) topItems[i].barkod = d.barkod;
            
            if (d.kampanyalar && d.kampanyalar.length > 0) {
               let mfs = [];
               d.kampanyalar.forEach(k => {
                  if (!k.mf) return;
                  const rawMf = String(k.mf);
                  const matches = rawMf.match(/(\d+\+\d+)/g);
                  if (matches) {
                     matches.forEach(m => {
                        if (!mfs.includes(m)) mfs.push(m);
                     });
                  }
               });
               if (mfs.length > 0) {
                  topItems[i].malFazlasi = mfs.join(' / ');
               }
            }
         }
      });

      // AŞAMA 2: IlacFiyatHesapla — Gerçek net tutar al
      console.log(`[SELÇUK] Aşama 2: ${topItems.length} ürün için fiyat hesaplama başlıyor...`);
      const pricePromises = topItems.map((item, i) => {
        const detail = details[i];
        const satisSekli = detail?.kampanyalar?.[0]?.satisSekli || 'A6';
        console.log(`[SELÇUK] item[${i}] kodu=${item.kodu} fiyat=${item.fiyat} satisSekli=${satisSekli} detail=${!!detail}`);
        return this.calculatePrice(item.kodu, item.ilacTip, item.fiyat, satisSekli)
          .catch(() => null);
      });
      const prices = await Promise.all(pricePromises);

      // Net Tutar ile fiyat güncelle
      prices.forEach((p, i) => {
        if (p && p.netTutar > 0) {
          topItems[i].etiketFiyat = topItems[i].fiyat; // Orijinali sakla
          topItems[i].fiyatNum = parseFloat(p.netTutar.toFixed(2));
          topItems[i].fiyat = p.netTutar.toFixed(2).replace('.', ',');
        }
      });

      return { depot: this.name, error: null, results: resultsArray };
  }

  _parseResults(data) {
    const urunler = data.obj?.urunler || [];
    console.log("SELCUK URUNLER: ", urunler);
    const stokGosterilsin = data.obj?.stokGosterilsin ?? false;
    return {
      depot: this.name,
      error: null,
      results: urunler.map(u => ({
        kodu: u.kodu,
        ad: u.ad,
        fiyat: u.fiyat,
        fiyatNum: parseFloat(u.fiyat.replace('.', '').replace(',', '.')),
        stok: u.stok,
        // stokDurumu: 1 = stokta var, 0 = stokta yok
        // stok sayısı her zaman güvenilir değil (stokGosterilsin: false olabilir)
        stokVar: u.stokDurumu === 1,
        stokGosterilsin,
        ilacTip: u.ILACTIP,
        imgUrl: u.imgUrl,
        malFazlasi: '',
      })),
    };
  }
  // İlaç detay sayfasından barkod dahil bilgi getir
  async getProductDetail(kod, ilacTip) {
    if (!this.cookies) return null;
    try {
      const res = await axios.post(
        `${BASE_URL}/Ilac/IlacGetir-ajax.aspx`,
        new URLSearchParams({
          action: 'GetIlacDetay',
          kod: kod,
          isEsdeger: 'false',
          esdeger: '',
          isJenerik: 'false',
          jenerikId: '',
          tip: 'null',
          ILACTIP: ilacTip || 'B',
          kampKodu: '',
        }).toString(),
        {
          headers: {
            ...AJAX_HEADERS,
            cookie: this.cookies,
            origin: BASE_URL,
            referer: `${BASE_URL}/Siparis/hizlisiparis.aspx`,
          },
          timeout: 6000,
        }
      );
      const data = res.data;
      if (data.hataId === 0 && data.obj) {
        return {
          kodu: data.obj.kod,
          barkod: data.obj.barkod || null,
          ad: data.obj.ad,
          kampanyalar: data.obj.grdKampanyalar || [],
          isMF: data.obj.isMF || false
        };
      }
      return null;
    } catch (err) {
      return null;
    }
  }
}

module.exports = SelcukDepot;
