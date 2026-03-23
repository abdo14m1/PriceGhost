import { buildRegionalGateInfo, parseRegionalGateOptionsFromPayload } from '../../src/services/scraper';

describe('Regional gate parsing', () => {
  it('parses Trendyol storefront options from stream payload', () => {
    const props = {
      config: {
        storefrontList: [
          {
            id: '36',
            code: 'AE',
            language: 'en',
            otherLanguages: ['ar'],
            name: 'United Arab Emirates',
          },
        ],
      },
    };

    const payload = JSON.stringify({
      main: `<script>window["__m-country-selection__PROPS"]=${JSON.stringify(props)}</script>`,
    });

    const options = parseRegionalGateOptionsFromPayload('https://www.trendyol.com/en/select-country', [payload]);

    expect(options).toHaveLength(1);
    expect(options[0]).toEqual({
      id: 'trendyol:AE:36',
      label: 'United Arab Emirates',
      context: {
        countryCode: 'AE',
        storefrontId: '36',
        language: 'en',
        cookies: [
          { name: 'countryCode', value: 'AE', domain: '.trendyol.com', path: '/' },
          { name: 'storefrontId', value: '36', domain: '.trendyol.com', path: '/' },
          { name: 'language', value: 'en', domain: '.trendyol.com', path: '/' },
        ],
      },
    });
  });

  it('builds regional gate info payload', () => {
    const options = [
      {
        id: 'trendyol:AE:36',
        label: 'United Arab Emirates',
        context: {
          countryCode: 'AE',
          storefrontId: '36',
          language: 'en',
          cookies: [
            { name: 'countryCode', value: 'AE', domain: '.trendyol.com', path: '/' },
            { name: 'storefrontId', value: '36', domain: '.trendyol.com', path: '/' },
            { name: 'language', value: 'en', domain: '.trendyol.com', path: '/' },
          ],
        },
      },
    ];

    const gate = buildRegionalGateInfo('https://www.trendyol.com/ar/product-p-123', options);

    expect(gate.domain).toBe('trendyol.com');
    expect(gate.gateKey).toBe('country-selection');
    expect(gate.siteName).toBe('Trendyol');
    expect(gate.options).toHaveLength(1);
  });
});
