import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { productQueries, priceHistoryQueries, siteGateConfigQueries, stockStatusHistoryQueries } from '../models';
import {
  buildRegionalGateInfo,
  RegionalGateOption,
  scrapeProduct,
  scrapeProductWithVoting,
  ExtractionMethod,
  SiteContext,
} from '../services/scraper';
import { normalizeUrl } from '../utils/urlNormalizer';

const router = Router();

function sanitizeSiteContext(input: unknown): SiteContext | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input as Record<string, unknown>;

  const context: SiteContext = {};
  if (typeof raw.countryCode === 'string') context.countryCode = raw.countryCode;
  if (typeof raw.storefrontId === 'string') context.storefrontId = raw.storefrontId;
  if (typeof raw.language === 'string') context.language = raw.language;
  if (Array.isArray(raw.cookies)) {
    context.cookies = raw.cookies
      .filter((cookie): cookie is Record<string, unknown> => !!cookie && typeof cookie === 'object')
      .map((cookie) => ({
        name: String(cookie.name || ''),
        value: String(cookie.value || ''),
        domain: cookie.domain ? String(cookie.domain) : undefined,
        path: cookie.path ? String(cookie.path) : undefined,
      }))
      .filter((cookie) => cookie.name && cookie.value);
  }

  return context;
}

async function getCachedRegionalGate(url: string): Promise<ReturnType<typeof buildRegionalGateInfo> | null> {
  const domain = new URL(url).hostname.replace(/^www\./, '');
  const gateKey = 'country-selection';

  const cached = await siteGateConfigQueries.findByDomainAndGateKey(domain, gateKey);
  if (cached && Array.isArray(cached.options) && cached.options.length > 0) {
    return {
      domain,
      gateKey,
      siteName: cached.site_name || domain,
      message: 'This site requires selecting a regional storefront to access accurate pricing.',
      options: cached.options as RegionalGateOption[],
    };
  }

  return null;
}

// All routes require authentication
router.use(authMiddleware);

// Get all products for the authenticated user (with sparkline data)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const products = await productQueries.findByUserIdWithSparkline(userId);
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Add a new product to track (with multi-strategy voting)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { refresh_interval, selectedPrice, selectedMethod, selectedCurrency } = req.body;
    let { url } = req.body;
    const siteContext = sanitizeSiteContext(req.body.siteContext);

    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    url = normalizeUrl(url);

    // Validate URL
    try {
      new URL(url);
    } catch {
      res.status(400).json({ error: 'Invalid URL format' });
      return;
    }

    if (!siteContext) {
      const cachedGate = await getCachedRegionalGate(url);
      if (cachedGate) {
        res.status(200).json({
          needsStorefrontSelection: true,
          regionalGate: cachedGate,
        });
        return;
      }
    }

    // If user is confirming a price selection, use the old scraper with their choice
    if (selectedPrice !== undefined && selectedMethod) {
      // User has selected a price from candidates - use it directly
      const scrapedData = await scrapeProduct(url, userId, siteContext);

      if (scrapedData.regionalGate && !siteContext) {
        await siteGateConfigQueries.upsert(
          scrapedData.regionalGate.domain,
          scrapedData.regionalGate.gateKey,
          scrapedData.regionalGate.options,
          scrapedData.regionalGate.siteName
        );
        res.status(200).json({
          needsStorefrontSelection: true,
          regionalGate: scrapedData.regionalGate,
        });
        return;
      }

      // Create product with the user-selected price
      const product = await productQueries.create(
        userId,
        url,
        scrapedData.name,
        scrapedData.imageUrl,
        refresh_interval || 3600,
        scrapedData.stockStatus,
        siteContext || null
      );

      // Store the preferred extraction method and the user-selected price
      await productQueries.updateExtractionMethod(product.id, selectedMethod);

      // Store the anchor price - used on refresh to select the correct variant
      await productQueries.updateAnchorPrice(product.id, selectedPrice);
      console.log(`[Products] Saved anchor price ${selectedPrice} for product ${product.id} (method: ${selectedMethod})`);

      // Record the user-selected price
      await priceHistoryQueries.create(
        product.id,
        selectedPrice,
        typeof selectedCurrency === 'string' && selectedCurrency.trim()
          ? selectedCurrency.trim().toUpperCase()
          : (scrapedData.price?.currency || 'USD'),
        null
      );

      // Record initial stock status
      if (scrapedData.stockStatus !== 'unknown') {
        await stockStatusHistoryQueries.recordChange(product.id, scrapedData.stockStatus);
      }

      // Update last_checked timestamp
      await productQueries.updateLastChecked(product.id, product.refresh_interval);

      const productWithPrice = await productQueries.findById(product.id, userId);
      res.status(201).json(productWithPrice);
      return;
    }

    // Use multi-strategy voting scraper
    const scrapedData = await scrapeProductWithVoting(url, userId, undefined, undefined, undefined, undefined, siteContext);

    if (scrapedData.regionalGate && !siteContext) {
      await siteGateConfigQueries.upsert(
        scrapedData.regionalGate.domain,
        scrapedData.regionalGate.gateKey,
        scrapedData.regionalGate.options,
        scrapedData.regionalGate.siteName
      );
      res.status(200).json({
        needsStorefrontSelection: true,
        regionalGate: scrapedData.regionalGate,
      });
      return;
    }

    // Allow adding out-of-stock products, but require a price for in-stock ones
    if (!scrapedData.price && scrapedData.stockStatus !== 'out_of_stock') {
      res.status(400).json({
        error: 'Could not extract price from the provided URL',
      });
      return;
    }

    // Always show price selection modal when adding a product so user can verify
    // Show if we have at least one candidate with a price
    if (scrapedData.priceCandidates.length > 0 || scrapedData.price) {
      // Make sure we have at least one candidate to show
      const candidates = scrapedData.priceCandidates.length > 0
        ? scrapedData.priceCandidates
        : scrapedData.price
          ? [{
              price: scrapedData.price.price,
              currency: scrapedData.price.currency,
              method: scrapedData.selectedMethod || 'ai' as const,
              context: 'Extracted price',
              confidence: 0.8
            }]
          : [];

      if (candidates.length > 0) {
        res.status(200).json({
          needsReview: true,
          name: scrapedData.name,
          imageUrl: scrapedData.imageUrl,
          stockStatus: scrapedData.stockStatus,
          priceCandidates: candidates.map(c => ({
            price: c.price,
            currency: c.currency,
            method: c.method,
            context: c.context,
            confidence: c.confidence,
          })),
          suggestedPrice: scrapedData.price,
          url,
        });
        return;
      }
    }

    // Create product with stock status
    const product = await productQueries.create(
      userId,
      url,
      scrapedData.name,
      scrapedData.imageUrl,
      refresh_interval || 3600,
      scrapedData.stockStatus,
      siteContext || null
    );

    // Store the extraction method that worked
    if (scrapedData.selectedMethod) {
      await productQueries.updateExtractionMethod(product.id, scrapedData.selectedMethod);
    }

    // Record initial price if available
    if (scrapedData.price) {
      await priceHistoryQueries.create(
        product.id,
        scrapedData.price.price,
        scrapedData.price.currency,
        scrapedData.aiStatus
      );
    }

    // Record initial stock status
    if (scrapedData.stockStatus !== 'unknown') {
      await stockStatusHistoryQueries.recordChange(product.id, scrapedData.stockStatus);
    }

    // Update last_checked timestamp and schedule next check
    await productQueries.updateLastChecked(product.id, product.refresh_interval);

    // Fetch the product with the price
    const productWithPrice = await productQueries.findById(product.id, userId);

    res.status(201).json(productWithPrice);
  } catch (error) {
    // Handle unique constraint violation
    if (
      error instanceof Error &&
      error.message.includes('duplicate key value')
    ) {
      res.status(409).json({ error: 'You are already tracking this product' });
      return;
    }
    console.error('Error adding product:', error);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// Get a specific product
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const productId = parseInt(req.params.id, 10);

    if (isNaN(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const product = await productQueries.findById(productId, userId);

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Get price stats
    const stats = await priceHistoryQueries.getStats(productId);

    res.json({ ...product, stats });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Update product settings
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const productId = parseInt(req.params.id, 10);

    if (isNaN(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const { name, refresh_interval, price_drop_threshold, target_price, notify_back_in_stock, ai_verification_disabled, ai_extraction_disabled } = req.body;

    const product = await productQueries.update(productId, userId, {
      name,
      refresh_interval,
      price_drop_threshold,
      target_price,
      notify_back_in_stock,
      ai_verification_disabled,
      ai_extraction_disabled,
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete a product
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const productId = parseInt(req.params.id, 10);

    if (isNaN(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const deleted = await productQueries.delete(productId, userId);

    if (!deleted) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Bulk pause/resume checking
router.post('/bulk/pause', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { ids, paused } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'Product IDs array is required' });
      return;
    }

    if (typeof paused !== 'boolean') {
      res.status(400).json({ error: 'Paused status (boolean) is required' });
      return;
    }

    const updated = await productQueries.bulkSetCheckingPaused(ids, userId, paused);
    res.json({
      message: `${updated} product(s) ${paused ? 'paused' : 'resumed'}`,
      updated
    });
  } catch (error) {
    console.error('Error bulk updating pause status:', error);
    res.status(500).json({ error: 'Failed to update pause status' });
  }
});

export default router;
