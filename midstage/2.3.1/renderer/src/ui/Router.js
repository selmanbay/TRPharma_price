/**
 * Router.js
 * SP (Single Page) yapısındaki görünümler (page-home, page-search vb.)
 * arası geçişi state değişimine uygun bir animasyonla yapar.
 */

export class Router {
  constructor() {
    this.currentPage = 'home';
  }

  navigate(name) {
    if (name === this.currentPage) return;

    const fromPage = document.getElementById('page-' + this.currentPage);
    const toPage = document.getElementById('page-' + name);
    const isBack = (name === 'home');

    if (fromPage) {
      const exitClass = isBack ? 'page-exit-back' : 'page-exit';
      if (this.currentPage === 'home') {
        fromPage.classList.add('page-exit-home');
      } else {
        fromPage.classList.add(exitClass);
      }

      const onExit = () => {
        fromPage.classList.remove('active', 'page-exit', 'page-exit-back', 'page-exit-home');
        fromPage.removeEventListener('animationend', onExit);
      };
      
      fromPage.addEventListener('animationend', onExit, { once: true });
      setTimeout(() => { fromPage.classList.remove('active', 'page-exit', 'page-exit-back', 'page-exit-home'); }, 300);
    }

    setTimeout(() => {
      if(toPage) {
        toPage.classList.add('active');
        const enterClass = isBack ? 'page-enter-home' : 'page-enter';
        if (name === 'home') {
          toPage.classList.add('page-enter-home');
        } else {
          toPage.classList.add(enterClass);
        }

        const onEnter = () => {
          toPage.classList.remove('page-enter', 'page-enter-back', 'page-enter-home');
          toPage.removeEventListener('animationend', onEnter);
        };
        toPage.addEventListener('animationend', onEnter, { once: true });
        
        setTimeout(() => { toPage.classList.remove('page-enter', 'page-enter-back', 'page-enter-home'); }, 450);
      }
      
      this.currentPage = name;

      // Özel hooklar:
      if (name === 'search') document.getElementById('searchInput')?.focus();
      
    }, isBack ? 180 : 200);
  }
}

export const router = new Router();
