/**
 * EventBinder.js
 * Eski yapıda "onclick='homeSearch()'" şeklinde verilen özellikleri HTML tarafına
 * dokunmadan ve kirletmeden temiz bir Event Listener yapısına bağlamamızı sağlar.
 */

export class EventBinder {
  /**
   * Bir HTMLElement'e belirtilen eventListener'i atar.
   */
  static bind(idOrSelector, event, callback) {
    let el;
    if (idOrSelector.startsWith('#') || idOrSelector.startsWith('.')) {
      el = document.querySelector(idOrSelector);
    } else {
      el = document.getElementById(idOrSelector);
    }

    if (el) {
      el.addEventListener(event, callback);
    } else {
      // Konsola sessiz uyarı fırlatılabilir ama domda olmayan el elementleri için normaldir
    }
  }

  /**
   * window scope'una global bir metod açmak gerekliyse kullan.
   * "onclick=showPage('home')" tarzı inline html bağımlılıkları için.
   * (İleride bunlardan da kurtulunması önerilir)
   */
  static exposeToWindow(name, fn) {
    window[name] = fn;
  }
}
