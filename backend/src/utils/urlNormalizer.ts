export function normalizeUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    
    // Normalize Trendyol URLs
    if (url.hostname.includes('trendyol.com')) {
      const match = url.pathname.match(/(-p-\d+)/);
      if (match) {
        // Let's preserve merchantId to track seller-specific prices
        const merchantId = url.searchParams.get('merchantId');
        const boutiqueId = url.searchParams.get('boutiqueId');
        
        // Strip everything else and reconstruct a clean URL
        url.search = ''; // Clear all
        if (merchantId) url.searchParams.set('merchantId', merchantId);
        if (boutiqueId) url.searchParams.set('boutiqueId', boutiqueId);
        
        return url.toString();
      }
    }

    // Default: Return the URL but strip obvious tracking params (utm_*)
    const paramsToKeep = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      if (!key.startsWith('utm_') && !['adjust_t', 'link_userID', 'link_contentid', 'choiceNNEnabled', 'isRecoEnginePdpEnabled'].includes(key)) {
        paramsToKeep.append(key, value);
      }
    });
    
    const searchString = paramsToKeep.toString();
    url.search = searchString;
    return url.toString();

  } catch {
    // If URL is invalid, return original string (let upstream validation handle it)
    return urlStr;
  }
}
