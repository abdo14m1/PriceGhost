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
});
