const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CHF: 'CHF ',
  TRY: '₺',
  SAR: 'SAR ',
  AED: 'AED ',
  QAR: 'QAR ',
  KWD: 'KWD ',
  OMR: 'OMR ',
  BHD: 'BHD ',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
};

export function formatCurrencyValue(price: number | string | null, currency: string | null): string {
  if (price === null || price === undefined) return 'N/A';
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) return 'N/A';

  const code = (currency || 'USD').toUpperCase();
  const symbol = currencySymbols[code] || `${code} `;
  return `${symbol}${numPrice.toFixed(2)}`;
}
