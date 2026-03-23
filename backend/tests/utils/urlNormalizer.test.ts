import { normalizeUrl } from '../../src/utils/urlNormalizer';

describe('urlNormalizer', () => {
  it('should normalize a noisy Trendyol URL', () => {
    const rawUrl = 'https://www.trendyol.com/ar/adidas/women-s-crazychaos-2000-running-shoes-ig4347-p-828498521?choiceNNEnabled=true&isRecoEnginePdpEnabled=false&boutiqueId=61&merchantId=142328&adjust_t=mk12x3o_m4o2h83&utm_source=share&utm_medium=product_free&link_userID=138760597&utm_term=138760597&link_contentid=828498521&utm_campaign=828498521';
    const normalized = normalizeUrl(rawUrl);
    expect(normalized).toBe('https://www.trendyol.com/ar/adidas/women-s-crazychaos-2000-running-shoes-ig4347-p-828498521?merchantId=142328&boutiqueId=61');
  });

  it('should preserve regular URLs', () => {
    const rawUrl = 'https://www.amazon.com/dp/B08X1S29R9?ref=vse_pfo_vwd_dp';
    const normalized = normalizeUrl(rawUrl);
    expect(normalized).toBe('https://www.amazon.com/dp/B08X1S29R9?ref=vse_pfo_vwd_dp');
  });
});
