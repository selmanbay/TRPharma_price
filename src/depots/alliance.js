const axios = require('axios');

const BASE_URL = 'https://esiparisv2.alliance-healthcare.com.tr';

const COMMON_HEADERS = {
  'content-type': 'application/json; charset=UTF-8',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  'accept': '*/*',
  'x-requested-with': 'XMLHttpRequest',
};

const AXIOS_NO_PROXY = {
  proxy: false,
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

function parseDetailItemResponse(html) {
  const $ = cheerio.load(html);
  const rawBase64 = $('[data-item]').first().attr('data-item') || $('[data-itemstring]').first().attr('data-itemstring') || '';
  const itemId = $('[data-id]').first().attr('data-id') || $('[data-itemid]').first().attr('data-itemid') || '';

  if (!rawBase64) return null;

  try {
    const decoded = Buffer.from(rawBase64, 'base64').toString('utf-8');
    const item = JSON.parse(decoded);
    item._rawBase64 = rawBase64;
    item._itemId = item.ID || itemId || null;
    return item;
  } catch {
    return null;
  }
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
      return { success: false, error: 'Link Kodu, Kullanici adi ve sifre gerekli' };
    }

    try {
      const getRes = await axios.get(`${BASE_URL}/Account/Login`, {
        headers: { 'user-agent': COMMON_HEADERS['user-agent'], 'accept': '*/*' },
        timeout: 6000,
        ...AXIOS_NO_PROXY,
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
        ...AXIOS_NO_PROXY,
      });

      const postData = postRes.data;
      if (postData && postData.Result === false) {
        return { success: false, error: postData.Message || 'Login basarisiz' };
      }

      const authCookies = this._extractCookies(postRes.headers['set-cookie']);
      this.cookies = cookie + (authCookies ? '; ' + authCookies : '');
      this.token = token || '_none_';
      return { success: true };
    } catch (err) {
      return { success: false, error: `Login hatasi: ${err.message}` };
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

  async _fetchDetailedItem(itemId) {
    if (!this.cookies || !itemId) return null;

    try {
      const detailHeaders = {
        ...COMMON_HEADERS,
        cookie: this.cookies,
        origin: BASE_URL,
        referer: `${BASE_URL}/Sales/QuickOrder`,
      };
      if (this.token && this.token !== '_none_') {
        detailHeaders['__requestverificationtoken'] = this.token;
      }

      const res = await axios.post(
        `${BASE_URL}/Sales/ItemDetail`,
        { ItemID: itemId },
        {
          headers: detailHeaders,
          timeout: 8000,
          responseType: 'text',
          transformResponse: [(data) => data],
          ...AXIOS_NO_PROXY,
        }
      );

      return parseDetailItemResponse(res.data);
    } catch {
      return null;
    }
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
          ...AXIOS_NO_PROXY,
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
          ...AXIOS_NO_PROXY,
        }
      );
      const parsed = this._parseResults(res.data);
      return await this._fetchPricesAndReturn(parsed);
    } catch (err) {
      return { depot: this.name, error: err.message, results: [] };
    }
  }

  _normalizeGrossResponse(rawQuote, requestedQty) {
    if (!rawQuote) return null;

    const safeRequestedQty = Math.max(parseInt(requestedQty, 10) || 1, 1);
    const totalCost = Number(rawQuote.grossTotal || 0);
    if (!(totalCost > 0)) return null;

    return {
      requestedQty: safeRequestedQty,
      totalCost,
      effectiveUnit: totalCost / safeRequestedQty,
      receiveQty: Math.max(parseInt(rawQuote.totalQuantity, 10) || safeRequestedQty, 1),
      orderQty: Math.max(parseInt(rawQuote.quantity, 10) || safeRequestedQty, 1),
      raw: rawQuote,
    };
  }

  async _resolveOffer(firstOffer, itemId) {
    if (firstOffer) return firstOffer;
    if (!itemId) return null;

    try {
      const offersHeaders = {
        ...COMMON_HEADERS,
        cookie: this.cookies,
        referer: `${BASE_URL}/Sales/QuickOrder`,
      };
      const offersRes = await axios.get(`${BASE_URL}/Sales/GetItemOffers?id=${itemId}`, {
        headers: offersHeaders,
        timeout: 4000,
        ...AXIOS_NO_PROXY,
      });

      if (offersRes.data && Array.isArray(offersRes.data) && offersRes.data.length > 0) {
        return offersRes.data[0];
      }
    } catch {}

    return null;
  }

  async _resolveAlliancePayload(rawBase64, firstOffer, itemId) {
    let nextRawBase64 = rawBase64;
    let nextOffer = firstOffer || null;
    let nextItemId = itemId || null;

    const needsDetail = !nextOffer || !nextRawBase64;
    if (needsDetail && nextItemId) {
      const detailItem = await this._fetchDetailedItem(nextItemId);
      if (detailItem) {
        nextRawBase64 = detailItem._rawBase64 || nextRawBase64;
        nextItemId = detailItem._itemId || nextItemId;
        if (!nextOffer && Array.isArray(detailItem.Offers) && detailItem.Offers.length > 0) {
          nextOffer = detailItem.Offers[0];
        }
      }
    }

    if (!nextOffer) {
      nextOffer = await this._resolveOffer(nextOffer, nextItemId);
    }

    return {
      rawBase64: nextRawBase64,
      offer: nextOffer,
      itemId: nextItemId,
    };
  }

  async _requestAlliancePrice(rawBase64, firstOffer, itemId, quantity = 1) {
    if (!this.cookies) return null;

    try {
      const payload = await this._resolveAlliancePayload(rawBase64, firstOffer, itemId);
      if (!payload.rawBase64) return null;

      const activeOffer = payload.offer;
      const offerBase64 = activeOffer ? Buffer.from(JSON.stringify(activeOffer)).toString('base64') : '';

      const calcHeaders = {
        ...COMMON_HEADERS,
        cookie: this.cookies,
        origin: BASE_URL,
        referer: `${BASE_URL}/Sales/QuickOrder`,
        'request-context': 'appId=cid-v1:acfd4aec-ad85-4f12-9a2a-e5dc718d8a5b',
        'request-id': `|antigravity.${Math.random().toString(36).substring(7)}`,
      };
      if (this.token && this.token !== '_none_') {
        calcHeaders['__requestverificationtoken'] = this.token;
      }

      const safeQty = Math.max(parseInt(quantity, 10) || 1, 1);
      const res = await axios.post(
        `${BASE_URL}/Sales/CalculateItemTotals`,
        {
          ItemString: payload.rawBase64,
          OfferString: offerBase64,
          Quantity: safeQty,
          OfferChanged: true,
        },
        {
          headers: calcHeaders,
          timeout: 6000,
          ...AXIOS_NO_PROXY,
        }
      );

      if (res.data?.Result === true && res.data?.Value) {
        const gross = Number(res.data.Value.GrossTotal || 0);
        if (process.env.ECZANE_DEBUG === '1') console.log(`[ALLIANCE] Calculate success: ${gross}`);
        return {
          grossTotal: gross,
          netPrice: Number(res.data.Value.NetPrice || 0),
          quantity: Number(res.data.Value.Quantity || safeQty),
          extraQuantity: Number(res.data.Value.ExtraQuantity || 0),
          totalQuantity: Number(res.data.Value.TotalQuantity || safeQty),
          rawValue: res.data.Value,
          offer: activeOffer,
          rawBase64: payload.rawBase64,
        };
      }
      console.warn(`[ALLIANCE] Calculate failed: ${res.data?.Message || 'No value'}`);
      return null;
    } catch (err) {
      console.error(`[ALLIANCE] Calculate ERROR:`, err.message);
      return null;
    }
  }

  async allianceBirim(rawBase64, firstOffer, itemId) {
    const rawQuote = await this._requestAlliancePrice(rawBase64, firstOffer, itemId, 1);
    const normalized = this._normalizeGrossResponse(rawQuote, 1);
    return normalized ? { ...normalized, kind: 'birim' } : null;
  }

  async allianceMf(rawBase64, firstOffer, itemId, quantity = 1) {
    const safeQty = Math.max(parseInt(quantity, 10) || 1, 1);
    const rawQuote = await this._requestAlliancePrice(rawBase64, firstOffer, itemId, safeQty);
    const normalized = this._normalizeGrossResponse(rawQuote, safeQty);
    return normalized ? { ...normalized, kind: 'mf' } : null;
  }

  /**
   * Arama sonuÃ§larinda tekli baz fiyatlari hesapla.
   */
  async _fetchPricesAndReturn(parsedResult) {
    const items = parsedResult.results;
    const topItems = items.slice(0, 10);

    const detailPromises = topItems.map((item) => this._fetchDetailedItem(item._itemId).catch(() => null));
    const details = await Promise.all(detailPromises);

    details.forEach((detailItem, i) => {
      if (!detailItem) return;
      topItems[i]._rawBase64 = detailItem._rawBase64 || topItems[i]._rawBase64;
      topItems[i]._itemId = detailItem._itemId || topItems[i]._itemId;
      topItems[i]._offers = Array.isArray(detailItem.Offers) ? detailItem.Offers : topItems[i]._offers;
      topItems[i]._firstOffer = topItems[i]._offers?.[0] || topItems[i]._firstOffer || null;
      topItems[i].malFazlasi = String(topItems[i]._firstOffer?.RewardName || '').match(/(\d+\+\d+)/)?.[1] || topItems[i].malFazlasi || '';
    });

    const pricePromises = topItems.map(item =>
      this.allianceBirim(item._rawBase64, item._firstOffer, item._itemId).catch(() => null)
    );
    const prices = await Promise.all(pricePromises);

    prices.forEach((p, i) => {
      if (p && p.totalCost > 0) {
        topItems[i].etiketFiyat = topItems[i].fiyat;
        topItems[i].fiyatNum = parseFloat(p.totalCost.toFixed(2));
        topItems[i].fiyat = p.totalCost.toFixed(2).replace('.', ',');
        topItems[i].allianceGrossTotal = Number(p.totalCost || 0);
        topItems[i].allianceToplamMiktar = Number(p.receiveQty || 0);
      }
    });

    return parsedResult;
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
    if (!item?._rawBase64) return null;

    const offers = Array.isArray(item._offers) && item._offers.length
      ? item._offers
      : (item._firstOffer ? [item._firstOffer] : [null]);

    const desiredOrderQty = Math.max(parseInt(targetQty, 10) || parseInt(option.orderQty, 10) || 1, 1);
    const requestedMf = option.mfStr || item.malFazlasi || '';
    const candidateOffers = requestedMf
      ? offers.filter((offer) => String(offer?.RewardName || '').includes(requestedMf))
      : offers;
    const effectiveOffers = candidateOffers.length ? candidateOffers : offers;

    const quotes = await Promise.all(
      effectiveOffers.map((offer) => this.allianceMf(item._rawBase64, offer, item._itemId, desiredOrderQty).catch(() => null))
    );

    const validQuotes = quotes
      .map((quote, index) => ({ quote, offer: effectiveOffers[index] }))
      .filter(({ quote }) => quote && quote.totalCost > 0);

    if (!validQuotes.length) return null;

    validQuotes.sort((a, b) => {
      const aUnit = a.quote.effectiveUnit > 0 ? a.quote.effectiveUnit : Number.MAX_SAFE_INTEGER;
      const bUnit = b.quote.effectiveUnit > 0 ? b.quote.effectiveUnit : Number.MAX_SAFE_INTEGER;
      return aUnit - bUnit;
    });

    const best = validQuotes[0];
    const offerMf = String(best.offer?.RewardName || '').match(/(\d+\+\d+)/)?.[1] || requestedMf;
    const mf = this._parseMf(offerMf);
    const receiveQty = best.quote.receiveQty;
    const orderQty = best.quote.orderQty;

    return {
      depot: item.depot || this.name,
      depotId: item.depotId || 'alliance',
      depotUrl: item.depotUrl || '',
      mf: mf || null,
      mfStr: offerMf || '',
      orderQty: desiredOrderQty,
      receiveQty,
      totalCost: Number(best.quote.totalCost || 0),
      effectiveUnit: Number(best.quote.effectiveUnit || 0),
      unitPrice: Number(best.quote.effectiveUnit || 0),
      ad: item.ad,
      pricingMode: 'live',
    };
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
        // User requested "bana geliÅŸi" (purchasing price + VAT included)
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
          malFazlasi: String(((item.Offers && item.Offers[0]?.RewardName) || item.Campaign?.RewardName || '')).match(/(\d+\+\d+)/)?.[1] || '',
          _rawBase64: item._rawBase64 || null,
          _itemId: item.ID || null,
          _firstOffer: (item.Offers && item.Offers.length > 0) ? item.Offers[0] : (item.Campaign ? item.Campaign : null),
          _offers: Array.isArray(item.Offers) ? item.Offers : [],
        };
      }),
    };
  }
}

module.exports = AllianceDepot;


