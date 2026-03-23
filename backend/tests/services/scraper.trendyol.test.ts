import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';
import { extractTrendyolCandidates } from '../../src/services/scraper';

describe('Trendyol Scraper', () => {
  it('extracts product from AR PDP with __INITIAL_STATE__', () => {
    const html = fs.readFileSync(path.join(__dirname, '../fixtures/trendyol/pdp-ar.html'), 'utf8');
    const $ = load(html);
    const result = extractTrendyolCandidates($, 'https://www.trendyol.com/ar/adidas/women-s-crazychaos-2000-running-shoes-ig4347-p-828498521');
    
    expect(result.name).toBe("Women's Crazychaos 2000 Running Shoes");
    expect(result.imageUrl).toBe('https://cdn.dsmcdn.com/test-image.jpg');
    expect(result.stockStatus).toBe('in_stock');
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].price).toBe(2499.00);
    expect(result.candidates[0].currency).toBe('TRY');
  });

  it('handles multiple sellers by picking the one matching merchantId', () => {
    const html = fs.readFileSync(path.join(__dirname, '../fixtures/trendyol/pdp-multiple-sellers.html'), 'utf8');
    const $ = load(html);
    const result = extractTrendyolCandidates($, 'https://www.trendyol.com/ar/adidas/product-p-828498521?merchantId=142328');
    
    expect(result.candidates[0].price).toBe(2550.00); // Should pick the target seller's price
  });

  it('handles out of stock', () => {
    const html = fs.readFileSync(path.join(__dirname, '../fixtures/trendyol/pdp-out-of-stock.html'), 'utf8');
    const $ = load(html);
    const result = extractTrendyolCandidates($, 'https://www.trendyol.com/ar/adidas/product-p-828498521');
    
    expect(result.stockStatus).toBe('out_of_stock');
  });
});
