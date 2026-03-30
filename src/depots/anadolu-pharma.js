const axios = require('axios');

const BASE_URL = 'https://b2b.anadolupharma.com';

class AnadoluPharmaDepot {
  constructor(credentials) {
    // credentials: { kullaniciAdi, sifre, cariKod, userID }
    this.name = 'Anadolu Pharma';
    this.credentials = credentials;
    this.token = null;
    this.ciSession = null; // ci_session cookie value (not "ci_session=xxx", just the value or full)
  }

  async login() {
    if (this.token) return { success: true };

    const { kullaniciAdi, sifre } = this.credentials;
    if (!kullaniciAdi || !sifre) {
      return { success: false, error: 'Kullanıcı adı ve şifre gerekli' };
    }

    try {
      // Step 1: POST /api/Authentication with form-urlencoded data
      const formData = new URLSearchParams({
        username: kullaniciAdi,
        password: sifre,
        browserKey: '',
      }).toString();

      const res = await axios.post(`${BASE_URL}/api/Authentication`, formData, {
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'x-requested-with': 'XMLHttpRequest',
          'origin': BASE_URL,
          'referer': `${BASE_URL}/Giris`,
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        },
        timeout: 6000,
        // Follow redirects to capture ci_session
        maxRedirects: 5,
      });

      // Extract ci_session from set-cookie
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
        const ci = arr.find(c => c.startsWith('ci_session'));
        if (ci) {
          this.ciSession = ci.split(';')[0]; // "ci_session=xxxx"
        }
      }

      const data = res.data;

      // The response may contain token directly, or via redirect URL
      // Check for token in response data
      if (typeof data === 'object' && data.token) {
        this.token = data.token;
        this._extractFromToken(data.token);
        return { success: true };
      }

      // Check if response is a redirect URL containing token
      if (typeof data === 'string' && data.includes('token=')) {
        const tokenMatch = data.match(/token=([^&"]+)/);
        if (tokenMatch) {
          this.token = decodeURIComponent(tokenMatch[1]);
          this._extractFromToken(this.token);
          return { success: true };
        }
      }

      // Check for redirect header
      const location = res.headers['location'];
      if (location && location.includes('token=')) {
        const tokenMatch = location.match(/token=([^&]+)/);
        if (tokenMatch) {
          this.token = decodeURIComponent(tokenMatch[1]);
          this._extractFromToken(this.token);
          return { success: true };
        }
      }

      return { success: false, error: data.message || data.error || 'Login başarısız — token alınamadı' };
    } catch (err) {
      // Check if error response contains redirect with token
      if (err.response) {
        const location = err.response.headers?.['location'];
        if (location && location.includes('token=')) {
          const tokenMatch = location.match(/token=([^&]+)/);
          if (tokenMatch) {
            this.token = decodeURIComponent(tokenMatch[1]);
            this._extractFromToken(this.token);
            // Extract ci_session
            const setCookie = err.response.headers['set-cookie'];
            if (setCookie) {
              const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
              const ci = arr.find(c => c.startsWith('ci_session'));
              if (ci) this.ciSession = ci.split(';')[0];
            }
            return { success: true };
          }
        }
      }
      return { success: false, error: `Login hatası: ${err.message}` };
    }
  }

  _extractFromToken(jwt) {
    try {
      const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
      if (payload.carikod) this.credentials.cariKod = payload.carikod;
      if (payload.User_ID) this.credentials.userID = payload.User_ID;
    } catch (e) {
      // silently ignore parse errors
    }
  }

  setToken(token, ciSession) {
    this.token = token;
    if (ciSession) this.ciSession = ciSession;
    if (token) this._extractFromToken(token);
  }

  clearToken() {
    this.token = null;
    this.ciSession = null;
  }

  _buildHeaders() {
    const h = {
      'accept': 'application/json, text/plain, */*',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      'referer': `${BASE_URL}/Kampanya`,
    };
    // Token can go as query param or header depending on endpoint
    if (this.ciSession) {
      h['cookie'] = this.ciSession.includes('=') ? this.ciSession : `ci_session=${this.ciSession}`;
    }
    return h;
  }

  _buildSearchURL(query) {
    const cariKod = this.credentials.cariKod || '';
    const params = new URLSearchParams({
      carikod: cariKod,
      ithalat: 'false',
      nogorsel: 'null',
      ForceSearch: 'true',
      search: query,
      userID: this.credentials.userID || '',
      stoktaolan: 'false',
      order: 'null',
      orderby: 'null',
      fav: 'false',
      onecikan: 'null',
      yeniUrun: 'null',
      kampanyaliUrun: 'null',
      aktif: 'true',
      mainCategory: '0',
      mainGroup: '0',
      secondaryGroup: '0',
      brand: '0',
      token: this.token,
      limit: '20',
      offset: '0',
    });
    return `${BASE_URL}/api/Elastic/SearchDocument?${params.toString()}`;
  }

  async search(query) {
    if (!this.token) {
      const loginResult = await this.login();
      if (!loginResult.success) {
        return { depot: this.name, error: loginResult.error, results: [] };
      }
    }

    try {
      const res = await axios.get(this._buildSearchURL(query), {
        headers: this._buildHeaders(),
        timeout: 6000,
      });

      if (res.status === 401 || res.data?.statusCode === 401) {
        this.clearToken();
        const loginResult = await this.login();
        if (!loginResult.success) {
          return { depot: this.name, error: loginResult.error, results: [] };
        }
        return this._doSearch(query);
      }

      return this._parseResults(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        this.clearToken();
        const loginResult = await this.login();
        if (!loginResult.success) {
          return { depot: this.name, error: loginResult.error, results: [] };
        }
        return this._doSearch(query);
      }
      return { depot: this.name, error: err.message, results: [] };
    }
  }

  async _doSearch(query) {
    try {
      const res = await axios.get(this._buildSearchURL(query), {
        headers: this._buildHeaders(),
        timeout: 6000,
      });
      return this._parseResults(res.data);
    } catch (err) {
      return { depot: this.name, error: err.message, results: [] };
    }
  }

  _parseResults(data) {
    const items = data.rows || (Array.isArray(data) ? data : []);
    return {
      depot: this.name,
      error: null,
      results: items.map(item => {
        const rawFiyat = item.KdvDahilNetFiyat || item.sfiyat_fiyati || 0;
        let fiyatNum = 0;
        if (typeof rawFiyat === 'number') {
          fiyatNum = rawFiyat;
        } else {
          const str = String(rawFiyat);
          fiyatNum = parseFloat(str.includes(',') ? str.replace(/\./g, '').replace(',', '.') : str);
        }
        
        return {
          kodu: item.sto_kod || '',
          ad: item.sto_isim || '',
          fiyat: isNaN(fiyatNum) ? '0' : fiyatNum.toFixed(2).replace('.', ','),
          fiyatNum: isNaN(fiyatNum) ? 0 : fiyatNum,
          stok: item.sto_miktar || 0,
          stokVar: typeof item.Stk_Durum !== 'undefined' ? item.Stk_Durum : item.sto_miktar > 0,
          stokGosterilsin: true,
          ilacTip: item.ILACTIP || item.KATEGORI || '',
          imgUrl: item.bskimage ? `https://cdn.anadolupharma.com/${item.bskimage}` : '',
          malFazlasi: item.MalFazlasi || '',
        };
      }),
    };
  }
}

module.exports = AnadoluPharmaDepot;
