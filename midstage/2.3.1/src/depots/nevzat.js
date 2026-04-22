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

const AXIOS_NO_PROXY = {
  proxy: false,
};

class NevzatDepot {
  constructor(credentials) {
    // credentials: { hesapKodu, kullaniciAdi, sifre }
    this.name = 'Nevzat Ecza';
    this.credentials = credentials;
    this.cookies = null;
    this.lastLoginAt = 0;
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
      return { success: false, error: 'Hesap kodu, kullanici adi ve sifre gerekli' };
    }

    try {
      const pageRes = await axios.get(`${BASE_URL}/Login.aspx`, {
        headers: { 'user-agent': COMMON_HEADERS['user-agent'] },
        timeout: 6000,
        ...AXIOS_NO_PROXY,
      });

      const sessionCookies = this._extractCookies(pageRes.headers['set-cookie']);
      const html = pageRes.data;

      const vsMatch = html.match(/name="__VIEWSTATE"[^>]*value="([^"]*)"/);
      const vsgMatch = html.match(/name="__VIEWSTATEGENERATOR"[^>]*value="([^"]*)"/);
      const evMatch = html.match(/name="__EVENTVALIDATION"[^>]*value="([^"]*)"/);

      if (!vsMatch) {
        return { success: false, error: 'Login sayfasi parse edilemedi' };
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
        ...AXIOS_NO_PROXY,
      });

      const loginCookies = this._extractCookies(loginRes.headers['set-cookie']);

      if (!loginCookies || !loginCookies.includes('BoyutAuth')) {
        return { success: false, error: 'Giris basarisiz - kullanici adi veya sifre hatali olabilir' };
      }

      this.cookies = sessionCookies + '; ' + loginCookies;
      this.lastLoginAt = Date.now();
      return { success: true };
    } catch (err) {
      return { success: false, error: `Login hatasi: ${err.message}` };
    }
  }

  setCookies(cookieString) {
    this.cookies = cookieString;
    this.lastLoginAt = cookieString ? Date.now() : 0;
  }

  clearCookies() {
    this.cookies = null;
    this.lastLoginAt = 0;
  }

  async ensureSession(options = {}) {
    const maxAgeMs = Number(options.maxAgeMs) || (20 * 60 * 1000);
    const forceRefresh = Boolean(options.forceRefresh);
    const isExpired = !this.lastLoginAt || (Date.now() - this.lastLoginAt > maxAgeMs);

    if (forceRefresh || !this.cookies || isExpired) {
      this.clearCookies();
      const loginResult = await this.login();
      return {
        success: !!loginResult?.success,
        refreshed: true,
        error: loginResult?.error || null,
      };
    }

    return { success: true, refreshed: false };
  }

  async search(query) {
    if (!this.cookies) {
      const loginResult = await this.login();
      if (!loginResult.success) {
        return { depot: this.name, error: loginResult.error, results: [] };
      }
    }

    try {
      const data = await this._requestSearch(query);
      const parsed = this._parseResults(data);
      return await this._fetchMFAndReturn(parsed.results);
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
          throw new Error(data.hataStr || 'Nevzat arama isteği başarısız');
        }
        this.clearCookies();
        const loginResult = await this.login();
        if (!loginResult.success) {
          throw new Error(loginResult.error || 'Nevzat oturumu yenilenemedi');
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
        throw new Error(loginResult.error || err.message || 'Nevzat arama isteği başarısız');
      }
      return await this._requestSearch(query, false);
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

  async _requestNevzatPrice(kod, ilacTip, etiketFiyati, satisSekli = 'A6', miktar = '1') {
    if (!this.cookies) return null;

    const params = this._buildPriceRequestParams(kod, ilacTip, etiketFiyati, satisSekli, miktar);

    try {
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
      return null;
    }
  }

  async nevzatBirim(kod, ilacTip, etiketFiyati, satisSekli = 'A6') {
    const rawQuote = await this._requestNevzatPrice(kod, ilacTip, etiketFiyati, satisSekli, '1');
    const normalized = this._normalizePriceResponse(rawQuote, 1);
    return normalized ? { ...normalized, kind: 'birim' } : null;
  }

  async nevzatMf(kod, ilacTip, etiketFiyati, satisSekli = 'A6', miktar = '1') {
    const safeQty = Math.max(parseInt(miktar, 10) || 1, 1);
    const rawQuote = await this._requestNevzatPrice(kod, ilacTip, etiketFiyati, satisSekli, String(safeQty));
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
    const quote = await this.nevzatMf(
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
      depotId: item.depotId || 'nevzat',
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

      // AÅAMA 1: GetIlacDetay — MF verisi + satisSekli al
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
            const rawPsf = d.kampanyalar?.[0]?.etiketFiyati || '';
            const psfNum = parseFloat(String(rawPsf).replace(/\./g, '').replace(',', '.'));
            if (!Number.isNaN(psfNum) && psfNum > 0) {
              topItems[i].psfFiyatNum = psfNum;
            }
            
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

      // AÅAMA 2: IlacFiyatHesapla — arama ekraninda tekli baz fiyat al
      const pricePromises = topItems.map((item, i) => {
        const detail = details[i];
        const satisSekli = detail?.kampanyalar?.[0]?.satisSekli || 'A6';
        const etiketFiyati = detail?.kampanyalar?.[0]?.etiketFiyati || item.etiketFiyat || item.fiyat;
        return this.nevzatBirim(item.kodu, item.ilacTip, etiketFiyati, satisSekli)
          .catch(() => null);
      });
      const prices = await Promise.all(pricePromises);

      // Net Tutar ile fiyat güncelle
      prices.forEach((p, i) => {
        if (p && p.totalCost > 0) {
          const unitGrossPrice = Number(p.totalCost || 0);
          topItems[i].fiyatNum = parseFloat(unitGrossPrice.toFixed(2));
          topItems[i].fiyat = unitGrossPrice.toFixed(2).replace('.', ',');
          topItems[i].nevzatNetTutar = Number(p.totalCost || 0);
          topItems[i].nevzatToplamMiktar = Number(p.receiveQty || 0);
        }
      });

      return { depot: this.name, error: null, results: resultsArray };
  }

  _parseResults(data) {
    const urunler = data.obj?.urunler || [];
    if (process.env.ECZANE_DEBUG === '1' && urunler.length > 0) {
      console.log("NEVZAT ILK URUN TUM ALANLAR:", JSON.stringify(urunler[0], null, 2));
    }
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


