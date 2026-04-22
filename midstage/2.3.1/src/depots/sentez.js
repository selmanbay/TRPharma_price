const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.sentezb2b.com';

const COMMON_HEADERS = {
  'content-type': 'application/x-www-form-urlencoded',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
};

class SentezDepot {
  constructor(credentials) {
    // credentials: { kullaniciAdi, sifre }
    this.name = 'Sentez B2B';
    this.credentials = credentials;
    this.cookies = null;
  }

  _extractCookies(setCookieHeaders) {
    if (!setCookieHeaders) return '';
    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    return headers.map(c => c.split(';')[0]).join('; ');
  }

  /**
   * 1) GET /tr-TR/Site/Login → session cookie + __RequestVerificationToken
   * 2) POST /tr-TR/Site/Login → form: token + Username + Password + RememberMe=false
   * 3) Response → .AspNet.ApplicationCookie set edilir
   */
  async login() {
    if (this.cookies) return { success: true };

    const { kullaniciAdi, sifre } = this.credentials;
    if (!kullaniciAdi || !sifre) {
      return { success: false, error: 'Kullanıcı adı ve şifre gerekli' };
    }

    try {
      // 1) Login sayfasını al
      const pageRes = await axios.get(`${BASE_URL}/tr-TR/Site/Login`, {
        headers: { 'user-agent': COMMON_HEADERS['user-agent'] },
        timeout: 6000,
      });

      const sessionCookies = this._extractCookies(pageRes.headers['set-cookie']);
      const html = pageRes.data;

      // __RequestVerificationToken'ı hidden input'tan çek
      const tokenMatch = html.match(/<input name="__RequestVerificationToken" [^>]*value="([^"]+)"/);
      if (!tokenMatch) {
        return { success: false, error: 'Login sayfası parse edilemedi — token bulunamadı' };
      }

      // 2) Login POST
      const formData = new URLSearchParams({
        __RequestVerificationToken: tokenMatch[1],
        Username: kullaniciAdi,
        Password: sifre,
        RememberMe: 'false',
      }).toString();

      const loginRes = await axios.post(`${BASE_URL}/tr-TR/Site/Login`, formData, {
        headers: {
          ...COMMON_HEADERS,
          cookie: sessionCookies,
          origin: BASE_URL,
          referer: `${BASE_URL}/tr-TR/Site/Login`,
        },
        maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 400,
        timeout: 6000,
      });

      const authCookies = this._extractCookies(loginRes.headers['set-cookie']);

      if (!authCookies || !authCookies.includes('.AspNet.ApplicationCookie')) {
        return { success: false, error: 'Giriş başarısız — kullanıcı adı veya şifre hatalı olabilir' };
      }

      this.cookies = sessionCookies + '; ' + authCookies;
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
      const url = `${BASE_URL}/tr-TR/Site/Liste?tip=Arama&arama=${encodeURIComponent(query)}&s=a`;
      const res = await axios.get(url, {
        headers: {
          'user-agent': COMMON_HEADERS['user-agent'],
          cookie: this.cookies,
          referer: `${BASE_URL}/tr-TR/Site/Liste`,
        },
        timeout: 6000,
        maxRedirects: 5,
      });

      const data = res.data;

      // Session expired — login sayfasına redirect
      if (typeof data === 'string' && (data.includes('/Site/Login') && !data.includes('Liste'))) {
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
      const url = `${BASE_URL}/tr-TR/Site/Liste?tip=Arama&arama=${encodeURIComponent(query)}&s=a`;
      const res = await axios.get(url, {
        headers: {
          'user-agent': COMMON_HEADERS['user-agent'],
          cookie: this.cookies,
          referer: `${BASE_URL}/tr-TR/Site/Liste`,
        },
        timeout: 6000,
      });
      return this._parseResults(res.data);
    } catch (err) {
      return { depot: this.name, error: err.message, results: [] };
    }
  }

  _parseResults(html) {
    if (typeof html !== 'string') {
      return { depot: this.name, error: null, results: [] };
    }

    const $ = cheerio.load(html);
    const results = [];

    // Doğru tabloyu bul: "Ürün Adı" header'ı olan tablo
    let targetTable = null;
    $('table').each((i, table) => {
      const headers = $(table).find('th').map((j, th) => $(th).text().trim()).get();
      if (process.env.ECZANE_DEBUG === '1') console.log('[SENTEZ] Table', i, 'headers:', headers);
      if (headers.some(h => h.includes('Ürün Adı'))) {
        targetTable = table;
        return false; // break
      }
    });

    if (!targetTable) {
      return { depot: this.name, error: null, results: [] };
    }

    // Header sırasını oku — sütun index'lerini dinamik belirle
    const headers = $(targetTable).find('th').map((j, th) => $(th).text().trim()).get();
    const colIdx = {
      ad: headers.findIndex(h => h.includes('Ürün Adı')),
      perakende: headers.findIndex(h => h.includes('Perakende')),
      depo: headers.findIndex(h => h.includes('Depo Fiyat')),
      malFazlasi: headers.findIndex(h => h.includes('Mal Fazlası')),
      netFiyat: headers.findIndex(h => h.includes('Net Fiyat')),
    };

    if (process.env.ECZANE_DEBUG === '1') console.log('[SENTEZ] colIdx:', colIdx);

    $(targetTable).find('tbody tr').each((i, tr) => {
      const cells = $(tr).find('td');
      if (cells.length < 4) return;

      const getText = (idx) => idx >= 0 ? $(cells[idx]).text().replace(/\s+/g, ' ').trim() : '';

      // Debug: tüm hücreleri logla
      const allTexts = [];
      cells.each((j, td) => allTexts.push($(td).text().replace(/\s+/g, ' ').trim()));
      if (process.env.ECZANE_DEBUG === '1') console.log('[SENTEZ] ROW cells:', allTexts);

      const ad = getText(colIdx.ad);
      if (!ad) return;

      // KDV Dahil Net Fiyat tercih et, yoksa Depo Fiyatı, yoksa Perakende
      let fiyatStr = getText(colIdx.netFiyat) || getText(colIdx.depo) || getText(colIdx.perakende) || '0';
      let psfStr = getText(colIdx.perakende) || '0';
      // "111,10 TL" → "111,10"
      fiyatStr = fiyatStr.replace(/\s*TL\s*/gi, '').trim();
      psfStr = psfStr.replace(/\s*TL\s*/gi, '').trim();

      let fiyatNum = 0;
      let psfFiyatNum = 0;
      if (fiyatStr && fiyatStr !== '0') {
        fiyatNum = parseFloat(fiyatStr.replace(/\./g, '').replace(',', '.'));
      }
      if (psfStr && psfStr !== '0') {
        psfFiyatNum = parseFloat(psfStr.replace(/\./g, '').replace(',', '.'));
      }

      // Resim
      let imgUrl = '';
      const img = $(tr).find('img');
      if (img.length > 0) {
        imgUrl = img.attr('src') || '';
        if (imgUrl && !imgUrl.startsWith('http')) {
          imgUrl = BASE_URL + imgUrl;
        }
      }

      results.push({
        kodu: '', // Sentez tabloda barkod sütunu yok, arama zaten barkodla yapılıyor
        ad,
        fiyat: isNaN(fiyatNum) ? '0' : fiyatNum.toFixed(2).replace('.', ','),
        fiyatNum: isNaN(fiyatNum) ? 0 : fiyatNum,
        psfFiyatNum: isNaN(psfFiyatNum) ? 0 : psfFiyatNum,
        stok: 0,
        stokVar: true, // Listede görünüyorsa stokta var demek
        stokGosterilsin: false,
        ilacTip: '',
        imgUrl,
        malFazlasi: getText(colIdx.malFazlasi) || '',
      });
    });

    return { depot: this.name, error: null, results };
  }
}

module.exports = SentezDepot;
