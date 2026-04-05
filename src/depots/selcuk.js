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

const AXIOS_NO_PROXY = {
  proxy: false,
};

class SelcukDepot {
  constructor(credentials) {
    // credentials: { hesapKodu, kullaniciAdi, sifre }
    this.name = 'Selçuk Ecza';
    this.credentials = credentials;
    this.cookies = null;
  }

  /**
   * Cookie string'inden belirli bir cookie deÄŸerini Ã§Ä±karÄ±r
   */
  _extractCookies(setCookieHeaders) {
    if (!setCookieHeaders) return '';
    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    return headers.map(c => c.split(';')[0]).join('; ');
  }

  /**
   * ASP.NET login formu ile giriÅŸ yap.
   * 1) GET /Login.aspx â†’ session cookie + __VIEWSTATE al
   * 2) POST /Login.aspx â†’ form data gÃ¶nder â†’ auth cookie'leri al
   */
  async login() {
    if (this.cookies) return { success: true };

    const { hesapKodu, kullaniciAdi, sifre } = this.credentials;
    if (!hesapKodu || !kullaniciAdi || !sifre) {
      return { success: false, error: 'Hesap kodu, kullanÄ±cÄ± adÄ± ve ÅŸifre gerekli' };
    }

    try {
      // 1) Login sayfasÄ±nÄ± al â†’ session cookie + __VIEWSTATE
      const pageRes = await axios.get(`${BASE_URL}/Login.aspx`, {
        headers: { 'user-agent': COMMON_HEADERS['user-agent'] },
        timeout: 6000,
        ...AXIOS_NO_PROXY,
      });

      const sessionCookies = this._extractCookies(pageRes.headers['set-cookie']);
      const html = pageRes.data;

      // __VIEWSTATE ve __VIEWSTATEGENERATOR'Ä± HTML'den Ã§ek
      const vsMatch = html.match(/name="__VIEWSTATE"[^>]*value="([^"]*)"/);
      const vsgMatch = html.match(/name="__VIEWSTATEGENERATOR"[^>]*value="([^"]*)"/);

      if (!vsMatch) {
        return { success: false, error: 'Login sayfasÄ± parse edilemedi' };
      }

      // 2) Login POST
      const formData = new URLSearchParams({
        __VIEWSTATE: vsMatch[1],
        __VIEWSTATEGENERATOR: vsgMatch ? vsgMatch[1] : '',
        txtEczaneKodu: hesapKodu,
        txtKullaniciAdi: kullaniciAdi,
        txtSifre: sifre,
        btnGiris: 'GiriÅŸ',
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
        ...AXIOS_NO_PROXY,
      });

      const loginCookies = this._extractCookies(loginRes.headers['set-cookie']);

      if (!loginCookies || !loginCookies.includes('BoyutAuth')) {
        return { success: false, error: 'GiriÅŸ baÅŸarÄ±sÄ±z â€” kullanÄ±cÄ± adÄ± veya ÅŸifre hatalÄ± olabilir' };
      }

      // Cookie'leri birleÅŸtir
      this.cookies = sessionCookies + '; ' + loginCookies;
      return { success: true };
    } catch (err) {
      return { success: false, error: `Login hatasÄ±: ${err.message}` };
    }
  }

  /**
   * Manuel cookie set etme (DevTools'tan kopyalanan cookie string)
   */
  setCookies(cookieString) {
    this.cookies = cookieString;
  }

  /**
   * Cookie'leri temizle (re-login iÃ§in)
   */
  clearCookies() {
    this.cookies = null;
  }

  /**
   * Ä°laÃ§ arama â€” barkod veya isim ile
   */
  async search(query) {
    const parsed = await this._searchProducts(query);
    if (parsed.error || !parsed.results?.length) {
      return parsed;
    }
    return await this._fetchMFAndReturn(parsed.results);
  }

  async autocompleteSearch(query) {
    return await this._searchProducts(query);
  }

  async _searchProducts(query) {
    if (!this.cookies) {
      const loginResult = await this.login();
      if (!loginResult.success) {
        return { depot: this.name, error: loginResult.error, results: [] };
      }
    }

    try {
      const data = await this._requestSearch(query);
      return this._parseResults(data);
    } catch (err) {
      return { depot: this.name, error: err.message, results: [] };
    }
  }

  async _requestSearch(query, allowRelogin = true) {
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
          timeout: 10000,
          ...AXIOS_NO_PROXY,
        }
      );

      const data = res.data;
      if (data.hataId && data.hataId !== 0) {
        if (!allowRelogin) {
          throw new Error(data.hataStr || 'Selçuk arama isteği başarısız');
        }
        this.clearCookies();
        const loginResult = await this.login();
        if (!loginResult.success) {
          throw new Error(loginResult.error || 'Selçuk oturumu yenilenemedi');
        }
        return await this._requestSearch(query, false);
      }

      return data;
    } catch (err) {
      if (!allowRelogin) {
        throw err;
      }
      this.clearCookies();
      const loginResult = await this.login();
      if (!loginResult.success) {
        throw new Error(loginResult.error || err.message || 'Selçuk arama isteği başarısız');
      }
      return await this._requestSearch(query, false);
    }
  }

  _normalizeEtiketFiyati(etiketFiyati) {
    return String(etiketFiyati || '').trim();
  }

  _normalizeOnerilenFiyat(etiketFiyati) {
    return this._normalizeEtiketFiyati(etiketFiyati).replace(/\./g, '').replace(',', '.');
  }

  _buildPriceRequestParams(kod, ilacTip, etiketFiyati, satisSekli, miktar) {
    const normalizedEtiketFiyati = this._normalizeEtiketFiyati(etiketFiyati);
    return {
      action: 'IlacFiyatHesapla',
      kod: String(kod || '').trim(),
      miktar: String(Math.max(parseInt(miktar, 10) || 1, 1)),
      satisSekli: satisSekli || 'A6',
      etiketFiyati: normalizedEtiketFiyati,
      miad: 'undefined',
      onerilenFiyat: this._normalizeOnerilenFiyat(normalizedEtiketFiyati),
      ILACTIP: ilacTip || 'B',
      ekstraMf: '',
      ekstraIskonto: '',
    };
  }

  _normalizePriceResponse(rawQuote, requestedQty) {
    if (!rawQuote) return null;

    const safeRequestedQty = Math.max(parseInt(requestedQty, 10) || 1, 1);
    const totalCost = Number(rawQuote.netTutar || 0);
    if (!(totalCost > 0)) return null;

    return {
      requestedQty: safeRequestedQty,
      totalCost,
      effectiveUnit: totalCost / safeRequestedQty,
      receiveQty: Math.max(parseInt(rawQuote.toplamMiktar, 10) || safeRequestedQty, 1),
      raw: rawQuote,
    };
  }

  async _requestSelcukPrice(kod, ilacTip, etiketFiyati, satisSekli = 'A6', miktar = '1') {
    if (!this.cookies) return null;

    const params = this._buildPriceRequestParams(kod, ilacTip, etiketFiyati, satisSekli, miktar);

    try {
      if (process.env.ECZANE_DEBUG === '1') {
        console.log(`[SELCUK price] kod=${params.kod} miktar=${params.miktar} satisSekli=${params.satisSekli} etiket=${params.etiketFiyati} onerilen=${params.onerilenFiyat}`);
      }

      const res = await axios.post(
        `${BASE_URL}/Ilac/IlacGetir-ajax.aspx`,
        new URLSearchParams(params).toString(),
        {
          headers: {
            ...AJAX_HEADERS,
            cookie: this.cookies,
            origin: BASE_URL,
            referer: `${BASE_URL}/Siparis/hizlisiparis.aspx`,
          },
          timeout: 6000,
          ...AXIOS_NO_PROXY,
        }
      );

      if (process.env.ECZANE_DEBUG === '1') {
        console.log(`[SELCUK price] response hataId=${res.data.hataId} netTutar=${res.data.obj?.netTutar}`);
      }

      if (res.data.hataId === 0 && res.data.obj) {
        return {
          netTutar: Number(res.data.obj.netTutar || 0),
          birimFiyat: Number(res.data.obj.birimFiyat || 0),
          depocuFiyati: Number(res.data.obj.depocuFiyati || 0),
          toplamMiktar: Number(res.data.obj.toplamMiktar || 0),
          malFazlasi: Number(res.data.obj.malFazlasi || 0),
          raw: res.data.obj,
          request: params,
        };
      }

      return null;
    } catch (err) {
      console.error(`[SELCUK price] HATA:`, err.message);
      return null;
    }
  }

  async selcukBirim(kod, ilacTip, etiketFiyati, satisSekli = 'A6') {
    const rawQuote = await this._requestSelcukPrice(kod, ilacTip, etiketFiyati, satisSekli, '1');
    const normalized = this._normalizePriceResponse(rawQuote, 1);
    return normalized ? { ...normalized, kind: 'birim' } : null;
  }

  async selcukMf(kod, ilacTip, etiketFiyati, satisSekli = 'A6', miktar = '1') {
    const safeQty = Math.max(parseInt(miktar, 10) || 1, 1);
    const rawQuote = await this._requestSelcukPrice(kod, ilacTip, etiketFiyati, satisSekli, String(safeQty));
    const normalized = this._normalizePriceResponse(rawQuote, safeQty);
    return normalized ? { ...normalized, kind: 'mf' } : null;
  }

  _parseMf(mfStr) {
    if (!mfStr) return null;
    const match = String(mfStr).match(/(\d+)\s*\+\s*(\d+)/);
    if (!match) return null;
    const buy = parseInt(match[1], 10);
    const free = parseInt(match[2], 10);
    if (buy <= 0 || free <= 0) return null;
    return { buy, free, total: buy + free };
  }

  async quoteOption(item, option = {}, targetQty = 1) {
    if (!item?.kodu) return null;

    const requestedQty = Math.max(parseInt(targetQty, 10) || parseInt(option.orderQty, 10) || 1, 1);
    const etiketFiyati = item.etiketFiyat || item.fiyat;
    const satisSekli = item._satisSekli || 'A6';
    const quote = await this.selcukMf(
      item.kodu,
      item.ilacTip,
      etiketFiyati,
      satisSekli,
      String(requestedQty)
    );

    if (!quote) return null;

    const mfStr = quote.malFazlasi || option.mfStr || item.malFazlasi || '';
    const mf = this._parseMf(mfStr);
    const receiveQty = quote.receiveQty;
    const orderQty = requestedQty;
    const totalCost = quote.totalCost;
    const effectiveUnit = quote.effectiveUnit;

    return {
      depot: item.depot || this.name,
      depotId: item.depotId || 'selcuk',
      depotUrl: item.depotUrl || '',
      mf: mf || null,
      mfStr,
      orderQty,
      receiveQty,
      totalCost,
      effectiveUnit,
      unitPrice: Number(effectiveUnit || item.fiyatNum || 0),
      ad: item.ad,
      pricingMode: 'live',
    };
  }

  async _fetchMFAndReturn(resultsArray) {
      const topItems = resultsArray.slice(0, 10);

      // AÅAMA 1: GetIlacDetay â€” MF verisi + satisSekli al
      const detailPromises = topItems.map(item => {
         return this.getProductDetail(item.kodu, item.ilacTip).catch(e => null);
      });
      const details = await Promise.all(detailPromises);

      // MF ve Barkod verisi doldur
      details.forEach((d, i) => {
         if (d) {
            if (d.barkod) topItems[i].barkod = d.barkod;
            topItems[i]._satisSekli = d.kampanyalar?.[0]?.satisSekli || 'A6';
            topItems[i].etiketFiyat = d.kampanyalar?.[0]?.etiketFiyati || topItems[i].etiketFiyat || topItems[i].fiyat;
            
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

      // AÅAMA 2: IlacFiyatHesapla â€” arama ekraninda tekli baz fiyat al
      if (process.env.ECZANE_DEBUG === '1') console.log(`[SELÃ‡UK] AÅŸama 2: ${topItems.length} Ã¼rÃ¼n iÃ§in fiyat hesaplama baÅŸlÄ±yor...`);
      const pricePromises = topItems.map((item, i) => {
        const detail = details[i];
        const satisSekli = detail?.kampanyalar?.[0]?.satisSekli || 'A6';
        const etiketFiyati = detail?.kampanyalar?.[0]?.etiketFiyati || item.etiketFiyat || item.fiyat;
        if (process.env.ECZANE_DEBUG === '1') console.log(`[SELÃ‡UK] item[${i}] kodu=${item.kodu} etiket=${etiketFiyati} satisSekli=${satisSekli} miktar=1 detail=${!!detail}`);
        return this.selcukBirim(item.kodu, item.ilacTip, etiketFiyati, satisSekli)
          .catch(() => null);
      });
      const prices = await Promise.all(pricePromises);

      // Net Tutar ile fiyat gÃ¼ncelle
      prices.forEach((p, i) => {
        if (p && Number(p.totalCost) > 0) {
          const unitGrossPrice = Number(p.totalCost || 0);
          topItems[i].etiketFiyat = topItems[i].fiyat; // Orijinali sakla
          topItems[i].fiyatNum = parseFloat(unitGrossPrice.toFixed(2));
          topItems[i].fiyat = unitGrossPrice.toFixed(2).replace('.', ',');
          topItems[i].selcukNetTutar = Number(p.totalCost || 0);
          topItems[i].selcukToplamMiktar = Number(p.receiveQty || 0);
        }
      });

      return { depot: this.name, error: null, results: resultsArray };
  }

  _parseResults(data) {
    const urunler = data.obj?.urunler || [];
    if (process.env.ECZANE_DEBUG === '1') console.log("SELCUK URUNLER: ", urunler);
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
        // stok sayÄ±sÄ± her zaman gÃ¼venilir deÄŸil (stokGosterilsin: false olabilir)
        stokVar: u.stokDurumu === 1,
        stokGosterilsin,
        ilacTip: u.ILACTIP,
        imgUrl: u.imgUrl,
        malFazlasi: '',
      })),
    };
  }
  // Ä°laÃ§ detay sayfasÄ±ndan barkod dahil bilgi getir
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
          ...AXIOS_NO_PROXY,
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

