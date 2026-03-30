const axios = require('axios');

const BASE_URL = 'https://esiparisv2.alliance-healthcare.com.tr';

const COMMON_HEADERS = {
  'content-type': 'application/json; charset=UTF-8',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  'accept': '*/*',
  'x-requested-with': 'XMLHttpRequest',
};

const cheerio = require('cheerio');

function parseHtmlResponse(html) {
  const results = [];
  const $ = cheerio.load(html);
  
  $('[data-itemstring]').each((i, el) => {
    try {
      const rawBase64 = $(el).attr('data-itemstring');
      const decoded = Buffer.from(rawBase64, 'base64').toString('utf-8');
      const item = JSON.parse(decoded);
      item._rawBase64 = rawBase64;
      results.push(item);
    } catch (e) {
      // skip
    }
  });
  return results;
}

class AllianceDepot {
  constructor(credentials) {
    // credentials: { kullaniciAdi, sifre }
    this.name = 'Alliance Healthcare';
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
      return { success: false, error: 'Link Kodu, Kullanıcı adı ve şifre gerekli' };
    }

    try {
      const getRes = await axios.get(`${BASE_URL}/Account/Login`, {
        headers: { 'user-agent': COMMON_HEADERS['user-agent'], 'accept': '*/*' },
        timeout: 6000,
      });

      let cookie = this._extractCookies(getRes.headers['set-cookie']);
      const $ = cheerio.load(getRes.data);
      const token = $('input[name="__RequestVerificationToken"]').val() || '';

      const body = {
        UserName: kullaniciAdi,
        Password: sifre,
        LinkCode: hesapKodu,
        RememberMe: true,
        ByCookie: false,
        IsIntegrated: false,
      };

      const loginHeaders = {
        ...COMMON_HEADERS,
        cookie: cookie,
      };
      if (token) loginHeaders['__requestverificationtoken'] = token;

      const postRes = await axios.post(`${BASE_URL}/Home/Login`, body, {
        headers: loginHeaders,
        timeout: 6000,
        validateStatus: (s) => s >= 200 && s < 400,
      });

      const postData = postRes.data;
      if (postData && postData.Result === false) {
        return { success: false, error: postData.Message || 'Login başarısız' };
      }

      const authCookies = this._extractCookies(postRes.headers['set-cookie']);
      this.cookies = cookie + (authCookies ? '; ' + authCookies : '');
      this.token = token || '_none_';
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

  _buildBody(query) {
    // Exact body format from curl capture
    return {
      SearchText: query,
      OnlyStock: false,
      SearchContains: false,
      SelectedClass: '3',
      Sorter: 0,
      ManufacturerID: '0',
      WithEQ: false,
      RequestedPage: 1,
      BeforeSearchRequest: '',
    };
  }

  async search(query) {
    if (!this.cookies) {
      const loginResult = await this.login();
      if (!loginResult.success) {
        return { depot: this.name, error: loginResult.error, results: [] };
      }
    }

    try {
      const searchHeaders = {
        ...COMMON_HEADERS,
        cookie: this.cookies,
        origin: BASE_URL,
        referer: `${BASE_URL}/Sales`,
      };
      if (this.token && this.token !== '_none_') {
        searchHeaders['__requestverificationtoken'] = this.token;
      }

      const res = await axios.post(
        `${BASE_URL}/Sales/SearchItems`,
        this._buildBody(query),
        {
          headers: searchHeaders,
          timeout: 6000,
          responseType: 'text',
          transformResponse: [(data) => data],
        }
      );

      const data = res.data;

      if (typeof data === 'string' && data.includes('login') && !data.includes('data-itemstring')) {
        this.clearCookies();
        const loginResult = await this.login();
        if (!loginResult.success) {
          return { depot: this.name, error: loginResult.error, results: [] };
        }
        return this._doSearch(query);
      }

      const parsed = this._parseResults(data);
      return await this._fetchPricesAndReturn(parsed);
    } catch (err) {
      return { depot: this.name, error: err.message, results: [] };
    }
  }

  async _doSearch(query) {
    try {
      const retryHeaders = {
        ...COMMON_HEADERS,
        cookie: this.cookies,
        origin: BASE_URL,
        referer: `${BASE_URL}/Sales`,
      };
      if (this.token && this.token !== '_none_') {
        retryHeaders['__requestverificationtoken'] = this.token;
      }

      const res = await axios.post(
        `${BASE_URL}/Sales/SearchItems`,
        this._buildBody(query),
        {
          headers: retryHeaders,
          timeout: 6000,
          responseType: 'text',
          transformResponse: [(data) => data],
        }
      );
      const parsed = this._parseResults(res.data);
      return await this._fetchPricesAndReturn(parsed);
    } catch (err) {
      return { depot: this.name, error: err.message, results: [] };
    }
  }

  /**
   * Gerçek fiyat hesaplama — CalculateItemTotals ile GrossTotal al
   */
  async calculatePrice(rawBase64, firstOffer, itemId) {
    if (!this.cookies || !rawBase64) return null;
    try {
      let activeOffer = firstOffer;
      
      // Eğer kampanya yoksa, gidip GetItemOffers'tan çekelim
      if (!activeOffer && itemId) {
        try {
          const offersHeaders = {
            ...COMMON_HEADERS,
            cookie: this.cookies,
            referer: `${BASE_URL}/Sales/QuickOrder`,
          };
          const offersRes = await axios.get(`${BASE_URL}/Sales/GetItemOffers?id=${itemId}`, {
            headers: offersHeaders,
            timeout: 4000
          });
          
          if (offersRes.data && Array.isArray(offersRes.data) && offersRes.data.length > 0) {
            // İlk aktif teklifi al
            activeOffer = offersRes.data[0];
          }
        } catch (e) {
          // GetItemOffers fail olsa da devam et (belki kampanya yoktur)
        }
      }

      const offerBase64 = activeOffer ? Buffer.from(JSON.stringify(activeOffer)).toString('base64') : "";
      
      const calcHeaders = {
          ...COMMON_HEADERS,
          cookie: this.cookies,
          origin: BASE_URL,
          referer: `${BASE_URL}/Sales/QuickOrder`,
          'request-context': 'appId=cid-v1:acfd4aec-ad85-4f12-9a2a-e5dc718d8a5b',
          'request-id': `|antigravity.${Math.random().toString(36).substring(7)}`
      };
      if (this.token && this.token !== '_none_') {
        calcHeaders['__requestverificationtoken'] = this.token;
      }

      const res = await axios.post(
        `${BASE_URL}/Sales/CalculateItemTotals`,
        {
          ItemString: rawBase64,
          OfferString: offerBase64,
          Quantity: 1, // Number
          OfferChanged: true, // Boolean
        },
        {
          headers: calcHeaders,
          timeout: 6000,
        }
      );
      
      if (res.data?.Result === true && res.data?.Value) {
        const gross = res.data.Value.GrossTotal;
        console.log(`[ALLIANCE] Calculate success: ${gross}`);
        return { grossTotal: gross };
      }
      console.warn(`[ALLIANCE] Calculate failed: ${res.data?.Message || 'No value'}`);
      return null;
    } catch (err) {
      console.error(`[ALLIANCE] Calculate ERROR:`, err.message);
      return null;
    }
  }

  /**
   * Arama sonuçlarının gerçek fiyatlarını hesapla
   */
  async _fetchPricesAndReturn(parsedResult) {
    const items = parsedResult.results;
    const topItems = items.slice(0, 10);

    const pricePromises = topItems.map(item =>
      this.calculatePrice(item._rawBase64, item._firstOffer, item._itemId).catch(() => null)
    );
    const prices = await Promise.all(pricePromises);

    prices.forEach((p, i) => {
      if (p && p.grossTotal > 0) {
        topItems[i].etiketFiyat = topItems[i].fiyat;
        topItems[i].fiyatNum = parseFloat(p.grossTotal.toFixed(2));
        topItems[i].fiyat = p.grossTotal.toFixed(2).replace('.', ',');
      }
    });

    // İç alanları temizle (frontend'e göndermeye gerek yok)
    items.forEach(item => {
      delete item._rawBase64;
      delete item._firstOffer;
    });

    return parsedResult;
  }

  _parseResults(data) {
    // Response is HTML table with base64-encoded data-itemstring attributes
    // Each decoded JSON: { ID, Name, Barcode, HasStock, QA, PriceTag:{ListPrice,SalesPrice,PurchasingPrice}, ManufacturerName, WarningText, ... }
    const items = typeof data === 'string' ? parseHtmlResponse(data) : (data.Items || data.items || []);
    return {
      depot: this.name,
      error: null,
      results: items.map(item => {
        const priceTag = item.PriceTag || {};
        // User requested "bana gelişi" (purchasing price + VAT included)
        const rawFiyat = priceTag.PurchasingPrice || priceTag.SalesPrice || priceTag.ListPrice || item.Price || 0;
        let fiyatNum = 0;
        if (typeof rawFiyat === 'number') {
          fiyatNum = rawFiyat;
        } else {
          const str = String(rawFiyat);
          fiyatNum = parseFloat(str.includes(',') ? str.replace(/\./g, '').replace(',', '.') : str);
        }

        return {
          kodu: item.Barcode || item.ID || '',
          ad: item.Name || '',
          fiyat: isNaN(fiyatNum) ? '0' : fiyatNum.toFixed(2).replace('.', ','),
          fiyatNum: isNaN(fiyatNum) ? 0 : fiyatNum,
          stok: item.QA || 0,
          stokVar: true,
          stokGosterilsin: false,
          ilacTip: item.CategoryName || '',
          imgUrl: '',
          malFazlasi: '',
          _rawBase64: item._rawBase64 || null,
          _itemId: item.ID || null,
          _firstOffer: (item.Offers && item.Offers.length > 0) ? item.Offers[0] : (item.Campaign ? item.Campaign : null),
        };
      }),
    };
  }
}

module.exports = AllianceDepot;
