const axios = require('axios');

const BASE_URL = 'http://webdepo.nevzatecza.com.tr';

const COMMON_HEADERS = {
  'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
};

const AJAX_HEADERS = {
  ...COMMON_HEADERS,
  'accept': 'application/json, text/javascript, */*; q=0.01',
  'x-requested-with': 'XMLHttpRequest',
};

class NevzatDepot {
  constructor(credentials) {
    // credentials: { hesapKodu, kullaniciAdi, sifre }
    this.name = 'Nevzat Ecza';
    this.credentials = credentials;
    this.cookies = null;
  }

  _extractCookies(setCookieHeaders) {
    if (!setCookieHeaders) return '';
    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    return headers.map(c => c.split(';')[0]).join('; ');
  }

  async login() {
    if (this.cookies) return { success: true };

    const { hesapKodu, kullaniciAdi, sifre } = this.credentials;
    if (!hesapKodu || !kullaniciAdi || !sifre) {
      return { success: false, error: 'Hesap kodu, kullanıcı adı ve şifre gerekli' };
    }

    try {
      const pageRes = await axios.get(`${BASE_URL}/Login.aspx`, {
        headers: { 'user-agent': COMMON_HEADERS['user-agent'] },
        timeout: 6000,
      });

      const sessionCookies = this._extractCookies(pageRes.headers['set-cookie']);
      const html = pageRes.data;

      const vsMatch = html.match(/name="__VIEWSTATE"[^>]*value="([^"]*)"/);
      const vsgMatch = html.match(/name="__VIEWSTATEGENERATOR"[^>]*value="([^"]*)"/);
      const evMatch = html.match(/name="__EVENTVALIDATION"[^>]*value="([^"]*)"/);

      if (!vsMatch) {
        return { success: false, error: 'Login sayfası parse edilemedi' };
      }

      const formParams = {
        __VIEWSTATE: vsMatch[1],
        __VIEWSTATEGENERATOR: vsgMatch ? vsgMatch[1] : '',
        txtEczaneKodu: hesapKodu,
        txtKullaniciAdi: kullaniciAdi,
        txtSifre: sifre,
        btnGiris: 'Giriş',
      };
      if (evMatch) formParams.__EVENTVALIDATION = evMatch[1];

      const formData = new URLSearchParams(formParams).toString();

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

      this.cookies = sessionCookies + '; ' + loginCookies;
      return { success: true };
    } catch (err) {
      return { success: false, error: `Login hatası: ${err.message}` };
    }
  }

  setCookies(cookieString) {
    this.cookies = cookieString;
  }

  clearCookies() {
    this.cookies = null;
  }

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

      if (data.hataId && data.hataId !== 0) {
        this.clearCookies();
        const loginResult = await this.login();
        if (!loginResult.success) {
          return { depot: this.name, error: loginResult.error, results: [] };
        }
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

  /**
   * Gerçek fiyat hesaplama — IlacFiyatHesapla action'u ile net tutar al
   */
  async calculatePrice(kod, ilacTip, etiketFiyati, satisSekli = 'A6') {
    if (!this.cookies) return null;
    try {
      const onerilenFiyat = etiketFiyati.replace(/\./g, '').replace(',', '.');
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
      if (res.data.hataId === 0 && res.data.obj) {
        return {
          netTutar: res.data.obj.netTutar,
          birimFiyat: res.data.obj.birimFiyat,
          depocuFiyati: res.data.obj.depocuFiyati,
        };
      }
      return null;
    } catch (err) {
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

      // MF verisi doldur (mevcut mantık KORUNUYOR)
      details.forEach((d, i) => {
         if (d && d.kampanyalar && d.kampanyalar.length > 0) {
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
      });

      // AŞAMA 2: IlacFiyatHesapla — Gerçek net tutar al
      const pricePromises = topItems.map((item, i) => {
        const detail = details[i];
        const satisSekli = detail?.kampanyalar?.[0]?.satisSekli || 'A6';
        return this.calculatePrice(item.kodu, item.ilacTip, item.fiyat, satisSekli)
          .catch(() => null);
      });
      const prices = await Promise.all(pricePromises);

      // Net Tutar ile fiyat güncelle
      prices.forEach((p, i) => {
        if (p && p.netTutar > 0) {
          topItems[i].etiketFiyat = topItems[i].fiyat;
          topItems[i].fiyatNum = parseFloat(p.netTutar.toFixed(2));
          topItems[i].fiyat = p.netTutar.toFixed(2).replace('.', ',');
        }
      });

      return { depot: this.name, error: null, results: resultsArray };
  }

  _parseResults(data) {
    const urunler = data.obj?.urunler || [];
    if (urunler.length > 0) console.log("NEVZAT İLK ÜRÜN TÜM ALANLAR:", JSON.stringify(urunler[0], null, 2));
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
        stokVar: u.stokDurumu === 1,
        stokGosterilsin,
        ilacTip: u.ILACTIP,
        imgUrl: u.imgUrl,
        malFazlasi: '',
      })),
    };
  }
}

module.exports = NevzatDepot;
