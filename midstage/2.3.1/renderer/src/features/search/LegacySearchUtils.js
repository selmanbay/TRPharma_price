export function classifySearchFailure(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('401') || message.includes('yetkisiz') || message.includes('token')) {
    return {
      type: 'auth',
      title: 'Oturum doğrulaması gerekiyor',
      message: 'Lütfen tekrar giriş yapıp aramayı yeniden deneyin.',
    };
  }

  if (message.includes('timeout') || message.includes('network') || message.includes('fetch')) {
    return {
      type: 'network',
      title: 'Depolara bağlanılamadı',
      message: 'Ağ veya depo bağlantısı geçici olarak başarısız oldu. Tekrar deneyin.',
    };
  }

  return {
    type: 'general',
    title: 'Arama tamamlanamadı',
    message: error?.message || 'Bilinmeyen hata oluştu.',
  };
}

export function setSearchInlineLoading(visible, text = 'Diger depo teklifleri yukleniyor...') {
  const inline = document.getElementById('searchInlineLoading');
  if (!inline) return;
  inline.style.display = visible ? 'flex' : 'none';
  const label = inline.querySelector('span');
  if (label) label.textContent = text;
}
