const axios = require('axios');

const BASE_URL = 'https://b4b.anadoluitriyat.com';

const COMMON_HEADERS = {
  'content-type': 'application/json; charset=UTF-8',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  'accept': 'application/json, text/javascript, */*; q=0.01',
  'x-requested-with': 'XMLHttpRequest',
};

// Strip HTML tags and &nbsp; from price strings like "2.126,42&nbsp;<i class...>"
function stripHtml(str) {
  if (!str) return '0';
  return String(str)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, '')
    .replace(/&amp;/g, '&')
    .trim();
}

class AnadoluItriyatDepot {
  constructor(credentials) {
    // credentials: { kullaniciAdi, sifre }
    this.name = 'Anadolu İtriyat';
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
      return { success: false, error: 'Hesap Kodu, Kullanıcı Adı ve şifre gerekli' };
    }

    try {
      // 1. GET request to extract __RequestVerificationToken and initial session cookie
      const getRes = await axios.get(`${BASE_URL}/`, {
        headers: {
          'user-agent': COMMON_HEADERS['user-agent'],
          'accept': 'text/html',
        },
        timeout: 6000,
      });

      const initialCookies = this._extractCookies(getRes.headers['set-cookie']);
      const match = getRes.data.match(/<input name="__RequestVerificationToken" type="hidden" value="([^"]+)"/);
      if (!match) {
        return { success: false, error: 'Login başarısız — __RequestVerificationToken bulunamadı' };
      }
      const token = match[1];

      // 2. POST to root to login
      const body = new URLSearchParams({
        __RequestVerificationToken: token,
        CustomerCode: hesapKodu,
        UserCode: kullaniciAdi,
        Password: sifre,
      });

      const postRes = await axios.post(`${BASE_URL}/`, body.toString(), {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': COMMON_HEADERS['user-agent'],
          'cookie': initialCookies,
          'referer': `${BASE_URL}/`,
        },
        maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 400,
        timeout: 6000,
      });

      const authCookies = this._extractCookies(postRes.headers['set-cookie']);
      if (!authCookies || (!authCookies.includes('.ASPXAUTH') && !authCookies.includes('AnadoluItriyat-B4B'))) {
        return { success: false, error: 'Login başarısız — yetki cookie alınamadı' };
      }

      // Merge initial cookies with auth cookies
      this.cookies = initialCookies + (authCookies ? '; ' + authCookies : '');
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
      dataCount: 0,
      manufacturer: null,
      vehicleBrand: null,
      vehicleModel: null,
      productGroup1: '',
      productGroup2: '',
      productGroup3: '',
      productGroup4: '',
      productGroup5: '',
      productGroup6: '',
      productGroup7: '',
      t9Text: query,
      campaign: false,
      newArrival: false,
      newProduct: false,
      comparsionProduct: false,
      onQuantity: false,
      onWay: false,
      image: false,
      borsaProduct: false,
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
      const res = await axios.post(
        `${BASE_URL}/Search/SearchProduct`,
        this._buildBody(query),
        {
          headers: {
            ...COMMON_HEADERS,
            cookie: this.cookies,
            origin: BASE_URL,
            referer: `${BASE_URL}/Search`,
          },
          timeout: 6000,
        }
      );

      const data = res.data;

      // Session expired — redirect or HTML response
      if (typeof data === 'string' || data.redirectUrl) {
        this.clearCookies();
        const loginResult = await this.login();
        if (!loginResult.success) {
          return { depot: this.name, error: loginResult.error, results: [] };
        }
        return this._doSearch(query);
      }

      return this._parseResults(data);
    } catch (err) {
      return { depot: this.name, error: err.message, results: [] };
    }
  }

  async _doSearch(query) {
    try {
      const res = await axios.post(
        `${BASE_URL}/Search/SearchProduct`,
        this._buildBody(query),
        {
          headers: {
            ...COMMON_HEADERS,
            cookie: this.cookies,
            origin: BASE_URL,
            referer: `${BASE_URL}/Search`,
          },
          timeout: 6000,
        }
      );
      return this._parseResults(res.data);
    } catch (err) {
      return { depot: this.name, error: err.message, results: [] };
    }
  }

  _parseResults(data) {
    // Response is a flat JSON array (NOT wrapped in {Items:[...]})
    // [{Id, Code, Name, Price2Str, PriceNetWithVatStr, AvailabilityText, EczKarOran, Overage, Manufacturer, PicturePath}]
    const items = Array.isArray(data) ? data : (data.Items || data.items || []);
    if (process.env.ECZANE_DEBUG === '1' && items.length > 0) console.log("AI RAW ITEM:", items[0]);

    return {
      depot: this.name,
      error: null,
      results: items.map(item => {
        // Price strings contain HTML: "2.126,42&nbsp;<i class=\"fa fa-try\"...>"
        const rawPrice = item.PriceNetWithVatStr || item.Price2Str || item.Price || '0';
        const rawPsf = item.Price2Str || item.Price || '0';
        let fiyatNum = 0;
        let psfFiyatNum = 0;
        if (typeof rawPrice === 'number') {
          fiyatNum = rawPrice;
        } else {
          const str = stripHtml(String(rawPrice)).trim();
          fiyatNum = parseFloat(str.includes(',') ? str.replace(/\./g, '').replace(',', '.') : str);
        }
        if (typeof rawPsf === 'number') {
          psfFiyatNum = rawPsf;
        } else {
          const str = stripHtml(String(rawPsf)).trim();
          psfFiyatNum = parseFloat(str.includes(',') ? str.replace(/\./g, '').replace(',', '.') : str);
        }

        return {
          kodu: item.Code || item.Barcode || '',
          ad: item.Name || '',
          fiyat: isNaN(fiyatNum) ? '0' : fiyatNum.toFixed(2).replace('.', ','),
          fiyatNum: isNaN(fiyatNum) ? 0 : fiyatNum,
          psfFiyatNum: isNaN(psfFiyatNum) ? 0 : psfFiyatNum,
          stok: typeof item.Quantity === 'number' ? item.Quantity : 0,
          stokVar: item.AvailabilityText === 'var' || item.AvailabilityText === 'Var' || (item.Quantity > 0),
          stokGosterilsin: false,
          ilacTip: '',
          imgUrl: item.PicturePath && item.PicturePath.startsWith('http') ? item.PicturePath : (item.PicturePath ? `https://b2b.anadolu-itriyat.com.tr${item.PicturePath}` : ''),
          malFazlasi: item.Overage || '',
        };
      }),
    };
  }
}

module.exports = AnadoluItriyatDepot;
