import { parsePrice } from '../../src/utils/priceParser';

describe('priceParser', () => {
  it('parses TRY with ₺ symbol', () => {
    const result = parsePrice('₺12.345,67');
    expect(result).toEqual({ price: 12345.67, currency: 'TRY' });
  });

  it('parses TRY with TL suffix', () => {
    const result = parsePrice('12.345,67 TL');
    expect(result).toEqual({ price: 12345.67, currency: 'TRY' });
  });

  it('parses TRY prefix', () => {
    const result = parsePrice('TRY 12.345,67');
    expect(result).toEqual({ price: 12345.67, currency: 'TRY' });
  });

  it('parses USD properly', () => {
    const result = parsePrice('$1,234.56');
    expect(result).toEqual({ price: 1234.56, currency: 'USD' });
  });

  it('parses SAR suffix', () => {
    const result = parsePrice('99.52 SAR');
    expect(result).toEqual({ price: 99.52, currency: 'SAR' });
  });

  it('parses SAR prefix', () => {
    const result = parsePrice('SAR 99.52');
    expect(result).toEqual({ price: 99.52, currency: 'SAR' });
  });

  it('parses AED prices', () => {
    const result = parsePrice('90.87 AED');
    expect(result).toEqual({ price: 90.87, currency: 'AED' });
  });

  it('parses EGP prices', () => {
    const result = parsePrice('EGP 853.39');
    expect(result).toEqual({ price: 853.39, currency: 'EGP' });
  });
});
