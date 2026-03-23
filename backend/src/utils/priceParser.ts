export interface ParsedPrice {
  price: number;
  currency: string;
}

// Currency symbols and their codes
const currencyMap: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₹': 'INR',
  'Fr.': 'CHF',
  'CHF': 'CHF',
  'CAD': 'CAD',
  'AUD': 'AUD',
  'USD': 'USD',
  'EUR': 'EUR',
  'GBP': 'GBP',
  '₺': 'TRY',
  'TRY': 'TRY',
  'TL': 'TRY',
  'SAR': 'SAR',
  'AED': 'AED',
  'QAR': 'QAR',
  'KWD': 'KWD',
  'OMR': 'OMR',
  'BHD': 'BHD',
  'EGP': 'EGP',
};

// Patterns to match prices in text
const pricePatterns = [
  // $29.99 or $29,99 or $ 29.99 or ₺12.345,67
  /(?<currency>[$€£¥₹₺])\s*(?<price>[\d.,]+)/,
  // CHF 29.99 or Fr. 29.99 (Swiss franc prefix) or SAR 99.52
  /(?<currency>CHF|Fr\.|TRY|SAR|AED|QAR|KWD|OMR|BHD|EGP)\s*(?<price>[\d.,]+)/i,
  // 29.99 USD or 29,99 EUR or 12.34 TL or 99.52 SAR
  /(?<price>[\d.,]+)\s*(?<currency>USD|EUR|GBP|CAD|AUD|JPY|INR|CHF|TRY|TL|SAR|AED|QAR|KWD|OMR|BHD|EGP)/i,
  // Plain number with optional decimal (fallback)
  /(?<price>\d{1,3}(?:[,.\s]?\d{3})*(?:[.,]\d{2})?)/,
];

export function parsePrice(text: string): ParsedPrice | null {
  if (!text) return null;

  // Clean up the text
  const cleanText = text.trim().replace(/\s+/g, ' ');

  // Reject monthly payment/financing prices (e.g., "$25/mo", "per month", "4 payments", etc.)
  const lowerText = cleanText.toLowerCase();
  if (lowerText.includes('/mo') ||
      lowerText.includes('per month') ||
      lowerText.includes('monthly payment') ||
      lowerText.includes('a month') ||
      lowerText.includes('payments starting') ||
      lowerText.includes('payment of') ||
      lowerText.includes('payments of') ||
      /\d+\s*payments?\b/.test(lowerText) ||
      /\d+\s*mo\b/.test(lowerText)) {
    return null;
  }

  for (const pattern of pricePatterns) {
    const match = cleanText.match(pattern);
    if (match && match.groups) {
      const priceStr = match.groups.price || match[1];
      const currencySymbol = match.groups.currency || '$';

      if (priceStr) {
        const price = normalizePrice(priceStr);
        if (price !== null && price > 0) {
          const currency = currencyMap[currencySymbol] || 'USD';
          return { price, currency };
        }
      }
    }
  }

  // Try to extract just a number as fallback
  const numberMatch = cleanText.match(/[\d,]+\.?\d*/);
  if (numberMatch) {
    const price = normalizePrice(numberMatch[0]);
    if (price !== null && price > 0) {
      return { price, currency: 'USD' };
    }
  }

  return null;
}

function normalizePrice(priceStr: string): number | null {
  if (!priceStr) return null;

  // Remove spaces
  let normalized = priceStr.replace(/\s/g, '');

  // Strip trailing commas or periods that might have been matched
  normalized = normalized.replace(/[,.]$/, '');

  // Handle European format (1.234,56) vs US format (1,234.56)
  // Also handle cases like 12.345,67 vs 12,345.67
  const commaIndex = normalized.lastIndexOf(',');
  const dotIndex = normalized.lastIndexOf('.');

  if (commaIndex !== -1 && dotIndex !== -1) {
    if (commaIndex > dotIndex) {
      // Comma is the decimal separator: 1.234,56 -> 1234.56
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      // Dot is the decimal separator: 1,234.56 -> 1234.56
      normalized = normalized.replace(/,/g, '');
    }
  } else {
    // No mixture. Just one type of separator or none.
    if (commaIndex !== -1) {
      // If we only have a comma, check if it's likely a decimal (e.g. 12,50) or thousand (e.g. 12,500)
      if (normalized.length - commaIndex <= 3) {
        // Assume decimal: 123,45 -> 123.45
        normalized = normalized.replace(',', '.');
      } else {
        // Assume thousand: 12,345 -> 12345
        normalized = normalized.replace(/,/g, '');
      }
    } else if (dotIndex !== -1) {
      // If we only have a dot, check if it's likely a thousand separator (e.g. 1.000)
      if (normalized.length - dotIndex > 3) {
        // Assume thousand: 1.234 -> 1234
        normalized = normalized.replace(/\./g, '');
      }
      // Else it's a decimal (e.g. 12.34), parseFloat handles it natively
    }
  }

  const price = parseFloat(normalized);
  return isNaN(price) ? null : Math.round(price * 100) / 100;
}

export function extractPricesFromText(html: string): ParsedPrice[] {
  const prices: ParsedPrice[] = [];
  const seen = new Set<number>();

  // Match all price-like patterns in the HTML
  const allMatches = html.matchAll(
    /(?:[$€£¥₹₺])\s*[\d.,]+|(?:CHF|Fr\.|TRY|SAR|AED|QAR|KWD|OMR|BHD|EGP)\s*[\d.,]+|[\d.,]+\s*(?:USD|EUR|GBP|CAD|AUD|CHF|TRY|TL|SAR|AED|QAR|KWD|OMR|BHD|EGP)/gi
  );

  for (const match of allMatches) {
    const parsed = parsePrice(match[0]);
    if (parsed && !seen.has(parsed.price)) {
      seen.add(parsed.price);
      prices.push(parsed);
    }
  }

  return prices;
}

export function findMostLikelyPrice(prices: ParsedPrice[]): ParsedPrice | null {
  if (prices.length === 0) return null;
  if (prices.length === 1) return prices[0];

  // Filter out very small prices (likely coupons, savings amounts, not actual product prices)
  // Most real products cost at least $2-3, and coupon amounts are often $1-5
  const validPrices = prices.filter((p) => p.price >= 5);

  // If no prices above $5, try with a lower threshold but above typical coupon amounts
  if (validPrices.length === 0) {
    const lowThresholdPrices = prices.filter((p) => p.price >= 2);
    if (lowThresholdPrices.length > 0) {
      lowThresholdPrices.sort((a, b) => a.price - b.price);
      return lowThresholdPrices[0];
    }
    // Fall back to original list if nothing matches
    return prices[0];
  }

  // Sort by price - the lowest valid price is often the sale/current price
  validPrices.sort((a, b) => a.price - b.price);

  return validPrices[0];
}
