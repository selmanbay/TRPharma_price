/**
 * formatters.js
 * Çeşitli formata dönüştürme ve parser utilityleri.
 */

export function parseQRCode(text) {
  if (!text) return '';
  const match = text.match(/01(\d{14})/);
  if (match) {
    return match[1].substring(1); 
  }
  return text.trim();
}

export function isBarcodeQuery(query) {
  const code = String(query).replace(/[^0-9]/g, '');
  return code.startsWith('8') && code.length >= 13;
}

export function formatCurrency(value) {
  const num = parseFloat(value) || 0;
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2
  }).format(num);
}

export function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/[àAáAâAãAäAåA]/g, 'a')
    .replace(/çC/g, 'c')
    .replace(/[éEèEêEëE]/g, 'e')
    .replace(/[íIìIîIïIıI]/g, 'i')
    .replace(/[óOòOôOõOöO]/g, 'o')
    .replace(/[úUùUûUüU]/g, 'u')
    .replace(/[şS]/g, 's')
    .replace(/[ğG]/g, 'g')
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}
